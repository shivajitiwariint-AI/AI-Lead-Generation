import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { resolveDataSource } from "@/lib/data-sources";
import { decryptSecret } from "@/lib/encryption";
import { recordAudit, recordLeadActivity } from "@/lib/activity";

/**
 * Social signals are collected only from official platform APIs or entered by
 * a human. There is no scraping here. Every signal stays unverified and without
 * marketing consent until a person reviews it and explicitly creates a lead.
 */

export type SignalPlatform =
  | "youtube"
  | "x"
  | "reddit"
  | "instagram"
  | "tiktok"
  | "linkedin"
  | "manual";

export interface SocialSignalInput {
  platform: SignalPlatform;
  kind: "video" | "short" | "reel" | "post";
  title: string;
  url: string;
  author?: string | null;
  authorHandle?: string | null;
  externalId?: string | null;
  publishedAt?: Date | null;
  views?: number | null;
  likes?: number | null;
  comments?: number | null;
  shares?: number | null;
  durationSec?: number | null;
  thumbnailUrl?: string | null;
  snippet?: string | null;
  relevanceScore?: number;
  sourceQuery?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface DiscoverSocialSignalsResult {
  saved: number;
  received: number;
  sources: string[];
  errors: string[];
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function toNumber(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : null;
}

function isoDurationToSeconds(value: unknown): number | null {
  if (typeof value !== "string" || !value.startsWith("PT")) return null;
  const match = value.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?/i);
  if (!match) return null;
  const seconds =
    Number(match[1] ?? 0) * 3600 + Number(match[2] ?? 0) * 60 + Number(match[3] ?? 0);
  return Number.isFinite(seconds) ? Math.round(seconds) : null;
}

function scoreRelevance(query: string, text: string): number {
  const words = query
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.replace(/[^a-z0-9]/g, ""))
    .filter((w) => w.length > 2);
  if (words.length === 0) return 0;
  const body = text.toLowerCase();
  const hits = words.filter((word) => body.includes(word)).length;
  return Math.round((hits / words.length) * 100);
}

