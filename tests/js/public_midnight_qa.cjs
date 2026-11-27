/* Actual public guest markup/controllers; every request intercepted, no provider inference. */
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");

const root = path.resolve(__dirname, "../..");
const stat = path.join(root, "src/omakase/web/static");
const { chromium } = require(
  require.resolve("playwright", {
    paths: [process.env.OMAKASE_QA_NODE_MODULES || path.join(root, "node_modules")],
  }),
);

const out =
  process.env.OMAKASE_PUBLIC_QA_OUTPUT ||
  path.join(require("node:os").tmpdir(), "omakase-public-qa");
fs.mkdirSync(out, { recursive: true });

const selectedWidths = (
  process.env.OMAKASE_PUBLIC_QA_WIDTHS ||
  process.env.OMAKASE_PUBLIC_QA_WIDTH ||
  "320,390,1440,2560"
)
  .split(",")
  .map(Number);
assert(
  selectedWidths.length &&
    selectedWidths.every((width) => [320, 390, 1440, 2560].includes(width)),
  "finite supported QA widths",
);

const html = fs
  .readFileSync(path.join(root, "src/omakase/web/templates/index.html"), "utf8")
  .replaceAll("{{ asset_version }}", "qa")
  .replace("{% if default_profile %}{{ default_profile }}{% endif %}", "");

const picks = [
  {
    title: "Frieren: Beyond Journey's End",
    reasoning:
      "Synthetic QA response. Patient character writing and quiet journeys make this a thoughtful next watch, with enough time for each friendship to unfold.",
    best_match_from_history: "Mushishi",
    predicted_score: 9.1,
    url: "https://anilist.co/anime/154587/",
    cover_image: "https://s4.anilist.co/qa/frieren-poster.svg",
    banner_image: "https://s4.anilist.co/qa/frieren-banner.svg",
    genres: ["Adventure", "Drama", "Fantasy"],
    episodes: 28,
    format: "TV",
    studio: "Madhouse",
  },
  {
    title:
      "Code Geass: Akito the Exiled / A Four-Line Title for Narrow Screens / Extended Edition",
    reasoning:
      "Synthetic QA response. This longer title exercises the returned-menu layout without shortening the model explanation or the link destination.",
    best_match_from_history: "Code Geass: Lelouch of the Rebellion",
    predicted_score: 8.4,
    url: "https://anilist.co/anime/8888/",
    cover_image: "https://s4.anilist.co/qa/geass-poster.svg",
    banner_image: "https://s4.anilist.co/qa/geass-banner.svg",
    genres: ["Action", "Mecha"],
    episodes: 5,
    format: "OVA",
    studio: "Sunrise",
  },
  {
    title: "BLEACH: Thousand-Year Blood War",
    reasoning: "",
    best_match_from_history: "",
    predicted_score: null,
    url: "javascript:alert(1)",
  },
];

const syntheticPosterSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 340"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#2a2230"/><stop offset="100%" stop-color="#131115"/></linearGradient></defs><rect width="240" height="340" fill="url(#g)"/><circle cx="120" cy="120" r="54" fill="#E2A35E" opacity="0.25"/></svg>`;
const syntheticBannerSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 320"><defs><linearGradient id="b" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stop-color="#1d1826"/><stop offset="50%" stop-color="#302420"/><stop offset="100%" stop-color="#151218"/></linearGradient></defs><rect width="1200" height="320" fill="url(#b)"/></svg>`;

const receipt = {
  checks: [],
  pageErrors: [],
  unexpected: [],
  sourceSha256: {},
  limitations: [
    "Actual source HTML/CSS/JS with synthetic intercepted provider outcomes. No real inference, paid request, account credential, production DB, or media access. Browser emulation does not establish physical phone or creative acceptance.",
  ],
};

