const fs = require("fs");
const path = require("path");
const vm = require("vm");
const config = require("./seo-config");

const root = process.cwd();
const today = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Shanghai",
  year: "numeric",
  month: "2-digit",
  day: "2-digit"
}).format(new Date());

const ensureDir = (dir) => fs.mkdirSync(path.join(root, dir), { recursive: true });
const write = (file, content) => {
  const full = path.join(root, file);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
};

const escapeHtml = (value) => String(value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;");

const slugify = (value) => String(value || "item")
  .toLowerCase()
  .replace(/&/g, " and ")
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-+|-+$/g, "")
  .slice(0, 90) || "item";

const truncate = (value, max) => {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text.length <= max ? text : `${text.slice(0, max - 1).trim()}…`;
};

const loadProducts = () => {
  const code = fs.readFileSync(path.join(root, "products.js"), "utf8");
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);
  return Array.isArray(sandbox.window.PRODUCTS) ? sandbox.window.PRODUCTS : [];
};

const products = loadProducts().filter((product) => product?.image && !String(product.image).includes("unsplash"));

const categoryLabel = (category) => config.categoryLabels[category] || category;
const getBrand = (product) => String(product.brand || product.subcategory || "Streetwear").trim();
const getCategory = (product) => product.category || "streetwear";

const usedSlugs = new Map();
const productSlug = (product) => {
  const base = slugify(`${getBrand(product)} ${product.title || "product"} ${product.sourceItemId || ""}`);
  const used = usedSlugs.get(base) || 0;
  usedSlugs.set(base, used + 1);
  return used ? `${base}-${used + 1}` : base;
};

const productRecords = products.map((product) => ({
  ...product,
  _brand: getBrand(product),
  _category: getCategory(product),
  _slug: productSlug(product)
}));

const byBrand = new Map();
const byCategory = new Map();
productRecords.forEach((product) => {
  byBrand.set(product._brand, [...(byBrand.get(product._brand) || []), product]);
  byCategory.set(product._category, [...(byCategory.get(product._category) || []), product]);
});

const nav = `
  <header class="topbar">
    <a class="logo" href="/" aria-label="qcfindgo home"><span>QC</span><strong>qcfindgo</strong></a>
    <nav class="main-nav" aria-label="Main navigation">
      <a href="/brands/">Brands</a>
      <a href="/categories/">Categories</a>
      <a href="/finds/">Finds</a>
      <a href="/keywords/">Keywords</a>
      <a href="/agents/">Agents</a>
      <a href="/compare/">Compare</a>
      <a href="/blog/">Guides</a>
      <a href="/contact/">Contact</a>
    </nav>
    <nav class="tools" aria-label="Shop tools">
      <a href="/categories/sneakers/">Sneakers</a>
      <a href="/categories/hoodies/">Hoodies</a>
      <a href="/brands/nike/">Nike</a>
    </nav>
  </header>`;

const layout = ({ title, description, canonical, h1, content, schema }) => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(truncate(title, 62))}</title>
    <meta name="description" content="${escapeHtml(truncate(description, 155))}" />
    <meta name="robots" content="index, follow" />
    <meta name="theme-color" content="#080a14" />
    <link rel="canonical" href="${escapeHtml(canonical)}" />
    <meta property="og:title" content="${escapeHtml(truncate(title, 62))}" />
    <meta property="og:description" content="${escapeHtml(truncate(description, 155))}" />
    <meta property="og:url" content="${escapeHtml(canonical)}" />
    <meta property="og:type" content="website" />
    <link rel="stylesheet" href="/styles.css?v=20260823a" />
    ${schema ? `<script type="application/ld+json">${JSON.stringify(schema)}</script>` : ""}
  </head>
  <body>
    ${nav}
    <main class="seo-main">
      <section class="seo-hero">
        <p class="eyebrow">QC finder for ${escapeHtml(config.targetMarkets)}</p>
        <h1>${escapeHtml(h1)}</h1>
        <p>${escapeHtml(description)}</p>
      </section>
      ${content}
    </main>
  </body>
</html>
`;

const cardGrid = (items) => `
  <div class="seo-grid">
    ${items.map((item) => `
      <div class="seo-card">
        <a class="seo-card-main" href="${escapeHtml(item.href)}">
          ${item.image ? `<img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.alt)}" loading="lazy" />` : ""}
          <span>${escapeHtml(item.label)}</span>
          <small>${escapeHtml(item.meta)}</small>
        </a>
        ${item.buyHref ? `<a class="card-buy-link" href="${escapeHtml(item.buyHref)}" rel="nofollow sponsored noopener noreferrer" target="_blank">Buy with ${escapeHtml(item.buyLabel || "agent")}</a>` : ""}
      </div>
    `).join("")}
  </div>`;

const agentPriority = ["Loongbuy", "Lovegobuy", "Superbuy", "AllChinaBuy", "CSSBuy", "Kakobuy", "Oopbuy", "AcBuy"];