async function fetchJson(url: string, init?: RequestInit, timeoutMs = 15000): Promise<any> {
  const res = await fetch(url, {
    ...init,
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function firstAccessToken(tenantId: string, platform: string): Promise<string | null> {
  const rows = await prisma.socialCampaignSource.findMany({
    where: { tenantId, platform, enabled: true },
    orderBy: { createdAt: "asc" },
  });
  for (const row of rows) {
    if (!row.encryptedAccessToken) continue;
    try {
      const token = decryptSecret(row.encryptedAccessToken);
      if (token) return token;
    } catch {
      // Skip a key that cannot be decrypted with the current encryption key.
    }
  }
  return null;
}

/** YouTube Shorts via the official YouTube Data API (videos <= 180 seconds). */
async function searchYouTubeShorts(
  apiKey: string,
  query: string,
  maxResults: number
): Promise<SocialSignalInput[]> {
  const limit = Math.min(Math.max(maxResults, 1), 20);
  const searchParams = new URLSearchParams({
    part: "snippet",
    type: "video",
    videoDuration: "short",
    q: query,
    maxResults: String(limit),
    key: apiKey,
  });
  const search = await fetchJson(
    `https://www.googleapis.com/youtube/v3/search?${searchParams.toString()}`
  );
  const ids: string[] = (search?.items ?? [])
    .map((item: any) => String(item?.id?.videoId ?? ""))
    .filter(Boolean);
  if (ids.length === 0) return [];

  const detailParams = new URLSearchParams({
    part: "snippet,statistics,contentDetails",
    id: ids.join(","),
    key: apiKey,
  });
  const details = await fetchJson(
    `https://www.googleapis.com/youtube/v3/videos?${detailParams.toString()}`
  );

  return (details?.items ?? []).flatMap((item: any) => {
    const durationSec = isoDurationToSeconds(item?.contentDetails?.duration);
    if (durationSec != null && durationSec > 180) return [];
    const id = String(item?.id ?? "");
    const snippet = String(item?.snippet?.description ?? "").slice(0, 500);
    const title = String(item?.snippet?.title ?? "YouTube Short");
    return [
      {
        platform: "youtube" as const,
        kind: "short" as const,
        title,
        url: `https://www.youtube.com/shorts/${id}`,
        author: item?.snippet?.channelTitle ? String(item.snippet.channelTitle) : null,
        externalId: id,
        publishedAt: item?.snippet?.publishedAt
          ? new Date(item.snippet.publishedAt)
          : null,
        views: toNumber(item?.statistics?.viewCount),
        likes: toNumber(item?.statistics?.likeCount),
        comments: toNumber(item?.statistics?.commentCount),
        durationSec,
        thumbnailUrl:
          item?.snippet?.thumbnails?.high?.url ??
          item?.snippet?.thumbnails?.default?.url ??
          null,
        snippet,
        relevanceScore: scoreRelevance(query, `${title} ${snippet}`),
        metadata: { source: "youtube_data_api", kind: "short" },
      },
    ];
  });
}

/** Video posts from X API v2 recent search. */
async function searchXVideoPosts(
  bearerToken: string,
  query: string,
  maxResults: number
): Promise<SocialSignalInput[]> {
  const params = new URLSearchParams({
    query: `${query} lang:en -is:retweet has:videos`,
    max_results: String(Math.min(Math.max(maxResults, 10), 50)),
    "tweet.fields": "created_at,public_metrics,attachments",
    expansions: "author_id,attachments.media_keys",
    "user.fields": "name,username",
    "media.fields": "type,preview_image_url,url",
  });
  const data = await fetchJson(
    `https://api.x.com/2/tweets/search/recent?${params.toString()}`,
    { headers: { Authorization: `Bearer ${bearerToken}` } }
  );
  const users = new Map<string, any>(
    (data?.includes?.users ?? []).map((user: any) => [user.id, user])
  );
  const media = new Map<string, any>(
    (data?.includes?.media ?? []).map((item: any) => [item.media_key, item])
  );

  return (data?.data ?? []).flatMap((tweet: any) => {
    const keys: string[] = tweet?.attachments?.media_keys ?? [];
    const video = keys.map((key) => media.get(key)).find((m) => m?.type === "video");
    if (!video) return [];
    const author = users.get(tweet.author_id);
    const handle = String(author?.username ?? "unknown");
    const text = String(tweet.text ?? "").slice(0, 500);
    const metrics = tweet?.public_metrics ?? {};
    return [
      {
        platform: "x" as const,
        kind: "video" as const,
        title: text.slice(0, 200),
        url: `https://x.com/${handle}/status/${tweet.id}`,
        author: author?.name ? String(author.name) : `@${handle}`,
        authorHandle: `@${handle}`,
        externalId: String(tweet.id),
        publishedAt: tweet?.created_at ? new Date(tweet.created_at) : null,
        views: toNumber(metrics.impression_count),
        likes: toNumber(metrics.like_count),
        comments: toNumber(metrics.reply_count),
        shares: toNumber(metrics.retweet_count),
        thumbnailUrl: video.preview_image_url ?? null,
        snippet: text,
        relevanceScore: scoreRelevance(query, text),
        metadata: { source: "x_api_v2", kind: "video" },
      },
    ];
  });
}

async function redditToken(clientId: string, clientSecret: string): Promise<string> {
  const res = await fetch("https://www.reddit.com/api/v1/access_token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      "User-Agent": "LeadSocialSignals/1.0",
    },
    body: "grant_type=client_credentials",
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`Reddit auth HTTP ${res.status}`);
  const data = await res.json();
  return String(data?.access_token ?? "");
}

/** Video posts from the official Reddit OAuth API. */
async function searchRedditVideos(
  token: string,
  query: string,
  maxResults: number
): Promise<SocialSignalInput[]> {
  const params = new URLSearchParams({
    q: query,
    limit: String(Math.min(Math.max(maxResults, 1), 25)),
    sort: "new",
    t: "month",
  });
  const data = await fetchJson(`https://oauth.reddit.com/search?${params.toString()}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "User-Agent": "LeadSocialSignals/1.0",
    },
  });
  return (data?.data?.children ?? []).flatMap((child: any) => {
    const post = child?.data ?? {};
    const isVideo =
      post?.is_video === true ||
      post?.post_hint === "video" ||
      /v\.redd\.it|\.mp4(?:\?|$)/i.test(String(post?.url ?? ""));
    if (!isVideo) return [];
    const title = String(post.title ?? "Reddit video");
    return [
      {
        platform: "reddit" as const,
        kind: "video" as const,
        title,
        url: post?.permalink
          ? `https://www.reddit.com${post.permalink}`
          : String(post?.url ?? ""),
        author: post?.author ? String(post.author) : null,
        authorHandle: post?.author ? `u/${post.author}` : null,
        externalId: String(post?.id ?? ""),
        publishedAt: post?.created_utc ? new Date(Number(post.created_utc) * 1000) : null,
        views: null,
        likes: toNumber(post?.ups ?? post?.score),
        comments: toNumber(post?.num_comments),
        thumbnailUrl:
          post?.thumbnail && /^https?:/.test(post.thumbnail) ? String(post.thumbnail) : null,
        snippet: String(post?.selftext ?? "").slice(0, 500),
        relevanceScore: scoreRelevance(query, `${title} ${post?.selftext ?? ""}`),
        metadata: { source: "reddit_oauth", subreddit: post?.subreddit ?? null },
      },
    ];
  });
}

