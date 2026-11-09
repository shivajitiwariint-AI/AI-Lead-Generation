import { chromium } from "playwright";
import fs from "fs";
import path from "path";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const OUT = path.resolve("test-artifacts");
fs.mkdirSync(OUT, { recursive: true });

const consoleErrors = [];
const failedRequests = [];
const results = [];

const slug = (s) => s.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
const rel = (p) => path.relative(process.cwd(), p);

async function newPage(browser, label, state) {
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    ...(state ? { storageState: state } : {}),
  });
  const page = await ctx.newPage();
  page.on("console", (m) => m.type() === "error" && consoleErrors.push(`[${label}] ${m.text()}`));
  page.on("pageerror", (e) => consoleErrors.push(`[${label}] PAGEERROR ${e.message}`));
  page.on("requestfailed", (r) =>
    failedRequests.push(`[${label}] ${r.method()} ${r.url()} :: ${r.failure()?.errorText}`)
  );
  page.on("response", (r) => {
    if (r.status() >= 400) failedRequests.push(`[${label}] HTTP ${r.status()} ${r.url()}`);
  });
  return { ctx, page };
}

async function visit(browser, url, label, state) {
  const { ctx, page } = await newPage(browser, label, state);
  const start = Date.now();
  try {
    const res = await page.goto(BASE + url, { waitUntil: "networkidle", timeout: 60000 });
    await page.waitForTimeout(700);
    const body = await page.locator("body").innerText().catch(() => "");
    const styleInfo = await page.evaluate(() => {
      let tailwindRules = 0;
      for (const sheet of Array.from(document.styleSheets)) {
        try {
          for (const rule of Array.from(sheet.cssRules)) {
            if (rule.cssText && /\.flex\b|\.container\b|\.grid\b/.test(rule.cssText)) tailwindRules++;
          }
        } catch {}
      }
      return {
        tailwindRules,
        bodyBg: getComputedStyle(document.body).backgroundColor,
      };
    }).catch(() => ({ tailwindRules: -1, bodyBg: "?" }));
    const shot = path.join(OUT, `${slug(label)}.png`);
    await page.screenshot({ path: shot });
    results.push({
      label,
      url,
      status: res ? String(res.status()) : "no-response",
      ms: Date.now() - start,
      title: await page.title(),
      styles: styleInfo.tailwindRules < 5 ? `NO-STYLES(${styleInfo.tailwindRules})` : "styled",
      errorText: /something went wrong|unhandled|application error|internal server error|access denied/i.test(body),
      notFound: res && res.status() === 404,
      redirected: page.url() !== BASE + url,
      shot: rel(shot),
      textSample: body.slice(0, 200).replace(/\s+/g, " "),
    });
  } catch (e) {
    results.push({ label, url, status: `EXCEPTION: ${e.message.split("\n")[0]}`, ms: Date.now() - start, shot: "" });
  }
  await ctx.close();
}

async function safe(name, fn) {
  try {
    await fn();
  } catch (e) {
    results.push({ label: name, url: "-", status: `EXCEPTION: ${e.message.split("\n")[0]}`, shot: "" });
    consoleErrors.push(`[${name}] ${e.message.split("\n")[0]}`);
  }
}

const exe =
  process.env.CHROMIUM_PATH ||
  process.env.LOCALAPPDATA + "\\ms-playwright\\chromium-1234\\chrome-win64\\chrome.exe";
const browser = await chromium.launch({ executablePath: fs.existsSync(exe) ? exe : undefined, headless: true });

// ---------- 1. Public pages ----------
await visit(browser, "/", "01-landing");
await visit(browser, "/auth/signin", "02-signin");
await visit(browser, "/auth/signup", "03-signup");

