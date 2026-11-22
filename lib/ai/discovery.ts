import { resolveDataSource } from "@/lib/data-sources";

/**
 * Real-data discovery adapters. Only official APIs are used — no scraping of
 * Google, LinkedIn, Justdial, IndiaMART or TradeIndia. Every candidate keeps
 * its source URL and is marked unverified until a human checks it.
 */

export interface DiscoveredCandidate {
  name: string;
  title?: string | null;
  company: string;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  industry?: string | null;
  location?: string | null;
  reason: string;
  sourcePlatform: string;
  sourceUrl?: string | null;
  externalId?: string | null;
  websiteSignals?: string[];
  websiteAnalysis?: string;
  performanceScore?: number | null;
  linkedin?: string | null;
  verified: boolean;
  confidence?: number | null;
}

export interface WebsiteAnalysis {
  signals: string[];
  summary: string;
  performanceScore: number | null;
  hasViewport: boolean;
  technologies: string[];
}

export interface DiscoverOptions {
  tenantId?: string | null;
  query: string;
  location?: string | null;
  industry?: string | null;
  maxResults: number;
}

export interface DiscoverResult {
  candidates: DiscoveredCandidate[];
  sources: string[];
  errors: string[];
  usedLive: boolean;
}

function normalizeWebsite(value?: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

function domainOf(value?: string | null): string | null {
  const url = normalizeWebsite(value);
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return null;
  }
}

async function fetchJson(url: string, init?: RequestInit, timeoutMs = 12000): Promise<any> {
  const res = await fetch(url, {
    ...init,
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  return res.json();
}

function splitName(value: string): { first: string; last: string } {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first: "", last: "" };
  if (parts.length === 1) return { first: parts[0], last: "" };
  return { first: parts[0], last: parts.slice(1).join(" ") };
}

/* ---------------------------- Discovery ---------------------------- */

async function searchGooglePlaces(
  apiKey: string,
  opts: DiscoverOptions
): Promise<DiscoveredCandidate[]> {
  const textQuery = [opts.query, opts.location].filter(Boolean).join(" in ");
  const data = await fetchJson(
    "https://places.googleapis.com/v1/places:searchText",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": [
          "places.id",
          "places.displayName",
          "places.formattedAddress",
          "places.websiteUri",
          "places.internationalPhoneNumber",
          "places.rating",
          "places.userRatingCount",
          "places.googleMapsUri",
        ].join(","),
      },
      body: JSON.stringify({
        textQuery,
        pageSize: Math.min(Math.max(opts.maxResults, 1), 20),
      }),
    }
  );

  const places: any[] = Array.isArray(data?.places) ? data.places : [];
  return places.map((place) => {
    const name = String(place?.displayName?.text ?? " Unknown business").trim();
    const rating = typeof place?.rating === "number" ? ` · ${place.rating.toFixed(1)}★` : "";
    const reviews =
      typeof place?.userRatingCount === "number"
        ? ` (${place.userRatingCount} reviews)`
        : "";
    return {
      name,
      company: name,
      phone: place?.internationalPhoneNumber ? String(place.internationalPhoneNumber) : null,
      website: place?.websiteUri ? String(place.websiteUri) : null,
      location: place?.formattedAddress ? String(place.formattedAddress) : null,
      industry: opts.industry ?? null,
      reason: `Real local business found on Google Maps${rating}${reviews}. No contact email available yet.`,
      sourcePlatform: "Google Maps",
      sourceUrl: place?.googleMapsUri ? String(place.googleMapsUri) : null,
      externalId: place?.id ? String(place.id) : null,
      email: null,
      title: null,
      verified: false,
      confidence: 0.9,
    };
  });
}

/* -------------------------- Website checks -------------------------- */