/** Reels from a connected Instagram account via the official Graph API. */
async function searchInstagramReels(
  token: string,
  query: string,
  maxResults: number
): Promise<SocialSignalInput[]> {
  const params = new URLSearchParams({
    fields: "id,caption,media_type,media_url,permalink,timestamp,like_count,comments_count",
    limit: String(Math.min(Math.max(maxResults, 1), 25)),
  });
  const data = await fetchJson(`https://graph.facebook.com/v20.0/me/media?${params.toString()}&access_token=${encodeURIComponent(token)}`);
  return (data?.data ?? []).flatMap((item: any) => {
    if (item?.media_type !== "REELS") return [];
    const caption = String(item?.caption ?? "").slice(0, 500);
    const title = caption.split("\n")[0]?.slice(0, 200) || "Instagram Reel";
    if (query && scoreRelevance(query, `${title} ${caption}`) === 0) return [];
    return [
      {
        platform: "instagram" as const,
        kind: "reel" as const,
        title,
        url: String(item?.permalink ?? ""),
        externalId: String(item?.id ?? ""),
        publishedAt: item?.timestamp ? new Date(item.timestamp) : null,
        likes: toNumber(item?.like_count),
        comments: toNumber(item?.comments_count),
        thumbnailUrl: item?.media_url ? String(item.media_url) : null,
        snippet: caption,
        relevanceScore: scoreRelevance(query, `${title} ${caption}`),
        metadata: { source: "instagram_graph_api", kind: "reel" },
      },
    ];
  });
}

/** Videos from a connected TikTok account via the official Display API. */
async function searchTikTokVideos(
  token: string,
  query: string,
  maxResults: number
): Promise<SocialSignalInput[]> {
  const params = new URLSearchParams({
    fields: "id,title,create_time,cover_image_url,embed_url,like_count,comment_count,share_count,duration",
    max_count: String(Math.min(Math.max(maxResults, 1), 20)),
  });
  const data = await fetchJson(
    `https://open.tiktokapis.com/v2/users/me/videos/?${params.toString()}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return (data?.data?.videos ?? []).flatMap((video: any) => {
    const title = String(video?.title ?? "TikTok video").slice(0, 200);
    if (query && scoreRelevance(query, title) === 0) return [];
    return [
      {
        platform: "tiktok" as const,
        kind: "short" as const,
        title,
        url: String(video?.embed_url ?? `https://www.tiktok.com/video/${video?.id ?? ""}`),
        externalId: String(video?.id ?? ""),
        publishedAt: video?.create_time ? new Date(Number(video.create_time) * 1000) : null,
        likes: toNumber(video?.like_count),
        comments: toNumber(video?.comment_count),
        shares: toNumber(video?.share_count),
        durationSec: toNumber(video?.duration),
        thumbnailUrl: video?.cover_image_url ? String(video.cover_image_url) : null,
        snippet: title,
        relevanceScore: scoreRelevance(query, title),
        metadata: { source: "tiktok_display_api", kind: "short" },
      },
    ];
  });
}

