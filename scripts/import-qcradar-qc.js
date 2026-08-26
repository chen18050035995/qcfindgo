const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { chromium } = require("playwright");

const root = path.resolve(__dirname, "..");
const productsPath = path.join(root, "products.js");
const outputPath = path.join(root, "qc-images.js");
const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

const args = new Map(process.argv.slice(2).map((arg) => {
  const [key, value = "true"] = arg.replace(/^--/, "").split("=");
  return [key, value];
}));

const limit = Number(args.get("limit") || 0);
const offset = Number(args.get("offset") || 0);
const concurrency = Math.max(1, Number(args.get("concurrency") || 3));
const waitMs = Math.max(3000, Number(args.get("wait") || 9000));
const findSlugOnly = args.get("slugs") === "true";

const loadWindowFile = (file, globalName) => {
  if (!fs.existsSync(file)) return {};
  const code = fs.readFileSync(file, "utf8");
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);
  return sandbox.window[globalName];
};

const products = loadWindowFile(productsPath, "PRODUCTS");
if (!Array.isArray(products)) {
  throw new Error("products.js did not expose window.PRODUCTS");
}

const existing = loadWindowFile(outputPath, "QC_IMAGES") || {};
const results = { ...existing };

const normalizeImage = (url) => {
  try {
    const parsed = new URL(url);
    if (parsed.hostname === "qcradar.com" && parsed.pathname === "/_next/image") {
      const inner = parsed.searchParams.get("url");
      return inner ? decodeURIComponent(inner) : url;
    }
    return url;
  } catch {
    return url;
  }
};

const uniqueQcImages = (urls, itemId) => {
  const seen = new Set();
  return urls
    .map(normalizeImage)
    .filter((url) => url.includes(`img.qcradar.com/qc/weidian-${itemId}/`))
    .filter((url) => /\.(webp|jpe?g|png)(\?|$)/i.test(url))
    .filter((url) => {
      if (seen.has(url)) return false;
      seen.add(url);
      return true;
    })
    .slice(0, 10);
};

const inferPlatform = (product) => {
  const url = String(product.url || "");
  if (url.includes("weidian.com")) return "weidian";
  if (url.includes("1688.com")) return "1688";
  if (url.includes("taobao.com") || url.includes("tmall.com")) return "taobao";
  return "";
};

const writeOutput = () => {
  const ordered = Object.fromEntries(
    Object.entries(results)
      .filter(([, images]) => Array.isArray(images) && images.length)
      .sort(([a], [b]) => a.localeCompare(b))
  );
  const content = `window.QC_IMAGES = ${JSON.stringify(ordered, null, 2)};\n`;
  fs.writeFileSync(outputPath, content);
};

const candidates = products
  .map((product) => ({
    itemId: String(product.sourceItemId || "").trim(),
    platform: inferPlatform(product),
    title: product.title || ""
  }))
  .filter((product) => product.itemId && product.platform === "weidian")
  .slice(offset, limit ? offset + limit : undefined);

let cursor = 0;
let checked = 0;
let matched = 0;

const scrapeOne = async (page, product) => {
  const key = `${product.platform}:${product.itemId}`;
  if (Array.isArray(results[key]) && results[key].length >= 10) {
    return { key, skipped: true, count: results[key].length };
  }

  const seenUrls = new Set();
  const responseHandler = (response) => {
    const url = response.url();
    if (url.includes(`img.qcradar.com/qc/weidian-${product.itemId}/`)) {
      seenUrls.add(url);
    }
  };

  page.on("response", responseHandler);
  try {
    await page.goto("https://qcradar.com/zh", { waitUntil: "domcontentloaded", timeout: 45000 });
    const lookup = await page.evaluate(async (itemId) => {
      const response = await fetch("https://api.qcradar.com/api/source/finalize", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ platform: "weidian", itemId })
      });
      const data = await response.json().catch(() => ({}));
      return { ok: response.ok, status: response.status, ...data };
    }, product.itemId);

    if (!lookup?.found || !lookup?.slug) {
      if (lookup?.statusCode === 429 || lookup?.status === 429) {
        await page.goto(`https://qcradar.com/zh/lookup/weidian/${product.itemId}`, {
          waitUntil: "domcontentloaded",
          timeout: 45000
        });
        await page.waitForTimeout(waitMs + 3000);
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)).catch(() => {});
        await page.waitForTimeout(2000);
        const domUrls = await page.evaluate(() => [...document.images].map((image) => image.currentSrc || image.src).filter(Boolean));
        const images = uniqueQcImages([...seenUrls, ...domUrls], product.itemId);
        if (images.length) {
          results[key] = images;
          matched += 1;
        }
        return { key, count: images.length, status: "fallback-after-429" };
      }
      return { key, count: 0, status: lookup?.status || lookup?.statusCode || "not-found" };
    }

    if (findSlugOnly) {
      return { key, count: 0, slug: lookup.slug };
    }

    await page.goto(`https://qcradar.com/zh/p/${lookup.slug}`, {
      waitUntil: "domcontentloaded",
      timeout: 45000
    });
    await page.waitForTimeout(waitMs);
    await page.evaluate(() => window.scrollTo(0, Math.max(0, document.body.scrollHeight * 0.55))).catch(() => {});
    await page.waitForTimeout(1500);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)).catch(() => {});
    await page.waitForTimeout(1500);

    const domUrls = await page.evaluate(() => {
      const imageUrls = [...document.images].map((image) => image.currentSrc || image.src);
      const sourceUrls = [...document.querySelectorAll("source[srcset]")]
        .flatMap((source) => String(source.getAttribute("srcset") || "").split(",").map((entry) => entry.trim().split(/\s+/)[0]));
      return [...imageUrls, ...sourceUrls].filter(Boolean);
    });

    const images = uniqueQcImages([...seenUrls, ...domUrls], product.itemId);
    if (images.length) {
      results[key] = images;
      matched += 1;
    }
    return { key, count: images.length, slug: lookup.slug };
  } catch (error) {
    return { key, error: error.message };
  } finally {
    page.off("response", responseHandler);
  }
};

(async () => {
  console.log(`Checking ${candidates.length} products, concurrency ${concurrency}, wait ${waitMs}ms`);
  const browser = await chromium.launch({
    headless: true,
    executablePath: fs.existsSync(chromePath) ? chromePath : undefined
  });

  const worker = async (index) => {
    const page = await browser.newPage({ viewport: { width: 1400, height: 1200 } });
    while (cursor < candidates.length) {
      const product = candidates[cursor++];
      const result = await scrapeOne(page, product);
      checked += 1;
      const status = result.error ? `error ${result.error}` : `${result.count} QC${result.status ? ` (${result.status})` : ""}`;
      console.log(`[${checked}/${candidates.length}] worker ${index} ${result.key}: ${status}`);
      if (checked % 10 === 0) writeOutput();
    }
    await page.close();
  };

  await Promise.all(Array.from({ length: concurrency }, (_, index) => worker(index + 1)));
  await browser.close();
  writeOutput();
  console.log(`Done. Checked ${checked}, matched ${matched}, saved ${Object.keys(results).length} products with QC images.`);
})();