export async function analyzeWebsite(
  rawUrl: string,
  tenantId?: string | null
): Promise<WebsiteAnalysis> {
  const url = normalizeWebsite(rawUrl)!;
  const signals: string[] = [];
  const technologies: string[] = [];
  let html = "";
  let hasViewport = false;
  let loadMs: number | null = null;
  let performanceScore: number | null = null;

  const started = Date.now();
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; LeadResearch/1.0)" },
      signal: AbortSignal.timeout(8000),
    });
    html = (await res.text()).slice(0, 300000);
    loadMs = Date.now() - started;
  } catch {
    signals.push("poor performance");
  }

  hasViewport = /name\s*=\s*["']viewport["']/i.test(html) || /width\s*=\s*device-width/i.test(html);
  if (!hasViewport) signals.push("no mobile responsiveness");

  const hasAdmin = /admin|login|dashboard|portal|staff\s+login|student\s+login|manage/i.test(html);
  if (!hasAdmin) signals.push("missing dashboard/admin features");

  const hasInventory = /inventory|stock|sku|product\s+catalog/i.test(html);
  if (!hasInventory) signals.push("no inventory tracking");

  const hasAppointment = /appointment|book\s+now|booking|calendly|practo/i.test(html);
  if (!hasAppointment) signals.push("no appointment system");

  const hasErp = /erp|crm|automation|workflow|business\s+management/i.test(html);
  if (!hasErp) {
    signals.push("no ERP functionality");
    signals.push("no automation");
  }

  if (/bootstrap[/@\s]?3|jquery[-/]?1\.|flash|wordpress[/=]?[0-4]\.|weebly|wix\.com/i.test(html)) {
    signals.push("outdated UI");
  }

  const oldTech = html.match(/(?:jquery|bootstrap|wordpress|angular|react|php)[\s/@-]*\d+\.\d+/gi) ?? [];
  for (const t of oldTech.slice(0, 8)) {
    const clean = t.trim();
    if (!technologies.includes(clean)) technologies.push(clean);
  }

  // PageSpeed Insights gives a real mobile performance score when configured.
  const psi = await resolveDataSource("pagespeed", tenantId).catch(() => null);
  const places = psi?.secret ? null : await resolveDataSource("google_places", tenantId).catch(() => null);
  const key = psi?.secret || places?.secret;
  if (key) {
    try {
      const psiUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&strategy=mobile&category=performance&key=${encodeURIComponent(key)}`;
      const data = await fetchJson(psiUrl, undefined, 20000);
      const score = data?.lighthouseResult?.categories?.performance?.score;
      if (typeof score === "number") {
        performanceScore = Math.round(score * 100);
        if (score < 0.5 && !signals.includes("poor performance")) {
          signals.push("poor performance");
        }
      }
    } catch {
      // Website checks still work without the PageSpeed score.
    }
  } else if (loadMs != null && loadMs > 5000 && !signals.includes("poor performance")) {
    signals.push("poor performance");
  }

  // Optional technology lookup to support the "outdated UI" signal.
  const builtWith = await resolveDataSource("builtwith", tenantId).catch(() => null);
  const domain = domainOf(url);
  if (builtWith?.secret && domain) {
    try {
      const data = await fetchJson(
        `https://api.builtwith.com/v20/api.json?KEY=${encodeURIComponent(builtWith.secret)}&LOOKUP=${encodeURIComponent(domain)}`,
        undefined,
        12000
      );
      const names: string[] = [];
      for (const result of data?.Results ?? []) {
        for (const path of result?.Result ?? []) {
          for (const tech of path?.Techniques ?? []) {
            if (tech?.Name) names.push(String(tech.Name));
          }
        }
      }
      for (const name of names.slice(0, 10)) {
        if (!technologies.includes(name)) technologies.push(name);
      }
      if (/jquery 1|bootstrap 3|flash|old/i.test(names.join(" ")) && !signals.includes("outdated UI")) {
        signals.push("outdated UI");
      }
    } catch {
      // Ignore optional enrichment failures.
    }
  }

  const uniqueSignals = Array.from(new Set(signals));
  return {
    signals: uniqueSignals,
    summary: uniqueSignals.length
      ? `Detected: ${uniqueSignals.join(", ")}`
      : "No obvious website problems detected",
    performanceScore,
    hasViewport,
    technologies,
  };
}

/* --------------------------- Enrichment ----------------------------- */