/** Persist one signal. Re-running discovery updates the same row. */
export async function saveSocialSignal(
  tenantId: string,
  input: SocialSignalInput
): Promise<string | null> {
  const title = String(input.title ?? "").trim().slice(0, 300);
  const url = String(input.url ?? "").trim().slice(0, 500);
  if (!title || !isHttpUrl(url)) return null;

  const externalId = input.externalId?.trim() || `${input.platform}:${randomUUID()}`;
  const data = {
    tenantId,
    platform: input.platform,
    kind: input.kind,
    title,
    url,
    author: input.author?.slice(0, 200) ?? null,
    authorHandle: input.authorHandle?.slice(0, 200) ?? null,
    externalId,
    publishedAt: input.publishedAt ?? null,
    views: input.views ?? null,
    likes: input.likes ?? null,
    comments: input.comments ?? null,
    shares: input.shares ?? null,
    durationSec: input.durationSec ?? null,
    thumbnailUrl: input.thumbnailUrl?.slice(0, 500) ?? null,
    snippet: input.snippet?.slice(0, 4000) ?? null,
    relevanceScore: Math.min(Math.max(input.relevanceScore ?? 0, 0), 100),
    sourceQuery: input.sourceQuery?.slice(0, 300) ?? null,
    metadata: (input.metadata ?? undefined) as any,
  };

  const saved = await prisma.socialSignal.upsert({
    where: {
      tenantId_platform_externalId: { tenantId, platform: input.platform, externalId },
    },
    create: data,
    update: { ...data, updatedAt: new Date() },
  });
  return saved.id;
}

/** Discover social videos/posts using only official APIs. */
export async function discoverSocialSignals(
  tenantId: string,
  query: string,
  maxResults = 10,
  actorId?: string | null
): Promise<DiscoverSocialSignalsResult> {
  const cleanQuery = String(query ?? "").trim().slice(0, 300);
  if (!cleanQuery) throw new Error("Enter a search topic first");
  const limit = Math.min(Math.max(Number(maxResults) || 10, 1), 25);

  const inputs: SocialSignalInput[] = [];
  const sources: string[] = [];
  const errors: string[] = [];

  const youtube = await resolveDataSource("youtube", tenantId).catch(() => null);
  if (youtube?.secret) {
    try {
      const found = await searchYouTubeShorts(youtube.secret, cleanQuery, limit);
      inputs.push(...found);
      if (found.length) sources.push("YouTube Shorts");
    } catch (e: any) {
      errors.push(`YouTube: ${e.message}`);
    }
  }

  const x = await resolveDataSource("x", tenantId).catch(() => null);
  if (x?.secret) {
    try {
      const found = await searchXVideoPosts(x.secret, cleanQuery, limit);
      inputs.push(...found);
      if (found.length) sources.push("X videos");
    } catch (e: any) {
      errors.push(`X: ${e.message}`);
    }
  }

  const reddit = await resolveDataSource("reddit", tenantId).catch(() => null);
  if (reddit?.secret && reddit.secondary) {
    try {
      const token = await redditToken(reddit.secret, reddit.secondary);
      const found = await searchRedditVideos(token, cleanQuery, limit);
      inputs.push(...found);
      if (found.length) sources.push("Reddit videos");
    } catch (e: any) {
      errors.push(`Reddit: ${e.message}`);
    }
  }

  const instagramToken = await firstAccessToken(tenantId, "instagram");
  if (instagramToken) {
    try {
      const found = await searchInstagramReels(instagramToken, cleanQuery, limit);
      inputs.push(...found);
      if (found.length) sources.push("Instagram Reels");
    } catch (e: any) {
      errors.push(`Instagram: ${e.message}`);
    }
  }

  const tiktok = await resolveDataSource("tiktok", tenantId).catch(() => null);
  if (tiktok?.secret) {
    try {
      const found = await searchTikTokVideos(tiktok.secret, cleanQuery, limit);
      inputs.push(...found);
      if (found.length) sources.push("TikTok videos");
    } catch (e: any) {
      errors.push(`TikTok: ${e.message}`);
    }
  }

  let saved = 0;
  for (const input of inputs.slice(0, limit)) {
    try {
      const id = await saveSocialSignal(tenantId, {
        ...input,
        sourceQuery: cleanQuery,
      });
      if (id) saved++;
    } catch (e: any) {
      errors.push(`Save ${input.platform}: ${e.message}`);
    }
  }

  if (saved > 0) {
    await recordAudit({
      tenantId,
      actorId: actorId ?? null,
      actorType: actorId ? "user" : "ai",
      action: "social.signals_discovered",
      category: "research",
      targetType: "social_signal",
      targetId: null,
      metadata: { query: cleanQuery, saved, sources, errors },
    });
  }

  return { saved, received: inputs.length, sources, errors };
}

