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

ensureDir("brands");
ensureDir("categories");
ensureDir("agents");
ensureDir("compare");
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

const internalLinkList = (items) => `
  <div class="seo-link-grid">
    ${items.map((item) => `<a href="${escapeHtml(item.href)}">${escapeHtml(item.label)}</a>`).join("")}
  </div>`;

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
      ${cardGrid(productCardItems(items))}
      <section class="seo-copy"><h2>Related categories and agents</h2><p>Browse sneakers, hoodies, T-shirts, designer shoes, bags, and accessories to build a stronger streetwear shortlist.</p>${internalLinkList([{ href: "/categories/sneakers/", label: "Sneaker reps spreadsheet" }, { href: "/agents/loongbuy/", label: "LoongBuy spreadsheet" }, { href: "/compare/best-agent-for-sneakers/", label: "Best agent for sneaker reps" }])}</section>
    `,
    schema: schemaOrg("CollectionPage", { name: `${brand} QC Finds`, about: brand })
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
      ${cardGrid(productCardItems(items))}
      <section class="seo-copy"><h2>Related agent pages</h2>${internalLinkList(agentPageConfig.slice(0, 6).map((agent) => ({ href: `/agents/${agent.slug}/`, label: agent.keyword })))}</section>
    `,
    schema: schemaOrg("CollectionPage", { name: `${label} QC Finds` })
  }));
  pageUrls.push(`/categories/${category}/`);
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
    schema: schemaOrg("Product", {
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
    })
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
  ["about", "About qcfindgo", "qcfindgo helps US and Europe shoppers browse QC-style product photos, streetwear categories, designer brand finds, and agent-ready product discovery links."],
  ["contact", "Contact qcfindgo", `Contact qcfindgo at ${config.contactEmail} for site questions, product discovery feedback, or partnership requests.`],
  ["privacy-policy", "Privacy Policy", "This privacy policy explains basic analytics, contact email handling, and site usage data for qcfindgo visitors."],
  ["terms", "Terms of Use", "These terms explain how visitors can use qcfindgo as a product discovery and QC finder website."],
  ["shipping", "Shipping Notes", "qcfindgo is a product discovery website. Shipping times, fees, and routes depend on the selected agent or source listing."],
  ["returns", "Returns and Refunds", "qcfindgo does not process orders directly. Return and refund policies depend on the selected agent, seller, or purchase platform."]
];

simplePages.forEach(([slug, title, description]) => {
  write(`${slug}/index.html`, layout({
    title: `${title} - qcfindgo`,
    description,
    canonical: `${config.siteUrl}/${slug}/`,
    h1: title,
    content: `<section class="seo-copy"><p>${escapeHtml(description)}</p><p>Email: <a href="mailto:${escapeHtml(config.contactEmail)}">${escapeHtml(config.contactEmail)}</a></p><p>Browse <a href="/brands/">brand QC finds</a>, <a href="/categories/">streetwear categories</a>, and <a href="/blog/">QC guides</a>.</p></section>`,
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
  ["how to use qc photos","informational","research","/blog/how-to-use-qc-photos-before-buying-streetwear/","high","Blog guide"],
  ["best streetwear sneakers us europe","informational","research","/blog/best-streetwear-sneakers-for-us-and-europe-buyers/","medium","Blog guide"]
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

## Weekly Content Cadence
- 1 brand or category guide
- 1 buyer checklist or outfit guide
- Add internal links to 5-10 product pages per article

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