async function enrichWithApollo(
  candidate: DiscoveredCandidate,
  apiKey: string
): Promise<DiscoveredCandidate> {
  if (!candidate.website) return candidate;
  const domain = domainOf(candidate.website);
  if (!domain) return candidate;
  const { first, last } = splitName(candidate.name);
  try {
    const data = await fetchJson(
      "https://api.apollo.io/api/v1/people/match",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Api-Key": apiKey,
        },
        body: JSON.stringify({ first_name: first, last_name: last, domain }),
      }
    );
    const person = data?.person ?? data;
    if (!person) return candidate;
    const phone = Array.isArray(person.phone_numbers)
      ? person.phone_numbers.find((p: any) => p?.sanitized_number || p?.raw_number)
      : null;
    return {
      ...candidate,
      email: candidate.email || person.email || null,
      title: candidate.title || person.title || null,
      linkedin: candidate.linkedin || person.linkedin_url || null,
      phone: candidate.phone || phone?.sanitized_number || phone?.raw_number || null,
    };
  } catch {
    return candidate;
  }
}

async function enrichWithHunter(
  candidate: DiscoveredCandidate,
  apiKey: string
): Promise<DiscoveredCandidate> {
  if (!candidate.website) return candidate;
  const domain = domainOf(candidate.website);
  if (!domain) return candidate;
  const { first, last } = splitName(candidate.name);
  try {
    const params = new URLSearchParams({ domain, api_key: apiKey });
    if (first) params.set("first_name", first);
    if (last) params.set("last_name", last);
    const data = await fetchJson(`https://api.hunter.io/v2/email-finder?${params.toString()}`);
    const found = data?.data;
    if (!found) return candidate;
    return {
      ...candidate,
      email: candidate.email || found.email || null,
      linkedin: candidate.linkedin || found.linkedin || null,
      confidence: found.score != null ? Number(found.score) / 100 : candidate.confidence,
    };
  } catch {
    return candidate;
  }
}

/* -------------------------- Intent sources --------------------------- */

async function searchX(apiKey: string, opts: DiscoverOptions): Promise<DiscoveredCandidate[]> {
  const query = `${opts.query} lang:en -is:retweet`;
  const params = new URLSearchParams({
    query,
    max_results: String(Math.min(Math.max(opts.maxResults, 10), 50)),
    "tweet.fields": "created_at",
    expansions: "author_id",
    "user.fields": "name,username,url",
  });
  const data = await fetchJson(`https://api.x.com/2/tweets/search/recent?${params.toString()}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  const users = new Map<string, any>(
    (data?.includes?.users ?? []).map((u: any) => [u.id, u])
  );
  return (data?.data ?? []).map((tweet: any) => {
    const user = users.get(tweet.author_id);
    const handle = user?.username ? String(user.username) : "unknown";
    const text = String(tweet.text ?? "").slice(0, 240);
    return {
      name: user?.name ? String(user.name) : `@${handle}`,
      company: user?.name ? String(user.name) : `@${handle}`,
      reason: `Intent signal on X: “${text}”`,
      sourcePlatform: "X",
      sourceUrl: `https://x.com/${handle}/status/${tweet.id}`,
      externalId: String(tweet.id),
      linkedin: null,
      verified: false,
      confidence: 0.4,
    };
  });
}

async function searchYouTube(apiKey: string, opts: DiscoverOptions): Promise<DiscoveredCandidate[]> {
  const params = new URLSearchParams({
    part: "snippet",
    q: opts.query,
    type: "channel",
    maxResults: String(Math.min(Math.max(opts.maxResults, 1), 20)),
    key: apiKey,
  });
  const data = await fetchJson(`https://www.googleapis.com/youtube/v3/search?${params.toString()}`);
  return (data?.items ?? []).map((item: any) => {
    const title = String(item?.snippet?.title ?? "YouTube channel");
    const channelId = String(item?.id?.channelId ?? "");
    const description = String(item?.snippet?.description ?? "").slice(0, 200);
    return {
      name: title,
      company: title,
      reason: `Intent signal on YouTube: ${description || title}`,
      sourcePlatform: "YouTube",
      sourceUrl: channelId ? `https://www.youtube.com/channel/${channelId}` : null,
      externalId: channelId || null,
      verified: false,
      confidence: 0.4,
    };
  });
}