const agentEntries = (product) => {
  const links = product.agentLinks && typeof product.agentLinks === "object" ? product.agentLinks : {};
  return Object.entries(links)
    .filter(([, url]) => /^https?:\/\//.test(String(url || "")))
    .sort((a, b) => {
      const aIndex = agentPriority.indexOf(a[0]);
      const bIndex = agentPriority.indexOf(b[0]);
      return (aIndex === -1 ? 99 : aIndex) - (bIndex === -1 ? 99 : bIndex);
    });
};

const productCardItems = (items, preferredAgent = "") => items.slice(0, 36).map((product) => {
  const entries = agentEntries(product);
  const preferred = preferredAgent
    ? entries.find(([name]) => name.toLowerCase() === preferredAgent.toLowerCase())
    : null;
  const buyEntry = preferred || entries[0];

  return {
    href: `/products/${product._slug}/`,
    image: product.image,
    alt: `${product.title} QC photos`,
    label: product.title || `${product._brand} find`,
    meta: `${product._brand} - ${categoryLabel(product._category)}`,
    buyHref: buyEntry?.[1],
    buyLabel: buyEntry?.[0]
  };
});

const agentButtons = (product) => {
  const entries = agentEntries(product).slice(0, 8);

  if (!entries.length) return "";

  return `
    <section class="buy-panel" aria-labelledby="buy-options-title">
      <h2 id="buy-options-title">Buy with an agent</h2>
      <p>Choose an agent route to open this item. Compare service fees, shipping routes, QC photo policy, and final landed cost before ordering.</p>
      <div class="agent-button-grid">
        ${entries.map(([name, url]) => `<a class="seo-button buy-button" href="${escapeHtml(url)}" rel="nofollow sponsored noopener noreferrer" target="_blank">Buy with ${escapeHtml(name)}</a>`).join("")}
      </div>
    </section>
  `;
};

const schemaOrg = (type, data) => ({ "@context": "https://schema.org", "@type": type, ...data });

const pageUrls = ["/"];

[
  "about",
  "agents",
  "blog",
  "brands",
  "categories",
  "compare",
  "contact",
  "finds",
  "keywords",
  "new-finds",
  "privacy-policy",
  "qc-disclaimer",
  "products",
  "returns",
  "shipping",
  "terms"
].forEach((dir) => {
  fs.rmSync(path.join(root, dir), { recursive: true, force: true });
});

ensureDir("brands");
ensureDir("categories");
ensureDir("agents");
ensureDir("compare");
ensureDir("finds");
ensureDir("keywords");
ensureDir("new-finds");
ensureDir("products");
ensureDir("blog");
ensureDir("seo");

const topBrands = [...byBrand.entries()].sort((a, b) => b[1].length - a[1].length);
const topCategories = [...byCategory.entries()].sort((a, b) => b[1].length - a[1].length);

const agentPageConfig = config.agentPages || [];
const comparePageConfig = config.comparePages || [];

const productsForAgent = (agentName) => productRecords
  .filter((product) => agentEntries(product).some(([name]) => name.toLowerCase() === agentName.toLowerCase()))
  .slice(0, 36);

const productsForAgents = (agentNames) => productRecords
  .filter((product) => agentEntries(product).some(([name]) => agentNames.some((agent) => agent.toLowerCase() === name.toLowerCase())))
  .slice(0, 36);

const searchProducts = (terms, limit = 36) => {
  const normalized = terms.map((term) => String(term).toLowerCase());
  return productRecords
    .filter((product) => {
      const haystack = [
        product.title,
        product.originalTitle,
        product._brand,
        product._category,
        product.subcategory,
        product.sourceItemId
      ].join(" ").toLowerCase();
      return normalized.every((term) => haystack.includes(term));
    })
    .slice(0, limit);
};

const internalLinkList = (items) => `
  <div class="seo-link-grid">
    ${items.map((item) => `<a href="${escapeHtml(item.href)}">${escapeHtml(item.label)}</a>`).join("")}
  </div>`;

const faqItems = [
  {
    question: "What is a QC finder page?",
    answer: "A QC finder page helps shoppers compare product photos, item IDs, prices, categories, and agent-ready links before opening a source listing."
  },
  {
    question: "Should I check QC photos before buying?",
    answer: "Yes. Check shape, logo placement, stitching, material texture, color tone, sizing notes, and whether the listing has enough clear product photos."
  },
  {
    question: "Does qcfindgo sell products directly?",
    answer: "No. qcfindgo is a product discovery and QC research site. Orders, shipping, returns, and refunds are handled by the selected seller or shopping agent."
  }
];

const faqSection = (items = faqItems) => `
  <section class="seo-copy faq-block">
    <h2>FAQ</h2>
    ${items.map((item) => `
      <h3>${escapeHtml(item.question)}</h3>
      <p>${escapeHtml(item.answer)}</p>
    `).join("")}
  </section>`;

const faqSchema = (items = faqItems) => schemaOrg("FAQPage", {
  mainEntity: items.map((item) => ({
    "@type": "Question",
    name: item.question,
    acceptedAnswer: {
      "@type": "Answer",
      text: item.answer
    }
  }))
});

const qcChecklistSection = (title = "QC checklist") => `
  <section class="seo-copy">
    <h2>${escapeHtml(title)}</h2>
    <ul>
      <li>Compare product photos with the expected retail shape, color, and overall proportions.</li>
      <li>Check logo placement, print alignment, stitching, hardware, tags, and material texture.</li>
      <li>For shoes, review toe box, heel shape, sole thickness, panel alignment, and sizing notes.</li>
      <li>Compare item ID, price, seller notes, agent fees, shipping route, and final landed cost.</li>
    </ul>
  </section>`;

const buyerProcessSection = (keyword) => `
  <section class="seo-copy">
    <h2>How to use this ${escapeHtml(keyword)} page</h2>
    <ol>
      <li>Open several related product cards instead of choosing the first listing.</li>
      <li>Compare QC photos, item IDs, price notes, brand page, and category page.</li>
      <li>Use the agent button only after checking fees, shipping route, delivery timing, and support policy.</li>
      <li>Save similar products so you can compare materials, sizing, and final cost before ordering.</li>
    </ol>
  </section>`;

const trustSection = `
  <section class="seo-copy trust-block">
    <h2>Why this page is useful</h2>
    <p>qcfindgo keeps product discovery pages focused on visible product information: QC-style images, brand labels, category paths, item IDs, prices, and available agent routes. This helps US and Europe shoppers compare options before leaving for a source listing.</p>
    <p>For site questions or corrections, contact <a href="mailto:${escapeHtml(config.contactEmail)}">${escapeHtml(config.contactEmail)}</a>. You can also review our <a href="/about/">About</a>, <a href="/shipping/">Shipping Notes</a>, and <a href="/returns/">Returns and Refunds</a> pages.</p>
  </section>`;

write("brands/index.html", layout({
  title: "Brand Reps Spreadsheet | W2C Finds, QC Photos and Agents",
  description: "Browse Nike, Adidas, Louis Vuitton, Dior, Gucci and streetwear brand reps with W2C links, QC photos, agent prices, and product pages.",
  canonical: `${config.siteUrl}/brands/`,
  h1: "Brand Reps Spreadsheet and QC Finder",
  content: cardGrid(topBrands.slice(0, 60).map(([brand, items]) => ({
    href: `/brands/${slugify(brand)}/`,
    label: brand,
    meta: `${items.length} W2C and QC finds`,
    image: items[0]?.image,
    alt: `${brand} QC finds`
  }))),
  schema: schemaOrg("CollectionPage", { name: "Streetwear Brands QC Finder" })
}));
pageUrls.push("/brands/");

topBrands.slice(0, 80).forEach(([brand, items]) => {
  const slug = slugify(brand);
  write(`brands/${slug}/index.html`, layout({
    title: `${brand} Reps Spreadsheet | W2C Links, QC Photos and Agents`,
    description: `Explore ${brand} reps spreadsheet finds with W2C links, QC photos, product details, agent prices, sneakers, streetwear apparel, and bags.`,
    canonical: `${config.siteUrl}/brands/${slug}/`,
    h1: `${brand} Reps Spreadsheet and QC Photos`,
    content: `
      <section class="seo-copy">
        <h2>${escapeHtml(brand)} W2C product discovery</h2>
        <p>Use this ${escapeHtml(brand)} reps spreadsheet page to compare W2C links, QC photos, item IDs, categories, prices, and agent links before opening a product page.</p>
        <p>Popular searches for this page include ${escapeHtml(brand)} reps, ${escapeHtml(brand)} QC photos, ${escapeHtml(brand)} W2C links, and ${escapeHtml(brand)} agent spreadsheet finds.</p>
      </section>
      ${buyerProcessSection(`${brand} reps spreadsheet`)}
      ${qcChecklistSection(`${brand} QC checklist`)}
      ${cardGrid(productCardItems(items))}
      <section class="seo-copy"><h2>Related categories and agents</h2><p>Browse sneakers, hoodies, T-shirts, designer shoes, bags, and accessories to build a stronger streetwear shortlist.</p>${internalLinkList([{ href: "/categories/sneakers/", label: "Sneaker reps spreadsheet" }, { href: "/agents/loongbuy/", label: "LoongBuy spreadsheet" }, { href: "/compare/best-agent-for-sneakers/", label: "Best agent for sneaker reps" }])}</section>
      ${faqSection()}
      ${trustSection}
    `,
    schema: [schemaOrg("CollectionPage", { name: `${brand} QC Finds`, about: brand }), faqSchema()]
  }));
  pageUrls.push(`/brands/${slug}/`);
});

write("categories/index.html", layout({
  title: "Reps Categories Spreadsheet | Sneakers, Hoodies, Bags and Tees",
  description: "Browse reps categories with W2C links, QC photos, agent prices, sneakers, hoodies, T-shirts, designer shoes, bags, watches, and accessories.",
  canonical: `${config.siteUrl}/categories/`,
  h1: "Reps Categories Spreadsheet",
  content: cardGrid(topCategories.map(([category, items]) => ({
    href: `/categories/${category}/`,
    label: categoryLabel(category),
    meta: `${items.length} W2C finds`,
    image: items[0]?.image,
    alt: `${categoryLabel(category)} QC finds`
  }))),
  schema: schemaOrg("CollectionPage", { name: "Streetwear Categories" })
}));
pageUrls.push("/categories/");

topCategories.forEach(([category, items]) => {
  const label = categoryLabel(category);
  write(`categories/${category}/index.html`, layout({
    title: `${label} Reps Spreadsheet | W2C Links, QC Photos and Agents`,
    description: `Browse ${label.toLowerCase()} reps spreadsheet finds with W2C links, QC photos, brand filters, agent prices, and US or Europe buyer notes.`,
    canonical: `${config.siteUrl}/categories/${category}/`,
    h1: `${label} Reps Spreadsheet and QC Photos`,
    content: `
      <section class="seo-copy">
        <h2>${escapeHtml(label)} W2C buying notes</h2>
        <p>Compare W2C links, QC photos, prices, item IDs, and brand signals before choosing a ${escapeHtml(label.toLowerCase())} find. Prioritize clear QC photos, consistent sizing information, and trusted agent pages.</p>
        <p>This page targets ${escapeHtml(label.toLowerCase())} reps, ${escapeHtml(label.toLowerCase())} spreadsheet, ${escapeHtml(label.toLowerCase())} QC photos, and ${escapeHtml(label.toLowerCase())} W2C links.</p>
      </section>
      ${buyerProcessSection(`${label.toLowerCase()} reps spreadsheet`)}
      ${qcChecklistSection(`${label} QC checklist`)}
      ${cardGrid(productCardItems(items))}
      <section class="seo-copy"><h2>Related agent pages</h2>${internalLinkList(agentPageConfig.slice(0, 6).map((agent) => ({ href: `/agents/${agent.slug}/`, label: agent.keyword })))}</section>
      ${faqSection()}
      ${trustSection}
    `,
    schema: [schemaOrg("CollectionPage", { name: `${label} QC Finds` }), faqSchema()]
  }));
  pageUrls.push(`/categories/${category}/`);
});

const brandCategoryPairs = [];
byBrand.forEach((brandItems, brand) => {
  const categoryCounts = new Map();
  brandItems.forEach((product) => {
    categoryCounts.set(product._category, (categoryCounts.get(product._category) || 0) + 1);
  });
  categoryCounts.forEach((count, category) => {
    if (count >= 2) {
      brandCategoryPairs.push({
        brand,
        category,
        count,
        items: brandItems.filter((product) => product._category === category)
      });
    }
  });
});

brandCategoryPairs.sort((a, b) => {
  const aPrimary = (config.primaryBrands.includes(a.brand) ? 1000 : 0) + (config.primaryCategories.includes(a.category) ? 500 : 0);
  const bPrimary = (config.primaryBrands.includes(b.brand) ? 1000 : 0) + (config.primaryCategories.includes(b.category) ? 500 : 0);
  return (bPrimary + b.count) - (aPrimary + a.count);
});

write("finds/index.html", layout({
  title: "W2C Finds by Brand and Category | QC Photos and Agents",
  description: "Browse long-tail W2C finds by brand and category, including Nike sneakers, Adidas shoes, Louis Vuitton bags, Dior sneakers, Gucci tees, hoodies, and accessories.",
  canonical: `${config.siteUrl}/finds/`,
  h1: "W2C Finds by Brand and Category",
  content: `
    <section class="seo-copy">
      <h2>Long-tail reps spreadsheet pages</h2>
      <p>These pages combine brand, category, QC photos, W2C links, item IDs, and agent options. They are designed for high-intent searches such as Nike sneaker reps, Gucci T-shirt QC photos, Dior sneaker W2C links, and Louis Vuitton bag finds.</p>
    </section>
    ${cardGrid(brandCategoryPairs.slice(0, 160).map((pair) => ({
      href: `/finds/${slugify(pair.brand)}-${pair.category}/`,
      label: `${pair.brand} ${categoryLabel(pair.category)} Finds`,
      meta: `${pair.count} W2C and QC product pages`,
      image: pair.items[0]?.image,
      alt: `${pair.brand} ${categoryLabel(pair.category)} QC photos`
    })))}
  `,
  schema: schemaOrg("CollectionPage", { name: "W2C Finds by Brand and Category" })
}));
pageUrls.push("/finds/");

brandCategoryPairs.slice(0, 160).forEach((pair) => {
  const brandSlug = slugify(pair.brand);
  const label = categoryLabel(pair.category);
  const slug = `${brandSlug}-${pair.category}`;
  write(`finds/${slug}/index.html`, layout({
    title: `${pair.brand} ${label} Reps | W2C Links, QC Photos and Agents`,
    description: `Compare ${pair.brand} ${label.toLowerCase()} reps with W2C links, QC photos, prices, item IDs, and agent-ready buying routes for US and Europe buyers.`,
    canonical: `${config.siteUrl}/finds/${slug}/`,
    h1: `${pair.brand} ${label} Reps and QC Photos`,
    content: `
      <section class="seo-copy">
        <h2>${escapeHtml(pair.brand)} ${escapeHtml(label)} W2C shortlist</h2>
        <p>This long-tail page groups ${escapeHtml(pair.brand)} ${escapeHtml(label.toLowerCase())} finds so shoppers can compare QC photos, product titles, source item IDs, prices, and agent buttons before opening a listing.</p>
        <p>Search intent covered: ${escapeHtml(pair.brand)} ${escapeHtml(label.toLowerCase())} reps, ${escapeHtml(pair.brand)} ${escapeHtml(label.toLowerCase())} spreadsheet, ${escapeHtml(pair.brand)} ${escapeHtml(label.toLowerCase())} QC photos, and ${escapeHtml(pair.brand)} ${escapeHtml(label.toLowerCase())} W2C links.</p>
      </section>
      ${buyerProcessSection(`${pair.brand} ${label.toLowerCase()} reps`)}
      ${qcChecklistSection(`${pair.brand} ${label} QC checklist`)}
      ${cardGrid(productCardItems(pair.items))}
      <section class="seo-copy"><h2>Related pages</h2>${internalLinkList([
        { href: `/brands/${brandSlug}/`, label: `${pair.brand} reps spreadsheet` },
        { href: `/categories/${pair.category}/`, label: `${label} reps spreadsheet` },
        { href: "/agents/kakobuy/", label: "Kakobuy spreadsheet" },
        { href: "/compare/best-agent-for-sneakers/", label: "Best agent for sneaker reps" }
      ])}</section>
      ${faqSection()}
      ${trustSection}
    `,
    schema: [schemaOrg("CollectionPage", { name: `${pair.brand} ${label} W2C Finds`, about: `${pair.brand} ${label}` }), faqSchema()]
  }));
  pageUrls.push(`/finds/${slug}/`);
});

const recentProducts = productRecords.slice(0, 72);
write("new-finds/index.html", layout({
  title: "New W2C Finds | Latest QC Photos, Agent Links and Prices",
  description: "Browse the latest W2C finds synced from Nova Finds Go with QC photos, agent links, item IDs, streetwear products, sneakers, hoodies, bags, and accessories.",
  canonical: `${config.siteUrl}/new-finds/`,
  h1: "New W2C Finds and QC Photos",
  content: `
      <section class="seo-copy">
        <h2>Latest synced product finds</h2>
        <p>This page highlights newly synced product pages from Nova Finds Go. Use it to discover recent sneakers, hoodies, designer shoes, bags, accessories, and streetwear products with QC photos and agent-ready links.</p>
      </section>
      ${buyerProcessSection("new W2C finds")}
      ${cardGrid(productCardItems(recentProducts))}
      ${qcChecklistSection("New product QC checklist")}
      ${internalLinkList([
        { href: "/finds/", label: "Brand and category finds" },
        { href: "/keywords/", label: "Long-tail keyword pages" },
        { href: "/blog/how-to-use-a-reps-spreadsheet-safely/", label: "Spreadsheet safety guide" }
      ])}
    `,
  schema: schemaOrg("CollectionPage", { name: "New W2C Finds" })
}));
pageUrls.push("/new-finds/");

const keywordLandingPages = [
  { slug: "nike-sneaker-reps", title: "Nike Sneaker Reps", terms: ["nike", "sneaker"], fallback: "/brands/nike/", description: "Compare Nike sneaker reps with W2C links, QC photos, product IDs, prices, and agent buying routes." },
  { slug: "adidas-samba-reps", title: "Adidas Samba Reps", terms: ["adidas", "samba"], fallback: "/brands/adidas/", description: "Browse Adidas Samba reps, QC photos, W2C links, agent routes, and similar Adidas sneaker finds." },
  { slug: "louis-vuitton-bag-reps", title: "Louis Vuitton Bag Reps", terms: ["louis vuitton", "bag"], fallback: "/brands/louis-vuitton/", description: "Find Louis Vuitton bag reps with QC photos, product IDs, W2C links, and agent-ready buying options." },
  { slug: "dior-sneaker-reps", title: "Dior Sneaker Reps", terms: ["dior", "sneaker"], fallback: "/brands/dior/", description: "Compare Dior sneaker reps with QC photos, source IDs, W2C links, prices, and agent options." },
  { slug: "gucci-t-shirt-reps", title: "Gucci T-Shirt Reps", terms: ["gucci", "t-shirt"], fallback: "/brands/gucci/", description: "Browse Gucci T-shirt reps with QC photos, W2C links, item IDs, prices, and agent routes." },
  { slug: "black-hoodie-reps", title: "Black Hoodie Reps", terms: ["hoodie"], fallback: "/categories/hoodies/", description: "Explore black hoodie and streetwear hoodie reps with QC photo checks, W2C links, prices, and agents." },
  { slug: "designer-shoes-qc-photos", title: "Designer Shoes QC Photos", terms: ["designer-shoes"], fallback: "/categories/designer-shoes/", description: "Review designer shoes QC photos, W2C links, brand pages, prices, and agent-ready product routes." },
  { slug: "streetwear-spreadsheet-us-buyers", title: "Streetwear Spreadsheet for US Buyers", terms: ["nike"], fallback: "/", description: "Use this streetwear spreadsheet for US buyers to compare QC photos, W2C links, agent prices, and shipping routes." },
  { slug: "streetwear-spreadsheet-europe-buyers", title: "Streetwear Spreadsheet for Europe Buyers", terms: ["adidas"], fallback: "/", description: "Use this streetwear spreadsheet for Europe buyers to compare QC photos, W2C links, agent choices, and product categories." },
  { slug: "best-qc-photo-finds", title: "Best QC Photo Finds", terms: ["sneaker"], fallback: "/categories/sneakers/", description: "Browse high-intent QC photo finds across sneakers, hoodies, bags, designer shoes, accessories, and agent pages." },
  { slug: "best-sneaker-reps-spreadsheet", title: "Best Sneaker Reps Spreadsheet", terms: ["sneaker"], fallback: "/categories/sneakers/", description: "Compare sneaker reps spreadsheet finds with QC photos, W2C links, item IDs, agent prices, and US or Europe buying notes." },
  { slug: "nike-dunk-low-reps", title: "Nike Dunk Low Reps", terms: ["nike", "dunk"], fallback: "/brands/nike/", description: "Browse Nike Dunk Low reps with QC photos, W2C links, seller item IDs, prices, and agent-ready product routes." },
  { slug: "nike-air-force-1-reps", title: "Nike Air Force 1 Reps", terms: ["nike", "air force"], fallback: "/brands/nike/", description: "Compare Nike Air Force 1 reps with QC photos, source links, item IDs, prices, and agent buying options." },
  { slug: "adidas-yeezy-reps", title: "Adidas Yeezy Reps", terms: ["adidas", "yeezy"], fallback: "/brands/adidas/", description: "Find Adidas Yeezy reps with QC photo checks, W2C links, sneaker sizing notes, prices, and agent links." },
  { slug: "gucci-bag-reps", title: "Gucci Bag Reps", terms: ["gucci", "bag"], fallback: "/brands/gucci/", description: "Browse Gucci bag reps with QC photos, hardware checks, W2C links, item IDs, prices, and agent options." },
  { slug: "louis-vuitton-sneaker-reps", title: "Louis Vuitton Sneaker Reps", terms: ["louis vuitton", "sneaker"], fallback: "/brands/louis-vuitton/", description: "Compare Louis Vuitton sneaker reps with QC photos, shape checks, W2C links, prices, and agent buying routes." },
  { slug: "dior-bag-reps", title: "Dior Bag Reps", terms: ["dior", "bag"], fallback: "/brands/dior/", description: "Review Dior bag reps with QC photo checks, logo placement notes, item IDs, W2C links, and agent prices." },
  { slug: "designer-hoodie-reps", title: "Designer Hoodie Reps", terms: ["hoodie"], fallback: "/categories/hoodies/", description: "Explore designer hoodie reps with QC photos, print placement checks, sizing notes, W2C links, and agent routes." },
  { slug: "streetwear-t-shirt-reps", title: "Streetwear T-Shirt Reps", terms: ["t-shirt"], fallback: "/categories/tshirts/", description: "Browse streetwear T-shirt reps with QC photos, print checks, brand pages, prices, W2C links, and agent options." },
  { slug: "designer-belt-reps", title: "Designer Belt Reps", terms: ["belt"], fallback: "/categories/other-accessories/", description: "Compare designer belt reps with QC photos, buckle details, material checks, item IDs, W2C links, and agent prices." },
  { slug: "rep-shoes-with-qc-photos", title: "Rep Shoes with QC Photos", terms: ["shoe"], fallback: "/categories/designer-shoes/", description: "Find rep shoes with QC photos, W2C links, sizing checks, source item IDs, prices, and agent-ready routes." },
  { slug: "w2c-sneakers-for-us-buyers", title: "W2C Sneakers for US Buyers", terms: ["sneaker"], fallback: "/categories/sneakers/", description: "Browse W2C sneakers for US buyers with QC photos, item IDs, agent prices, route notes, and product comparisons." },
  { slug: "w2c-streetwear-for-europe-buyers", title: "W2C Streetwear for Europe Buyers", terms: ["hoodie"], fallback: "/categories/hoodies/", description: "Use this W2C streetwear page for Europe buyers comparing QC photos, agent routes, product IDs, and category pages." },
  { slug: "cheap-streetwear-finds", title: "Cheap Streetwear Finds", terms: ["t-shirt"], fallback: "/categories/tshirts/", description: "Compare affordable streetwear finds with QC photos, prices, W2C links, item IDs, brand pages, and agent options." },
  { slug: "qc-photo-checklist-for-reps", title: "QC Photo Checklist for Reps", terms: ["sneaker"], fallback: "/blog/how-to-use-qc-photos-before-buying-streetwear/", description: "Use this QC photo checklist for reps to compare images, material, shape, stitching, labels, sizing, W2C links, and agents." }
];

write("keywords/index.html", layout({
  title: "Long-Tail Keywords | Reps Spreadsheet, W2C Finds and QC Photos",
  description: "Browse long-tail keyword pages for Nike sneaker reps, Adidas Samba reps, Louis Vuitton bags, Dior sneakers, Gucci tees, QC photos, and agent spreadsheets.",
  canonical: `${config.siteUrl}/keywords/`,
  h1: "Long-Tail Keyword Pages",
  content: cardGrid(keywordLandingPages.map((page) => {
    const items = searchProducts(page.terms, 12);
    return {
      href: `/keywords/${page.slug}/`,
      label: page.title,
      meta: `${items.length || "Curated"} related finds`,
      image: items[0]?.image || productRecords[0]?.image,
      alt: `${page.title} QC photos`
    };
  })),
  schema: schemaOrg("CollectionPage", { name: "Long-Tail Keyword Pages" })
}));
pageUrls.push("/keywords/");

keywordLandingPages.forEach((page) => {
  let items = searchProducts(page.terms, 36);
  if (!items.length && page.fallback.startsWith("/brands/")) {
    const brandSlug = page.fallback.split("/").filter(Boolean).pop();
    const brandEntry = topBrands.find(([brand]) => slugify(brand) === brandSlug);
    items = brandEntry?.[1]?.slice(0, 36) || [];
  }
  if (!items.length && page.fallback.startsWith("/categories/")) {
    const categorySlug = page.fallback.split("/").filter(Boolean).pop();
    items = byCategory.get(categorySlug)?.slice(0, 36) || [];
  }
  if (!items.length) items = productRecords.slice(0, 36);

  write(`keywords/${page.slug}/index.html`, layout({
    title: `${page.title} | W2C Links, QC Photos and Agent Prices`,
    description: page.description,
    canonical: `${config.siteUrl}/keywords/${page.slug}/`,
    h1: `${page.title}: W2C Links and QC Photos`,
    content: `
      <section class="seo-copy">
        <h2>${escapeHtml(page.title)} buying intent</h2>
        <p>${escapeHtml(page.description)} This page is built for shoppers comparing product photos, item IDs, prices, categories, and agent buttons before choosing a route.</p>
        <p>Use the product cards below to move from keyword research into specific QC pages. For each item, check image clarity, material shape, sizing signals, seller notes, and final landed cost.</p>
      </section>
      ${buyerProcessSection(page.title)}
      ${qcChecklistSection(`${page.title} QC checklist`)}
      ${cardGrid(productCardItems(items))}
      <section class="seo-copy"><h2>Related pages</h2>${internalLinkList([
        { href: page.fallback, label: `Main ${page.title} page` },
        { href: "/finds/", label: "Brand and category W2C finds" },
        { href: "/agents/", label: "Agent spreadsheets" },
        { href: "/blog/how-to-use-a-reps-spreadsheet-safely/", label: "How to use a reps spreadsheet safely" }
      ])}</section>
      ${faqSection()}
    `,
    schema: [schemaOrg("CollectionPage", { name: page.title, about: page.title }), faqSchema()]
  }));
  pageUrls.push(`/keywords/${page.slug}/`);
});

write("agents/index.html", layout({
  title: "Agent Spreadsheets | LoongBuy, Kakobuy, Oopbuy, Superbuy",
  description: "Compare agent spreadsheet pages for LoongBuy, Kakobuy, Oopbuy, AllChinaBuy, Superbuy, CSSBuy, Lovegobuy, AcBuy, Sugargoo, and Orientdig.",
  canonical: `${config.siteUrl}/agents/`,
  h1: "Agent Spreadsheets and QC Finds",
  content: `
    <section class="seo-copy">
      <h2>Shopping agent keyword hub</h2>
      <p>Use these agent pages to browse W2C finds, QC photos, product pages, and buying routes by shopping agent. This structure helps match searches such as LoongBuy spreadsheet, Kakobuy spreadsheet, Oopbuy spreadsheet, and Superbuy reps spreadsheet.</p>
    </section>
    ${cardGrid(agentPageConfig.map((agent) => {
      const items = productsForAgent(agent.name);
      return {
        href: `/agents/${agent.slug}/`,
        label: agent.keyword,
        meta: `${items.length} agent-ready finds`,
        image: items[0]?.image,
        alt: `${agent.name} spreadsheet finds`
      };
    }))}
  `,
  schema: schemaOrg("CollectionPage", { name: "Agent Spreadsheets" })
}));
pageUrls.push("/agents/");

agentPageConfig.forEach((agent) => {
  const items = productsForAgent(agent.name);
  write(`agents/${agent.slug}/index.html`, layout({
    title: `${agent.name} Spreadsheet | W2C Links, QC Photos and Prices`,
    description: `Browse ${agent.name} spreadsheet finds with W2C links, QC photos, item IDs, product details, and streetwear buying notes for US and Europe buyers.`,
    canonical: `${config.siteUrl}/agents/${agent.slug}/`,
    h1: `${agent.name} Spreadsheet and QC Finder`,
    content: `
      <section class="seo-copy">
        <h2>${escapeHtml(agent.name)} W2C links and buying notes</h2>
        <p>This ${escapeHtml(agent.name)} spreadsheet page groups product finds that include an available ${escapeHtml(agent.name)} buying route. Compare QC photos, source item IDs, prices, brand pages, and related categories before ordering.</p>
        <p>Search intent covered: ${escapeHtml(agent.keyword)}, ${escapeHtml(agent.name)} reps spreadsheet, ${escapeHtml(agent.name)} W2C links, and ${escapeHtml(agent.name)} QC finds.</p>
      </section>
      ${cardGrid(productCardItems(items, agent.name))}
      <section class="seo-copy"><h2>Compare agents</h2>${internalLinkList(comparePageConfig.filter((page) => page.agents.includes(agent.name) || page.agents.includes(agent.name.replace("B", "b"))).slice(0, 4).map((page) => ({ href: `/compare/${page.slug}/`, label: page.title })))}</section>
    `,
    schema: schemaOrg("CollectionPage", { name: `${agent.name} Spreadsheet`, about: agent.name })
  }));
  pageUrls.push(`/agents/${agent.slug}/`);
});

write("compare/index.html", layout({
  title: "Agent Comparison Guides | Best Agents for Reps and QC Photos",
  description: "Compare Kakobuy, Oopbuy, LoongBuy, Superbuy, AllChinaBuy, CSSBuy and other agents for reps, QC photos, W2C links, and shipping routes.",
  canonical: `${config.siteUrl}/compare/`,
  h1: "Agent Comparison Guides",
  content: `
    <section class="seo-copy">
      <h2>Compare agents before opening W2C finds</h2>
      <p>These comparison pages target high-intent searches like Kakobuy vs Oopbuy, LoongBuy vs Superbuy, best agent for sneaker reps, best agent for US buyers, and best agent for Europe buyers.</p>
    </section>
    ${cardGrid(comparePageConfig.map((page) => ({
      href: `/compare/${page.slug}/`,
      label: page.title,
      meta: page.keyword,
      image: productsForAgents(page.agents)[0]?.image,
      alt: `${page.title} comparison`
    })))}
  `,
  schema: schemaOrg("CollectionPage", { name: "Agent Comparison Guides" })
}));
pageUrls.push("/compare/");

comparePageConfig.forEach((page) => {
  const items = productsForAgents(page.agents);
  write(`compare/${page.slug}/index.html`, layout({
    title: `${page.title} | Agent Prices, QC Photos and W2C Links`,
    description: page.description,
    canonical: `${config.siteUrl}/compare/${page.slug}/`,
    h1: `${page.title}: QC Photos and W2C Buying Routes`,
    content: `
      <section class="seo-copy">
        <h2>${escapeHtml(page.keyword)} quick comparison</h2>
        <p>${escapeHtml(page.description)} Use this page to compare product availability, QC photo review workflow, source links, agent button availability, service fees, and final landed cost.</p>
        <h2>What to compare</h2>
        <ul>
          <li>Whether the product page has a working W2C or agent link.</li>
          <li>QC photo clarity, seller notes, sizing information, and product category.</li>
          <li>Agent service fees, shipping route options, delivery timing, and support response.</li>
          <li>Final landed cost for United States or Europe buyers.</li>
        </ul>
        <h2>Related agent pages</h2>
        ${internalLinkList(page.agents.map((agentName) => {
          const agent = agentPageConfig.find((entry) => entry.name.toLowerCase() === agentName.toLowerCase());
          return { href: agent ? `/agents/${agent.slug}/` : "/agents/", label: `${agentName} spreadsheet` };
        }))}
      </section>
      ${cardGrid(productCardItems(items, page.agents[0]))}
    `,
    schema: schemaOrg("Article", {
      headline: page.title,
      description: page.description,
      author: { "@type": "Organization", name: "qcfindgo" },
      datePublished: today,
      dateModified: today
    })
  }));
  pageUrls.push(`/compare/${page.slug}/`);
});

productRecords.forEach((product) => {
  const title = product.title || `${product._brand} product`;
  const brand = product._brand;
  const category = categoryLabel(product._category);
  const canonical = `${config.siteUrl}/products/${product._slug}/`;
  const related = productRecords
    .filter((item) => item !== product && (item._brand === brand || item._category === product._category))
    .slice(0, 8);
  write(`products/${product._slug}/index.html`, layout({
    title: `${title} | W2C Link, QC Photos and Agent Prices`,
    description: `Review ${title} W2C link, QC photos, ${brand} product details, price notes, category links, and agent-ready buying options for US and Europe buyers.`,
    canonical,
    h1: title,
    content: `
      <section class="product-detail">
        <div class="product-media"><img src="${escapeHtml(product.image)}" alt="${escapeHtml(`${title} QC photos and product details`)}" loading="eager" /></div>
        <div class="product-copy">
            <p class="eyebrow">${escapeHtml(brand)} - ${escapeHtml(category)}</p>
            <h2>QC product overview</h2>
            <p>${escapeHtml(title)} is listed as a ${escapeHtml(category.toLowerCase())} find for shoppers comparing QC-style photos, item details, pricing, and agent options before opening the original product link.</p>
          <dl class="product-facts">
            <div><dt>Brand</dt><dd>${escapeHtml(brand)}</dd></div>
            <div><dt>Category</dt><dd><a href="/categories/${escapeHtml(product._category)}/">${escapeHtml(category)}</a></dd></div>
            <div><dt>Item ID</dt><dd>${escapeHtml(product.sourceItemId || "Check listing")}</dd></div>
            <div><dt>Price</dt><dd>${escapeHtml(product.price || product.priceCny || "Check agent")}</dd></div>
          </dl>
          <p>Use the images to check shape, material texture, print placement, stitching, tags, color tone, and overall streetwear styling. For sneakers, compare panels, sole shape, toe box, logo placement, and heel details.</p>
          <a class="seo-button" href="${escapeHtml(product.url || "/")}" rel="nofollow sponsored noopener noreferrer" target="_blank">Open original source</a>
        </div>
      </section>
      ${agentButtons(product)}
      <section class="seo-copy">
        <h2>QC checklist</h2>
        <ul>
          <li>Compare product photos with the expected retail shape and color.</li>
          <li>Check sizing notes before ordering for US or European fits.</li>
          <li>Review available agent links, shipping choices, and final landed cost.</li>
        </ul>
        <h2>FAQ</h2>
        <h3>What should I check first?</h3>
        <p>Start with clear QC photos, brand details, category fit, item ID, and whether the product page has enough images for comparison.</p>
        <h3>Is this page a retail product page?</h3>
        <p>No. qcfindgo is a QC finder and product discovery page that helps shoppers compare product information and find agent-ready links.</p>
      </section>
      <section class="seo-copy"><h2>Related finds</h2>${cardGrid(productCardItems(related))}</section>
    `,
    schema: [schemaOrg("Product", {
      name: title,
      brand: { "@type": "Brand", name: brand },
      image: [product.image],
      description: `${title} QC photos and product discovery details.`,
      sku: product.sourceItemId || product._slug,
      offers: {
        "@type": "Offer",
        priceCurrency: "USD",
        price: String(product.price || "").replace(/[^0-9.]/g, "") || "0",
        availability: "https://schema.org/InStock",
        url: canonical
      }
    }), faqSchema([
      {
        question: `What should I check first on ${title}?`,
        answer: "Start with clear QC photos, brand details, category fit, item ID, price, and whether the page has enough images for comparison."
      },
      {
        question: "Does qcfindgo sell this item directly?",
        answer: "No. qcfindgo is a QC finder and product discovery page. Orders, shipping, returns, and refunds depend on the selected seller or shopping agent."
      }
    ])]
  }));
  pageUrls.push(`/products/${product._slug}/`);
});

config.blogPosts.forEach((post) => {
  const relatedProducts = productRecords
    .filter((product) => config.primaryBrands.includes(product._brand) || config.primaryCategories.includes(product._category))
    .slice(0, 12);
  write(`blog/${post.slug}/index.html`, layout({
    title: `${post.title} - qcfindgo Guide`,
    description: post.description,
    canonical: `${config.siteUrl}/blog/${post.slug}/`,
    h1: post.title,
    content: `
      <article class="seo-copy">
        <h2>Quick answer</h2>
        <p>${escapeHtml(post.description)} Use qcfindgo to move from research to product discovery with clear categories, brand pages, and QC-style product photos.</p>
        <h2>How to evaluate a find</h2>
        <p>Start with the product title, brand, category, image clarity, item ID, and price. For sneakers and designer streetwear, compare shape, materials, print position, logo placement, and sizing notes before choosing an agent route.</p>
        <h2>Best internal pages to browse</h2>
        <p>Use <a href="/categories/sneakers/">sneaker finds</a>, <a href="/categories/hoodies/">hoodie finds</a>, <a href="/brands/nike/">Nike QC finds</a>, <a href="/brands/adidas/">Adidas QC finds</a>, and <a href="/brands/gucci/">Gucci QC finds</a> as starting points.</p>
        <h2>Buyer checklist for US and Europe</h2>
        <ul>
          <li>Check the product photos before judging a listing.</li>
          <li>Compare sizing information with your usual US/EU size.</li>
          <li>Review agent fees, shipping route, and estimated delivery time.</li>
          <li>Save multiple similar products before making a final choice.</li>
        </ul>
      </article>
      ${cardGrid(productCardItems(relatedProducts))}
    `,
    schema: schemaOrg("Article", {
      headline: post.title,
      description: post.description,
      author: { "@type": "Organization", name: "qcfindgo" },
      datePublished: today,
      dateModified: today
    })
  }));
  pageUrls.push(`/blog/${post.slug}/`);
});

write("blog/index.html", layout({
  title: "Streetwear QC Guides | Sneakers, Designer Brands and Finds",
  description: "Read streetwear QC guides for sneakers, designer brands, outfit ideas, product checks, and US/EU buyer research.",
  canonical: `${config.siteUrl}/blog/`,
  h1: "Streetwear QC Guides",
  content: cardGrid(config.blogPosts.map((post) => ({
    href: `/blog/${post.slug}/`,
    label: post.title,
    meta: post.keyword,
    image: "",
    alt: post.title
  }))),
  schema: schemaOrg("Blog", { name: "Streetwear QC Guides" })
}));
pageUrls.push("/blog/");

const simplePages = [
  {
    slug: "about",
    title: "About qcfindgo",
    description: "qcfindgo helps US and Europe shoppers browse QC-style product photos, streetwear categories, designer brand finds, and agent-ready product discovery links.",
    body: `
      <h2>What qcfindgo does</h2>
      <p>qcfindgo is a crawlable QC finder for streetwear and designer product research. The site organizes products by brand, category, agent route, long-tail keyword, and guide topic so shoppers can compare visible product details before opening a source listing.</p>
      <h2>Who this site is for</h2>
      <p>The site is built for United States and Europe shoppers who want to compare sneakers, hoodies, T-shirts, designer shoes, bags, accessories, item IDs, prices, and QC-style product photos in one place.</p>
      <h2>Editorial approach</h2>
      <p>Pages focus on practical checks: image clarity, logo placement, material texture, stitching, sizing notes, agent availability, and final landed cost. We do not process orders directly.</p>
    `
  },
  {
    slug: "contact",
    title: "Contact qcfindgo",
    description: `Contact qcfindgo at ${config.contactEmail} for site questions, product discovery feedback, or partnership requests.`,
    body: `
      <h2>Contact email</h2>
      <p>Email: <a href="mailto:${escapeHtml(config.contactEmail)}">${escapeHtml(config.contactEmail)}</a></p>
      <h2>What to send</h2>
      <p>You can send broken link reports, product correction requests, brand/category feedback, partnership questions, and technical issues related to qcfindgo pages.</p>
      <h2>Useful details</h2>
      <p>Please include the page URL, product title, item ID when available, and a short description of the issue so we can review it faster.</p>
    `
  },
  {
    slug: "privacy-policy",
    title: "Privacy Policy",
    description: "This privacy policy explains basic analytics, contact email handling, and site usage data for qcfindgo visitors.",
    body: `
      <h2>Information we use</h2>
      <p>qcfindgo may use basic analytics and server logs to understand page visits, device type, country-level traffic, and technical errors. Contact emails are used only to reply to your message.</p>
      <h2>Cookies and analytics</h2>
      <p>If analytics are enabled, they are used to measure SEO performance, page speed, indexing growth, and popular product discovery pages.</p>
      <h2>Third-party links</h2>
      <p>Product and agent links may open third-party websites. Their privacy policies and checkout processes are separate from qcfindgo.</p>
    `
  },
  {
    slug: "terms",
    title: "Terms of Use",
    description: "These terms explain how visitors can use qcfindgo as a product discovery and QC finder website.",
    body: `
      <h2>Product discovery only</h2>
      <p>qcfindgo provides product discovery pages, QC-style research notes, category pages, and external links. We do not operate as the seller, shopping agent, payment processor, or logistics provider.</p>
      <h2>Use your own judgment</h2>
      <p>Always review source listings, seller terms, agent fees, shipping routes, and local import rules before making a purchase decision.</p>
      <h2>Content accuracy</h2>
      <p>Product data, prices, and link availability can change. We try to keep pages useful, but you should confirm details on the source listing or agent page.</p>
    `
  },
  {
    slug: "shipping",
    title: "Shipping Notes",
    description: "qcfindgo is a product discovery website. Shipping times, fees, and routes depend on the selected agent or source listing.",
    body: `
      <h2>Shipping depends on the selected agent</h2>
      <p>qcfindgo does not ship products directly. Shipping cost, delivery time, insurance, customs handling, and route availability depend on the shopping agent or seller you choose.</p>
      <h2>US and Europe buyer checks</h2>
      <p>Before ordering, compare estimated weight, shipping line, declared value policy, tracking support, delivery timing, and the final landed cost.</p>
      <h2>Before shipping a haul</h2>
      <p>Review all QC photos carefully, confirm size and color, remove unwanted packaging if needed, and compare multiple routes before submitting a parcel.</p>
    `
  },
  {
    slug: "returns",
    title: "Returns and Refunds",
    description: "qcfindgo does not process orders directly. Return and refund policies depend on the selected agent, seller, or purchase platform.",
    body: `
      <h2>Returns are handled outside qcfindgo</h2>
      <p>Because qcfindgo is a discovery site, return windows, refund rules, exchange options, and cancellation policies depend on the source seller or shopping agent.</p>
      <h2>Reduce return risk</h2>
      <p>Check QC photos before shipping, confirm item ID, compare size charts, inspect color and logo placement, and ask the agent for more photos when the listing is unclear.</p>
      <h2>Keep records</h2>
      <p>Save screenshots, item IDs, order numbers, QC photos, and agent chat records in case you need support from the seller or agent.</p>
    `
  },
  {
    slug: "qc-disclaimer",
    title: "QC Disclaimer",
    description: "qcfindgo is an independent QC finder and product discovery website. It does not sell products directly or guarantee third-party listings.",
    body: `
      <h2>Independent product research</h2>
      <p>qcfindgo organizes public product discovery information into brand, category, keyword, guide, and product pages. References to brands are used to help shoppers identify and compare product styles.</p>
      <h2>No direct selling</h2>
      <p>The site does not sell products directly, handle payments, ship parcels, or control third-party agent services. Always verify listings, seller terms, and local laws before purchasing.</p>
      <h2>QC is a comparison process</h2>
      <p>QC photos can help you compare visible details, but they do not guarantee materials, durability, sizing, shipping outcome, or authenticity claims.</p>
    `
  }
];

simplePages.forEach(({ slug, title, description, body }) => {
  write(`${slug}/index.html`, layout({
    title: `${title} - qcfindgo`,
    description,
    canonical: `${config.siteUrl}/${slug}/`,
    h1: title,
    content: `<section class="seo-copy"><p>${escapeHtml(description)}</p>${body}<p>Browse <a href="/brands/">brand QC finds</a>, <a href="/categories/">streetwear categories</a>, <a href="/keywords/">long-tail keyword pages</a>, and <a href="/blog/">QC guides</a>.</p></section>`,
    schema: schemaOrg("WebPage", { name: title, description })
  }));
  pageUrls.push(`/${slug}/`);
});

const keywordRows = [
  ["keyword","type","intent","target_page","priority","notes"],
  ["nike sneaker qc photos","brand","commercial","/brands/nike/","high","US and Europe sneaker discovery"],
  ["adidas samba qc finder","brand","commercial","/brands/adidas/","high","Long-tail Adidas sneaker query"],
  ["louis vuitton bag qc photos","brand","commercial","/brands/louis-vuitton/","high","Designer bag QC page"],
  ["dior sneakers qc finder","brand","commercial","/brands/dior/","high","Dior was provided as DIRO; site uses Dior"],
  ["gucci t shirt qc photos","brand","commercial","/brands/gucci/","high","Designer apparel long-tail"],
  ["streetwear sneakers qc","core","commercial","/categories/sneakers/","high","Category page"],
  ["designer shoes qc photos","core","commercial","/categories/designer-shoes/","high","Category page"],
  ["streetwear hoodie qc finder","core","commercial","/categories/hoodies/","medium","Category page"],
  ["reps spreadsheet","core","commercial","/","high","Homepage primary keyword"],
  ["w2c finds","core","commercial","/","high","Homepage primary keyword"],
  ["qc photos","core","commercial","/","high","Homepage primary keyword"],
  ["agent prices","core","commercial","/agents/","high","Agent hub"],
  ["loongbuy spreadsheet","agent","commercial","/agents/loongbuy/","high","Agent page"],
  ["kakobuy spreadsheet","agent","commercial","/agents/kakobuy/","high","Agent page"],
  ["oopbuy spreadsheet","agent","commercial","/agents/oopbuy/","high","Agent page"],
  ["allchinabuy spreadsheet","agent","commercial","/agents/allchinabuy/","medium","Agent page"],
  ["superbuy spreadsheet","agent","commercial","/agents/superbuy/","medium","Agent page"],
  ["cssbuy spreadsheet","agent","commercial","/agents/cssbuy/","medium","Agent page"],
  ["kakobuy vs oopbuy","compare","commercial","/compare/kakobuy-vs-oopbuy/","high","Comparison page"],
  ["loongbuy vs superbuy","compare","commercial","/compare/loongbuy-vs-superbuy/","high","Comparison page"],
  ["best agent for sneaker reps","compare","commercial","/compare/best-agent-for-sneakers/","high","Comparison page"],
  ["best agent for us buyers","compare","commercial","/compare/best-agent-for-us-buyers/","medium","Comparison page"],
  ["best agent for europe buyers","compare","commercial","/compare/best-agent-for-europe-buyers/","medium","Comparison page"],
  ["nike reps spreadsheet","brand","commercial","/brands/nike/","high","Brand page"],
  ["adidas reps spreadsheet","brand","commercial","/brands/adidas/","high","Brand page"],
  ["louis vuitton reps spreadsheet","brand","commercial","/brands/louis-vuitton/","high","Brand page"],
  ["dior reps spreadsheet","brand","commercial","/brands/dior/","high","Brand page"],
  ["gucci reps spreadsheet","brand","commercial","/brands/gucci/","high","Brand page"],
  ["nike sneaker reps","long-tail","commercial","/keywords/nike-sneaker-reps/","high","Keyword landing page"],
  ["adidas samba reps","long-tail","commercial","/keywords/adidas-samba-reps/","high","Keyword landing page"],
  ["louis vuitton bag reps","long-tail","commercial","/keywords/louis-vuitton-bag-reps/","high","Keyword landing page"],
  ["dior sneaker reps","long-tail","commercial","/keywords/dior-sneaker-reps/","high","Keyword landing page"],
  ["gucci t shirt reps","long-tail","commercial","/keywords/gucci-t-shirt-reps/","high","Keyword landing page"],
  ["black hoodie reps","long-tail","commercial","/keywords/black-hoodie-reps/","medium","Keyword landing page"],
  ["designer shoes qc photos","long-tail","commercial","/keywords/designer-shoes-qc-photos/","high","Keyword landing page"],
  ["best sneaker reps spreadsheet","long-tail","commercial","/keywords/best-sneaker-reps-spreadsheet/","high","Keyword landing page"],
  ["nike dunk low reps","long-tail","commercial","/keywords/nike-dunk-low-reps/","high","Keyword landing page"],
  ["nike air force 1 reps","long-tail","commercial","/keywords/nike-air-force-1-reps/","high","Keyword landing page"],
  ["adidas yeezy reps","long-tail","commercial","/keywords/adidas-yeezy-reps/","high","Keyword landing page"],
  ["gucci bag reps","long-tail","commercial","/keywords/gucci-bag-reps/","medium","Keyword landing page"],
  ["louis vuitton sneaker reps","long-tail","commercial","/keywords/louis-vuitton-sneaker-reps/","high","Keyword landing page"],
  ["dior bag reps","long-tail","commercial","/keywords/dior-bag-reps/","medium","Keyword landing page"],
  ["designer hoodie reps","long-tail","commercial","/keywords/designer-hoodie-reps/","medium","Keyword landing page"],
  ["streetwear t shirt reps","long-tail","commercial","/keywords/streetwear-t-shirt-reps/","medium","Keyword landing page"],
  ["designer belt reps","long-tail","commercial","/keywords/designer-belt-reps/","medium","Keyword landing page"],
  ["rep shoes with qc photos","long-tail","commercial","/keywords/rep-shoes-with-qc-photos/","high","Keyword landing page"],
  ["w2c sneakers for us buyers","long-tail","commercial","/keywords/w2c-sneakers-for-us-buyers/","medium","Keyword landing page"],
  ["w2c streetwear for europe buyers","long-tail","commercial","/keywords/w2c-streetwear-for-europe-buyers/","medium","Keyword landing page"],
  ["cheap streetwear finds","long-tail","commercial","/keywords/cheap-streetwear-finds/","medium","Keyword landing page"],
  ["qc photo checklist for reps","long-tail","research","/keywords/qc-photo-checklist-for-reps/","high","Keyword landing page"],
  ["new w2c finds","freshness","commercial","/new-finds/","high","Fresh product page"],
  ["nike sneakers reps","brand-category","commercial","/finds/nike-sneakers/","high","Brand/category long-tail page"],
  ["adidas sneakers reps","brand-category","commercial","/finds/adidas-sneakers/","high","Brand/category long-tail page"],
  ["gucci tshirts reps","brand-category","commercial","/finds/gucci-tshirts/","high","Brand/category long-tail page"],
  ["how to use qc photos","informational","research","/blog/how-to-use-qc-photos-before-buying-streetwear/","high","Blog guide"],
  ["best streetwear sneakers us europe","informational","research","/blog/best-streetwear-sneakers-for-us-and-europe-buyers/","medium","Blog guide"],
  ["nike sneaker reps qc checklist","informational","research","/blog/nike-sneaker-reps-qc-checklist/","high","Blog guide"],
  ["adidas samba reps buying guide","informational","research","/blog/adidas-samba-reps-buying-guide/","high","Blog guide"],
  ["designer bag qc photos","informational","research","/blog/designer-bag-qc-photo-guide/","medium","Blog guide"],
  ["hoodie reps qc photos","informational","research","/blog/best-hoodie-reps-with-qc-photos/","medium","Blog guide"]
];
write("seo/keywords.csv", keywordRows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n"));

write("seo/seo-plan.md", `# qcfindgo SEO Execution Plan

## Positioning
- Markets: United States and Europe
- Categories: shoes, sneakers, and streetwear apparel
- Brands: Nike, Adidas, Louis Vuitton, Dior, Gucci
- Route: QC finder + streetwear product discovery + editorial guides

## 30-Day Priorities
1. Verify Google Search Console and submit /sitemap.xml.
2. Monitor indexing for homepage, brand pages, category pages, and product pages.
3. Publish two English guides per week under /blog/.
4. Improve product copy for top 100 products by clicks or impressions.
5. Build social profiles and 5-10 safe citations after indexing begins.
6. Keep /new-finds/, /finds/, and /keywords/ refreshed whenever Nova Finds Go adds products.
7. Review GSC queries weekly and add 10-20 new long-tail pages for searches with impressions but low average position.
8. Keep trust pages updated: About, Contact, Shipping Notes, Returns, Terms, Privacy Policy, and QC Disclaimer.

## Weekly Content Cadence
- 1 brand or category guide
- 1 buyer checklist or outfit guide
- Add internal links to 5-10 product pages per article
- Refresh long-tail brand/category pages after each product sync
- Add FAQ blocks to priority pages that receive impressions
- Expand the top 20 product pages with clearer sizing, material, QC, and agent route notes

## Priority Long-Tail Clusters
- Nike: Nike sneaker reps, Nike Dunk Low reps, Nike Air Force 1 reps
- Adidas: Adidas Samba reps, Adidas Yeezy reps
- Designer: Louis Vuitton bag reps, Louis Vuitton sneaker reps, Dior sneaker reps, Dior bag reps, Gucci T-shirt reps, Gucci bag reps
- Category: designer hoodie reps, streetwear T-shirt reps, rep shoes with QC photos, designer belt reps
- Market: W2C sneakers for US buyers, W2C streetwear for Europe buyers

## Off-Page Rule
Avoid bulk paid links, automated comments, PBN links, or irrelevant directories. Prioritize Pinterest, Instagram, TikTok, Reddit discussions, guest posts, and small fashion blogs.
`);

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pageUrls.map((url) => `  <url><loc>${config.siteUrl}${url}</loc><lastmod>${today}</lastmod><changefreq>${url.startsWith("/products/") ? "weekly" : "daily"}</changefreq><priority>${url === "/" ? "1.0" : url.startsWith("/products/") ? "0.6" : "0.8"}</priority></url>`).join("\n")}
</urlset>
`;
write("sitemap.xml", sitemap);

console.log(`Generated ${pageUrls.length} indexable URLs.`);