for (const name of [
  "style.css",
  "public-theme.css",
  "result_menu.css",
  "url_safety.js",
  "app.js",
  "menu_receipt.js",
  "menu_study.js",
  "geist-variable.woff2",
  "fraunces-400.woff2",
]) {
  receipt.sourceSha256[name] = crypto
    .createHash("sha256")
    .update(fs.readFileSync(path.join(stat, name)))
    .digest("hex");
}
for (const name of ["server.py", "templates/index.html"]) {
  receipt.sourceSha256[name] = crypto
    .createHash("sha256")
    .update(fs.readFileSync(path.join(root, "src/omakase/web", name)))
    .digest("hex");
}

(async () => {
  const browser = await chromium.launch({
    headless: true,
    ...(process.env.OMAKASE_QA_BROWSER_EXECUTABLE
      ? { executablePath: process.env.OMAKASE_QA_BROWSER_EXECUTABLE }
      : process.env.OMAKASE_QA_BROWSER_CHANNEL
        ? { channel: process.env.OMAKASE_QA_BROWSER_CHANNEL }
        : process.platform === "win32"
          ? { channel: "msedge" }
          : {}),
  });
  try {
    for (const [width, motion] of [
      [320, "reduce"],
      [390, "no-preference"],
      [1440, "no-preference"],
      [2560, "reduce"],
    ].filter(([w]) => selectedWidths.includes(w))) {
      const context = await browser.newContext({
        viewport: { width, height: width < 600 ? 844 : 1000 },
        reducedMotion: motion,
      });
      const page = await context.newPage();
      let mode = "results";
      let posts = 0;
      let deletes = 0;
      let polls = 0;
      let modelQueries = 0;
      page.on("pageerror", (e) => receipt.pageErrors.push(e.message));

      await page.route("**/*", async (route) => {
        const req = route.request();
        const url = new URL(req.url());
        if (url.origin === "https://s4.anilist.co" && url.pathname.startsWith("/qa/")) {
          return route.fulfill({
            contentType: "image/svg+xml",
            body: url.pathname.includes("banner") ? syntheticBannerSvg : syntheticPosterSvg,
          });
        }
        if (url.origin !== "http://public.test") {
          receipt.unexpected.push(url.origin);
          return route.abort();
        }
        if (url.pathname === "/") {
          return route.fulfill({ contentType: "text/html", body: html });
        }
        if (url.pathname.startsWith("/static/")) {
          const file = path.resolve(stat, url.pathname.slice("/static/".length));
          if (file.startsWith(stat + path.sep) && fs.existsSync(file)) {
            return route.fulfill({ path: file });
          }
        }
        if (url.pathname === "/api/providers/models" && req.method() === "POST") {
          modelQueries++;
          const body = req.postDataJSON();
          if (body.llm_type === "openrouter") {
            return route.fulfill({
              status: 200,
              json: {
                provider: "openrouter",
                source: "live_public",
                key_verified: false,
                models: [
                  { id: "openai/gpt-6.2-sol", name: "OpenAI: GPT-6.2 Sol", tier: "balanced", context_length: 1050000, is_free: false },
                  { id: "anthropic/claude-sonnet-5.5", name: "Anthropic: Claude Sonnet 5.5", tier: "balanced", context_length: 1000000, is_free: false },
                  { id: "deepseek/deepseek-v4-pro", name: "DeepSeek: V4 Pro", tier: "reasoning", context_length: 1048576, is_free: false },
                  { id: "meta-llama/llama-3.3-70b-instruct:free", name: "Llama 3.3 70B Free", tier: "fast", context_length: 131072, is_free: true },
                  { id: "google/gemini-4-hydrogen", name: "Google: Gemini 4 Hydrogen", tier: "balanced", context_length: 1048576, is_free: false },
                  { id: "qwen/qwen3-32b", name: "Qwen 3 32B", tier: "balanced", context_length: 131072, is_free: false },
                ],
              },
            });
          }
          return route.fulfill({
            status: 200,
            json: {
              provider: body.llm_type,
              source: "live",
              key_verified: true,
              models: [
                { id: "gpt-6-luna", name: "GPT-6 Luna", tier: "fast", context_length: 1050000, is_free: false },
                { id: "gpt-6.2-astra", name: "GPT-6.2 Astra", tier: "flagship", context_length: 1050000, is_free: false },
                { id: "gpt-6.2-astra-pro", name: "GPT-6.2 Astra Pro", tier: "reasoning", context_length: 1050000, is_free: false },
              ],
            },
          });
        }
        if (url.pathname === "/api/recommend/jobs" && req.method() === "POST") {
          posts++;
          const body = req.postDataJSON();
          assert.equal(body.api_key, "synthetic-not-a-provider-key");
          assert.equal(body.username, "synthetic-viewer");
          return route.fulfill({ status: 202, json: { job_id: "qa-job" } });
        }
        if (url.pathname === "/api/recommend/jobs/qa-job" && req.method() === "DELETE") {
          deletes++;
          return route.fulfill({ json: { status: "cancelled" } });
        }
        if (url.pathname === "/api/recommend/jobs/qa-job") {
          polls++;
          return route.fulfill({
            json:
              mode === "error"
                ? { status: "error", detail: "Synthetic provider failure. Please try another model." }
                : mode === "loading"
                  ? { status: "running" }
                  : {
                      status: "done",
                      source: "anilist",
                      username: "synthetic-viewer",
                      recommendations: mode === "empty" ? [] : picks,
                    },
          });
        }
        receipt.unexpected.push(`${req.method()} ${url.pathname}`);
        return route.fulfill({ status: 404, body: "" });
      });

      async function check(state) {
        const headingSpace = await page.locator(".counter-notes h2").evaluate((e) => {
          const text = e.textContent.replace(/\s+/g, " ").trim();
          const parts = [...e.childNodes].filter((n) => n.nodeType === Node.TEXT_NODE);
          if (parts.length !== 2) return { text, readable: false };
          const a = document.createRange();
          const b = document.createRange();
          a.setStart(parts[0], parts[0].length - 1);
          a.setEnd(parts[0], parts[0].length);
          const start = parts[1].textContent.indexOf("A");
          b.setStart(parts[1], start);
          b.setEnd(parts[1], start + 1);
          const x = a.getBoundingClientRect();
          const y = b.getBoundingClientRect();
          return {
            text,
            readable: !e.getClientRects().length || Math.abs(x.bottom - y.bottom) > 2 || y.left - x.right >= 2,
          };
        });
        assert.equal(headingSpace.text, "A little preparation. A personal menu.");
        assert(headingSpace.readable, `${width} ${state}: heading sentences joined`);

        const overlaps = await page.locator(".course-nav__item").evaluateAll((els) =>
          els
            .filter((e) => e.getClientRects().length)
            .flatMap((e) => {
              const ar = document.createRange();
              const br = document.createRange();
              ar.selectNodeContents(e.querySelector("strong"));
              br.selectNodeContents(e.querySelector("small"));
              const a = ar.getBoundingClientRect();
              const b = br.getBoundingClientRect();
              return Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 &&
                Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1
                ? [e.textContent.trim()]
                : [];
            }),
        );
        assert.deepEqual(overlaps, [], `${width} ${state}: course label overlaps status`);

        await page.evaluate(() => document.fonts.ready);
        const data = await page.evaluate(() => ({
          overflow: document.documentElement.scrollWidth > innerWidth + 1,
          bg: getComputedStyle(document.body).backgroundColor,
          font: getComputedStyle(document.body).fontFamily,
          displayFont: getComputedStyle(document.querySelector("h1")).fontFamily,
          logoCount: [...document.querySelectorAll(".choice-card__logo img")].filter(
            (img) => img.complete && img.naturalWidth > 0,
          ).length,
          small: [
            ...document.querySelectorAll(
              ".field__hint,.choice-card small,.course-nav__item small,.result-menu-label",
            ),
          ]
            .filter((e) => e.getClientRects().length)
            .filter((e) => parseFloat(getComputedStyle(e).fontSize) < 13.9)
            .map((e) => e.className),
        }));
        assert(!data.overflow, `${width} ${state}: overflow`);
        assert.equal(data.bg, "rgb(11, 10, 12)");
        assert(data.font.includes("Geist"));
        assert(data.displayFont.includes("Fraunces"));
        assert.equal(data.logoCount, 6);
        assert.deepEqual(data.small, [], `${width} ${state}: tiny labels`);
        receipt.checks.push({ width, motion, state, noOverflow: true });
      }

      async function capture(state) {
        await page.screenshot({ path: path.join(out, `${width}-${state}.png`), fullPage: false });
      }

      await page.goto("http://public.test/", { waitUntil: "networkidle" });
      await check("initial");
      assert.equal(
        await page
          .locator("#account-login-link, #account-home-link, #watching-dialog, #watched-dialog, #recommend-again")
          .count(),
        0,
      );
      await capture("initial");
      assert.equal(posts, 0);
      assert.equal(await page.locator("#profile").inputValue(), "", "fresh guest notes are empty");
      assert.notEqual(
        await page.locator('[data-receipt="taste"]').innerText(),
        "Taste notes added",
        "no invented taste receipt",
      );

      await page.getByRole("link", { name: "Prepare my menu", exact: true }).click();
      await page.evaluate(async () => {
        let last = scrollY;
        let stable = 0;
        for (let i = 0; i < 180; i++) {
          await new Promise(requestAnimationFrame);
          stable = Math.abs(scrollY - last) < 0.5 ? stable + 1 : 0;
          last = scrollY;
          if (stable >= 6) break;
        }
      });
      await capture("counter-entry");

      // Test illustrated example study
      await page.locator(".menu-study summary").click();
      await page.locator('[data-example-pick="4"]').click();
      assert.equal(await page.locator('[data-example-pick="4"]').getAttribute("aria-pressed"), "true");
      assert(await page.locator('[data-example-card="4"]').isVisible());
      await check("illustrated-example");
      await page.locator(".menu-study summary").click();

      // Test OpenRouter live model catalog + tier pills + search + custom ID
      await page.locator("label.choice-card").filter({ has: page.locator('input[value="openrouter"]') }).click();
      await page.locator("#model-search").waitFor({ state: "visible" });
      await page.locator('.tier-pill[data-tier="free"]').click();
      assert.equal(await page.locator(".model-option").count(), 1);
      await page.locator('.tier-pill[data-tier="all"]').click();
      await page.locator("#model-search").fill("deepseek");
      assert.equal(await page.locator(".model-option").count(), 1);
      await page.locator("#model-search").fill("");
      await capture("openrouter-live-models");

      // Test OpenWebUI fields and validation
      await page.locator("label.choice-card").filter({ has: page.locator('input[value="openwebui"]') }).click();
      assert(await page.locator("#openwebui_url").isVisible());
      await check("custom-provider-fields");

      await page.locator("label.choice-card").filter({ has: page.locator('input[value="openai"]') }).click();
      await page.locator('[data-next-course="history"]:visible').click();
      assert(await page.locator("#error-banner").isVisible());
      assert.equal(await page.locator("#api_key").getAttribute("aria-invalid"), "true");
      await check("model-error");
      assert.equal(posts, 0);

      // Load live OpenAI models and select custom/flagship model
      await page.locator("#api_key").fill("synthetic-not-a-provider-key");
      await page.locator("#fetch-models-btn").click();
      await page.waitForFunction(() =>
        document.querySelector("#model-fetch-status").textContent.includes("Key verified"),
      );
      await page.locator("#model_override").fill("gpt-6.2-astra");
      assert.equal(await page.locator("#model").inputValue(), "gpt-6.2-astra");

      await page.locator('[data-next-course="history"]:visible').click();
      await page.locator("#username").fill("synthetic-viewer");
      await check("history");

      await page.locator(".source-switch label").filter({ has: page.locator('input[value="myanimelist"]') }).click();
      await page.locator("#mal_export_file").setInputFiles({
        name: `Synthetic-${"very-long-export-name-".repeat(12)}.xml`,
        mimeType: "application/xml",
        buffer: Buffer.from("<myanimelist/>"),
      });
      await page.waitForFunction(() => !document.querySelector("#upload-clear").hidden);
      await check("long-mal-export");
      await page.locator("#upload-clear").click();
      await page.locator(".source-switch label").filter({ has: page.locator('input[value="anilist"]') }).click();

      await page.locator('[data-next-course="taste"]:visible').click();
      await page.locator("#skip_profile").check();
      await check("taste");

      mode = "loading";
      await page.locator("#run-btn").click();
      await page.locator("#loading").waitFor({ state: "visible" });
      await check("loading");
      await capture("loading");
      await page.locator("#cancel-request").click();
      await page.locator("#error-banner").waitFor({ state: "visible" });
      assert((await page.locator("#error-text").innerText()).includes("cancelled"));
      await check("cancelled");

      mode = "error";
      await page.locator("#run-btn").click();
      await page.waitForFunction(() =>
        document.querySelector("#error-text").textContent.includes("Synthetic provider failure"),
      );
      await check("provider-error");
      await capture("provider-error");

      mode = "empty";
      await page.locator("#run-btn").click();
      await page.locator("#results .empty-state").waitFor({ state: "visible" });
      await check("empty");
      await page.locator("#start-over").click();

      await page.locator("#api_key").fill("synthetic-not-a-provider-key");
      await page.locator('[data-next-course="history"]:visible').click();
      await page.locator('[data-next-course="taste"]:visible').click();
      mode = "results";
      await page.locator("#run-btn").click();
      await page.locator("#results-list .recommendation").first().waitFor({ state: "visible" });
      assert.equal(await page.locator(".recommendation").count(), 3);
      assert.equal(await page.locator(".recommendation__cover").count(), 2);
      assert.equal(await page.locator(".recommendation__banner-img").count(), 2);
      assert.equal(await page.locator("#api_key").inputValue(), "");
      assert((await page.locator(".recommendation").nth(2).innerText()).includes("Not provided"));
      assert.equal(await page.locator(".recommendation").nth(2).locator(".recommendation__link").count(), 0);
      await check("results");
      await capture("results");

      const compare = page.locator(".recommendation__compare .result-menu-button");
      await compare.nth(0).focus();
      await page.keyboard.press("Enter");
      await compare.nth(1).click();
      assert.equal(await page.locator(".result-menu-comparison__pick").count(), 2);
      assert(await compare.nth(2).isDisabled());
      await page.locator(".result-menu-comparison-link").first().click();
      await check("comparison");
      await capture("comparison");

      const bounds = await page
        .locator(".result-menu-comparison__pick")
        .evaluateAll((els) =>
          els.map((e) => ({ left: e.getBoundingClientRect().left, right: e.getBoundingClientRect().right })),
        );
      if (width > 760) assert(bounds[0].right <= bounds[1].left + 1);

      await page.locator("#results-compare-clear").click();
      assert.equal(await page.locator("#results-comparison").isVisible(), false);
      assert.equal(
        await compare.nth(0).evaluate((e) => e === document.activeElement),
        true,
      );
      const checks = await page
        .locator(".button:visible")
        .evaluateAll((els) => els.map((e) => ({ text: e.textContent.trim(), height: e.getBoundingClientRect().height })));
      assert(checks.every((e) => e.height >= 44), JSON.stringify(checks));
      await check("keyboard-clear");
      assert.equal(posts, 4);
      assert(modelQueries >= 2);
      receipt.checks.push({
        width,
        fixturePosts: posts,
        fixtureDeletes: deletes,
        fixturePolls: polls,
        modelQueries,
        keyCleared: true,
        unsafeUrlSuppressed: true,
      });
      await context.close();
    }
    assert.deepEqual(receipt.pageErrors, []);
    assert.deepEqual(receipt.unexpected, []);
    fs.writeFileSync(path.join(out, "receipt.json"), JSON.stringify(receipt, null, 2));
    console.log(`${receipt.checks.length} checks passed; ${out}/receipt.json`);
  } finally {
    await browser.close();
  }
})().catch((e) => {
  fs.writeFileSync(path.join(out, "failure.json"), JSON.stringify({ ...receipt, failure: e.stack }, null, 2));
  console.error(e);
  process.exitCode = 1;
});