// ---------- 2. Sign-in flow ----------
await safe("signin-flow", async () => {
  const { ctx, page } = await newPage(browser, "signin-flow");
  await page.goto(BASE + "/auth/signin", { waitUntil: "networkidle" });
  await page.waitForSelector("form", { state: "visible" });
  await page.waitForTimeout(1200); // allow hydration

  await page.fill("#email", "shivajitiwari@gmail.com");
  await page.fill("#password", "wrongpass");
  await page.click("button[type=submit]");
  await page.waitForTimeout(2000);
  const err = await page.locator("body").innerText();
  results.push({
    label: "04-signin-invalid",
    url: "/auth/signin",
    status: /invalid email or password/i.test(err) ? "OK: error shown" : "FAIL: no error shown",
    shot: rel(path.join(OUT, "04-signin-invalid.png")),
  });
  await page.screenshot({ path: path.join(OUT, "04-signin-invalid.png") });

  await page.fill("#password", "Pueblo421#");
  await page.click("button[type=submit]");
  await page.waitForTimeout(6000);
  const afterUrl = page.url();
  results.push({
    label: "05-signin-valid",
    url: afterUrl.replace(BASE, ""),
    status: afterUrl.includes("/auth/signin") ? "ISSUE: stayed on signin page" : "OK: redirected",
    shot: rel(path.join(OUT, "05-signin-valid.png")),
  });
  await page.screenshot({ path: path.join(OUT, "05-signin-valid.png") });
  await ctx.close();
});