async function searchReddit(
  clientId: string,
  clientSecret: string,
  opts: DiscoverOptions
): Promise<DiscoveredCandidate[]> {
  const tokenRes = await fetch("https://www.reddit.com/api/v1/access_token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      "User-Agent": "LeadResearch/1.0",
    },
    body: "grant_type=client_credentials",
    signal: AbortSignal.timeout(12000),
  });
  if (!tokenRes.ok) throw new Error(`Reddit auth HTTP ${tokenRes.status}`);
  const tokenData = await tokenRes.json();
  const params = new URLSearchParams({
    q: opts.query,
    limit: String(Math.min(Math.max(opts.maxResults, 1), 20)),
    sort: "new",
  });
  const data = await fetchJson(`https://oauth.reddit.com/search?${params.toString()}`, {
    headers: {
      Authorization: `Bearer ${tokenData.access_token}`,
      "User-Agent": "LeadResearch/1.0",
    },
  });
  return (data?.data?.children ?? []).map((child: any) => {
    const post = child?.data ?? {};
    const title = String(post.title ?? "Reddit discussion");
    return {
      name: String(post.author ?? "reddit user"),
      company: String(post.subreddit ?? "Reddit"),
      reason: `Intent signal on Reddit: ${title.slice(0, 200)}`,
      sourcePlatform: "Reddit",
      sourceUrl: post.permalink ? `https://www.reddit.com${post.permalink}` : null,
      externalId: String(post.id ?? ""),
      verified: false,
      confidence: 0.35,
    };
  });
}

/* --------------------------- Orchestration --------------------------- */

export async function discoverRealCandidates(opts: DiscoverOptions): Promise<DiscoverResult> {
  const candidates: DiscoveredCandidate[] = [];
  const sources: string[] = [];
  const errors: string[] = [];

  const places = await resolveDataSource("google_places", opts.tenantId).catch(() => null);
  if (places?.secret) {
    try {
      const found = await searchGooglePlaces(places.secret, opts);
      candidates.push(...found);
      if (found.length) sources.push("Google Maps");
    } catch (e: any) {
      errors.push(`Google Places: ${e.message}`);
    }
  }

  // Enrich and inspect websites for the discovered businesses.
  const apollo = await resolveDataSource("apollo", opts.tenantId).catch(() => null);
  const hunter = await resolveDataSource("hunter", opts.tenantId).catch(() => null);

  for (const candidate of candidates.slice(0, 20)) {
    if (candidate.website) {
      try {
        const analysis = await analyzeWebsite(candidate.website, opts.tenantId);
        candidate.websiteSignals = analysis.signals;
        candidate.websiteAnalysis = analysis.summary;
        candidate.performanceScore = analysis.performanceScore;
      } catch (e: any) {
        errors.push(`Website check (${candidate.company}): ${e.message}`);
      }
    }
    if (apollo?.secret && candidate.website) {
      const enriched = await enrichWithApollo(candidate, apollo.secret);
      Object.assign(candidate, enriched);
    }
    if (hunter?.secret && candidate.website && !candidate.email) {
      const enriched = await enrichWithHunter(candidate, hunter.secret);
      Object.assign(candidate, enriched);
    }
  }

  // Intent sources are opt-in and return signals, not verified contacts.
  const x = await resolveDataSource("x", opts.tenantId).catch(() => null);
  if (x?.secret) {
    try {
      const found = await searchX(x.secret, opts);
      candidates.push(...found);
      if (found.length) sources.push("X");
    } catch (e: any) {
      errors.push(`X API: ${e.message}`);
    }
  }

  const youtube = await resolveDataSource("youtube", opts.tenantId).catch(() => null);
  if (youtube?.secret) {
    try {
      const found = await searchYouTube(youtube.secret, opts);
      candidates.push(...found);
      if (found.length) sources.push("YouTube");
    } catch (e: any) {
      errors.push(`YouTube API: ${e.message}`);
    }
  }

  const reddit = await resolveDataSource("reddit", opts.tenantId).catch(() => null);
  if (reddit?.secret && reddit.secondary) {
    try {
      const found = await searchReddit(reddit.secret, reddit.secondary, opts);
      candidates.push(...found);
      if (found.length) sources.push("Reddit");
    } catch (e: any) {
      errors.push(`Reddit API: ${e.message}`);
    }
  }

  return {
    candidates: candidates.slice(0, Math.min(Math.max(opts.maxResults, 1), 20)),
    sources,
    errors,
    usedLive: candidates.length > 0,
  };
}