/** Turn a reviewed signal into an unverified lead. Never invents contact data. */
export async function convertSignalToLead(
  tenantId: string,
  signalId: string,
  actorId?: string | null
): Promise<{ leadId: string; created: boolean }> {
  const signal = await prisma.socialSignal.findFirst({
    where: { id: signalId, tenantId },
  });
  if (!signal) throw new Error("Social signal not found");
  if (signal.leadId) return { leadId: signal.leadId, created: false };

  const externalId = signal.externalId || signal.id;
  const existingSource = await prisma.leadSource.findFirst({
    where: {
      tenantId,
      sourceType: "social_signal",
      OR: [{ externalId }, { externalId: signal.id }],
    },
    select: { leadId: true },
  });
  if (existingSource) {
    await prisma.socialSignal.update({
      where: { id: signal.id },
      data: { status: "converted", leadId: existingSource.leadId, updatedAt: new Date() },
    });
    return { leadId: existingSource.leadId, created: false };
  }

  const detail = [signal.title, signal.snippet, `Source: ${signal.url}`]
    .filter(Boolean)
    .join("\n")
    .slice(0, 4000);

  const lead = await prisma.lead.create({
    data: {
      tenantId,
      name: String(signal.author || signal.title || "Social prospect").slice(0, 200),
      email: null,
      phone: null,
      company: signal.author ? String(signal.author).slice(0, 200) : null,
      website: null,
      industry: null,
      location: null,
      requirement: detail,
      status: "new",
      score: 0,
      consentMarketing: false,
      verified: false,
      controlMode: "ai",
    },
  });

  await prisma.leadSource.create({
    data: {
      tenantId,
      leadId: lead.id,
      sourceType: "social_signal",
      externalId,
      attribution: JSON.stringify({
        source: "social_signal",
        signalId: signal.id,
        platform: signal.platform,
        kind: signal.kind,
        url: signal.url,
        publishedAt: signal.publishedAt?.toISOString() ?? null,
        metrics: {
          views: signal.views,
          likes: signal.likes,
          comments: signal.comments,
          shares: signal.shares,
        },
        createdFromPublicPost: true,
        verified: false,
        consentMarketing: false,
        convertedAt: new Date().toISOString(),
      }),
    },
  });

  await recordLeadActivity({
    tenantId,
    leadId: lead.id,
    actorId: actorId ?? null,
    activityType: "lead_created",
    payload: {
      source: "social_signal",
      signalId: signal.id,
      platform: signal.platform,
      url: signal.url,
      verified: false,
      consentMarketing: false,
    },
  });

  await recordAudit({
    tenantId,
    actorId: actorId ?? null,
    actorType: "user",
    action: "social.lead_created",
    category: "lead",
    targetType: "lead",
    targetId: lead.id,
    metadata: {
      signalId: signal.id,
      platform: signal.platform,
      verified: false,
      consentMarketing: false,
    },
  });

  await prisma.socialSignal.update({
    where: { id: signal.id },
    data: { status: "converted", leadId: lead.id, updatedAt: new Date() },
  });

  return { leadId: lead.id, created: true };
}