// ---------- login once, reuse storage ----------
let state = null;
await safe("login", async () => {
  const { ctx, page } = await newPage(browser, "login");
  await page.goto(BASE + "/auth/signin", { waitUntil: "networkidle" });
  await page.fill("#email", "shivajitiwari@gmail.com");
  await page.fill("#password", "Pueblo421#");
  await page.click("button[type=submit]");
  await page.waitForTimeout(3000);
  // if the page does not redirect, follow to /dashboard manually to grab cookies
  if (page.url().includes("/auth/signin")) {
    await page.goto(BASE + "/dashboard", { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);
  }
  state = await ctx.storageState();
  results.push({
    label: "00-login-state",
    url: page.url().replace(BASE, ""),
    status: page.url().includes("/auth/signin") ? "still signed out" : "signed in",
    shot: "",
  });
  await ctx.close();
});

// ---------- 3. Authenticated app pages ----------
const appPages = [
  "/dashboard",
  "/leads",
  "/leads/new",
  "/leads/import",
  "/pipeline",
  "/conversations",
  "/chatbots",
  "/knowledge-base",
  "/campaigns",
  "/follow-ups",
  "/reports",
  "/settings",
  "/scoring-profiles",
  "/jobs",
  "/ai-usage",
  "/ai-providers",
  "/ai-models",
  "/ai-assignments",
  "/integrations",
  "/team",
  "/logout",
  "/profile",
  "/company",
  "/research",
  "/emails",
  "/activity",
];
for (const p of appPages) await visit(browser, p, `app-${slug(p)}`, state);

// ---------- 4. Functionality smoke tests ----------
await safe("func-sidebar-nav", async () => {
  const { ctx, page } = await newPage(browser, "func-sidebar", state);
  await page.goto(BASE + "/dashboard", { waitUntil: "networkidle" });
  const link = page.locator('aside a[href^="/"]').first();
  if ((await link.count()) === 0) {
    const html = await page.locator("body").innerText();
    results.push({ label: "06-sidebar-nav", url: "/dashboard", status: "no sidebar link found", shot: "" });
    consoleErrors.push("[sidebar] no aside nav link found. body=" + html.slice(0, 300));
  } else {
    const href = await link.getAttribute("href");
    await link.click();
    await page.waitForTimeout(1800);
    results.push({
      label: "06-sidebar-nav",
      url: page.url().replace(BASE, ""),
      status: page.url().includes(href ?? "/") ? "OK" : "FAIL",
      shot: "",
    });
  }
  await ctx.close();
});

await safe("func-leads-new", async () => {
  const { ctx, page } = await newPage(browser, "func-leads-new", state);
  await page.goto(BASE + "/leads/new", { waitUntil: "networkidle" });
  const btn = page.locator('button[type="submit"]').first();
  if ((await btn.count()) === 0) {
    results.push({ label: "07-leads-new-validation", url: "/leads/new", status: "no submit button", shot: "" });
  } else {
    await btn.click();
    await page.waitForTimeout(900);
    const body = await page.locator("body").innerText();
    results.push({
      label: "07-leads-new-validation",
      url: "/leads/new",
      status: /required|invalid|enter|min/i.test(body) ? "OK: validation shown" : "no visible validation",
      shot: rel(path.join(OUT, "07-leads-new-validation.png")),
    });
    await page.screenshot({ path: path.join(OUT, "07-leads-new-validation.png") });
  }
  await ctx.close();
});

await safe("func-theme", async () => {
  const { ctx, page } = await newPage(browser, "func-theme", state);
  await page.goto(BASE + "/dashboard", { waitUntil: "networkidle" });
  const btn = page.locator('button[title^="Switch to"]');
  if ((await btn.count()) === 0) {
    results.push({ label: "08-theme-toggle", url: "/dashboard", status: "no theme button", shot: "" });
  } else {
    await btn.click();
    await page.waitForTimeout(800);
    const cls = await page.locator("html").getAttribute("class");
    results.push({
      label: "08-theme-toggle",
      url: "/dashboard",
      status: `html.class="${cls}" ${cls?.includes("dark") ? "OK: dark enabled" : "ISSUE: not dark"}`,
      shot: "",
    });
  }
  results.push({
    label: "09-header-search",
    url: "/dashboard",
    status: (await page.locator('input[type="search"]').count()) ? "present" : "missing",
    shot: "",
  });
  await ctx.close();
});

await safe("func-signout", async () => {
  const { ctx, page } = await newPage(browser, "func-signout", state);
  await page.goto(BASE + "/dashboard", { waitUntil: "networkidle" });
  const so = page.locator("aside button", { hasText: "Sign out" });
  if ((await so.count()) === 0) {
    results.push({ label: "10-signout", url: "/dashboard", status: "no sign-out control", shot: "" });
  } else {
    await so.click();
    await page.waitForTimeout(3000);
    const signedOut = !page.url().includes("/dashboard");
    results.push({
      label: "10-signout",
      url: page.url().replace(BASE, ""),
      status: signedOut ? "OK: session cleared" : "ISSUE: still on dashboard",
      shot: rel(path.join(OUT, "10-signout.png")),
    });
    await page.screenshot({ path: path.join(OUT, "10-signout.png") });
  }
  await ctx.close();
});

await safe("func-mobile", async () => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, storageState: state });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => consoleErrors.push(`[func-mobile] ${e.message}`));
  await page.goto(BASE + "/dashboard", { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(OUT, "11-mobile-dashboard.png"), fullPage: false });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 5);
  results.push({
    label: "11-mobile-overflow",
    url: "/dashboard",
    status: overflow ? "ISSUE: horizontal overflow" : "OK",
    shot: rel(path.join(OUT, "11-mobile-dashboard.png")),
  });

  // Sidebar should be off-canvas on mobile, and open via the menu button
  const aside = page.locator("aside");
  const hiddenBefore = await aside.evaluate((el) => el.getBoundingClientRect().left < -10);
  await page.click('button[aria-label="Open main menu"]');
  await page.waitForTimeout(600);
  const shownAfter = await aside.evaluate((el) => el.getBoundingClientRect().left >= -10);
  await page.screenshot({ path: path.join(OUT, "12-mobile-menu-open.png") });
  results.push({
    label: "12-mobile-menu",
    url: "/dashboard",
    status: hiddenBefore && shownAfter ? "OK: drawer opens" : `ISSUE hiddenBefore=${hiddenBefore} shownAfter=${shownAfter}`,
    shot: rel(path.join(OUT, "12-mobile-menu-open.png")),
  });

  // Sidebar active-state highlighting
  const activeLink = await page
    .locator('aside a[aria-current="page"]')
    .first()
    .innerText()
    .catch(() => "(none)");
  results.push({ label: "13-active-nav", url: "/dashboard", status: `active=${activeLink}`, shot: "" });
  await ctx.close();
});

// ---------- 5. API smoke ----------
for (const api of ["/api/health", "/api/v1/leads", "/api/v1/campaigns", "/api/v1/jobs", "/api/v1/reports"]) {
  await visit(browser, api, `api-${slug(api)}`, state);
}

await browser.close();

fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify({ results, consoleErrors, failedRequests }, null, 2));

console.log("=== PAGE RESULTS ===");
for (const r of results) {
  console.log(
    `${String(r.status).padEnd(34)} ${String(r.styles ?? "").padEnd(12)} ${r.url} ${r.errorText ? "ERR-TEXT" : ""} ${
      r.notFound ? "404" : ""
    } ${r.redirected ? "REDIRECTED" : ""} ${r.ms ? r.ms + "ms" : ""}`
  );
}
console.log("\n=== CONSOLE ERRORS (" + consoleErrors.length + ") ===");
[...new Set(consoleErrors)].slice(0, 80).forEach((e) => console.log(e));
console.log("\n=== FAILED REQUESTS (" + failedRequests.length + ") ===");
[...new Set(failedRequests)].slice(0, 80).forEach((e) => console.log(e));
