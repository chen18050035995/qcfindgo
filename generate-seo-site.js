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

const mainSiteUrl = String(config.mainSiteUrl || "https://www.novafindsgo.com").replace(/\/+$/, "");
const mainSiteProductUrl = (product = {}) => {
  const params = new URLSearchParams({
    id: String(product.sourceItemId || ""),
    ref: "qcfindgo"
  });
  return `${mainSiteUrl}/product?${params.toString()}`;
};

const loadProducts = () => {
  const code = fs.readFileSync(path.join(root, "products.js"), "utf8");
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);
  const products = Array.isArray(sandbox.window.PRODUCTS) ? sandbox.window.PRODUCTS : [];
  const qcPath = path.join(root, "qc-images.js");
  if (!fs.existsSync(qcPath)) return products;

  const qcCode = fs.readFileSync(qcPath, "utf8");
  const qcSandbox = { window: {} };
  vm.createContext(qcSandbox);
  vm.runInContext(qcCode, qcSandbox);
  const qcImages = qcSandbox.window.QC_IMAGES || {};
  return products.map((product) => {
    const key = `weidian:${product.sourceItemId || ""}`;
    const images = Array.isArray(qcImages[key]) ? qcImages[key].filter(Boolean).slice(0, 10) : [];
    return images.length ? { ...product, qcImages: images } : product;
  });
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
      <a href="/new-finds/">New Finds</a>
      <a href="/blog/">Guides</a>
      <a href="/contact/">Contact</a>
    </nav>
    <nav class="tools" aria-label="Shop tools">
      <a href="/categories/sneakers/">Sneakers</a>
      <a href="/categories/hoodies/">Hoodies</a>
      <a href="/brands/nike/">Nike</a>
      <a href="${escapeHtml(mainSiteUrl)}" rel="noopener noreferrer" target="_blank">Shop Nova</a>
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
    <link rel="stylesheet" href="/styles.css?v=20260825b" />
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
      <a class="seo-card" href="${escapeHtml(item.href)}">
        ${item.image ? `<img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.alt)}" loading="lazy" />` : ""}
        <span>${escapeHtml(item.label)}</span>
        <small>${escapeHtml(item.meta)}</small>
      </a>
    `).join("")}
  </div>`;

const productCardItems = (items, limit = 36) => items.slice(0, limit).map((product) => ({
  href: `/products/${product._slug}/`,
  image: product.image,
  alt: `${product.title} QC photos`,
  label: product.title || `${product._brand} find`,
  meta: `${product._brand} • ${categoryLabel(product._category)}`
}));

const loadMoreGrid = (items, initial = 48, step = 48) => {
  const cards = productCardItems(items, items.length);
  return `
    <div class="seo-grid load-more-grid" data-initial-count="${initial}" data-step-count="${step}">
      ${cards.map((item, index) => `
        <a class="seo-card" href="${escapeHtml(item.href)}" data-load-card${index >= initial ? " hidden" : ""}>
          ${item.image ? `<img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.alt)}" loading="lazy" />` : ""}
          <span>${escapeHtml(item.label)}</span>
          <small>${escapeHtml(item.meta)}</small>
        </a>
      `).join("")}
    </div>
    ${cards.length > initial ? `<button class="load-more-button" type="button" data-load-more>Load more products (${cards.length - initial} left)</button>` : ""}
    <script>
      (() => {
        const grid = document.currentScript.previousElementSibling?.matches("[data-load-more]")
          ? document.currentScript.previousElementSibling.previousElementSibling
          : document.currentScript.previousElementSibling;
        const button = grid?.nextElementSibling?.matches("[data-load-more]") ? grid.nextElementSibling : null;
        if (!grid || !button) return;
        const step = Number(grid.dataset.stepCount || 48);
        const update = () => {
          const hidden = [...grid.querySelectorAll("[data-load-card][hidden]")];
          button.textContent = hidden.length ? \`Load more products (\${hidden.length} left)\` : "All products loaded";
          button.hidden = hidden.length === 0;
        };
        button.addEventListener("click", () => {
          [...grid.querySelectorAll("[data-load-card][hidden]")].slice(0, step).forEach((card) => card.hidden = false);
          update();
        });
        update();
      })();
    </script>`;
};

const uniqueImages = (product) => {
  const seen = new Set();
  return [product.image, ...(Array.isArray(product.images) ? product.images : [])]
    .filter(Boolean)
    .filter((image) => {
      if (seen.has(image)) return false;
      seen.add(image);
      return true;
    });
};

const qcImages = (product) => {
  const seen = new Set();
  return (Array.isArray(product.qcImages) ? product.qcImages : [])
    .filter(Boolean)
    .filter((image) => {
      if (seen.has(image)) return false;
      seen.add(image);
      return true;
    })
    .slice(0, 10);
};

const renderOptionGroups = (product) => {
  const groups = Array.isArray(product.sizes) ? product.sizes : [];
  if (!groups.length) return "";
  return `
    <section class="product-options" aria-label="Style and size options">
      <h2>Style and size options</h2>
      ${groups.map((group, groupIndex) => {
        const values = Array.isArray(group.values) ? group.values : [];
        if (!values.length) return "";
        return `
          <div class="option-group">
            <div class="option-group-title">${escapeHtml(group.name || `Option ${groupIndex + 1}`)}</div>
            <div class="option-scroll">
              ${values.map((value, valueIndex) => {
                const option = typeof value === "string" ? { label: value } : value;
                const label = option?.label || option?.name || String(value || "");
                const image = option?.image || "";
                return `
                  <button class="option-chip${valueIndex === 0 ? " selected" : ""}" type="button"${image ? ` data-option-image="${escapeHtml(image)}"` : ""}>
                    ${image ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(label)} option" loading="lazy" />` : ""}
                    <span>${escapeHtml(label)}</span>
                  </button>`;
              }).join("")}
            </div>
          </div>`;
      }).join("")}
      <p class="option-note">Choose the closest style and size before opening an agent link. Final stock and sizing still need to be confirmed on the agent page.</p>
    </section>`;
};

const renderQcGallery = (product, title) => {
  const images = qcImages(product);
  if (images.length <= 1) return "";
  return `
    <section class="qc-gallery" aria-label="QC inspection photos">
      <div class="section-head">
        <h2>QC inspection photos</h2>
        <span>${images.length} photos</span>
      </div>
      <div class="qc-grid">
        ${images.map((image, index) => `
          <a href="${escapeHtml(image)}" target="_blank" rel="noopener noreferrer" class="qc-photo">
            <img src="${escapeHtml(image)}" alt="${escapeHtml(`${title} QC photo ${index + 1}`)}" loading="lazy" />
          </a>
        `).join("")}
      </div>
    </section>`;
};

const renderProductGallery = (product, title) => {
  const images = uniqueImages(product).slice(0, 24);
  if (images.length <= 1 || qcImages(product).length) return "";
  return `
    <section class="qc-gallery" aria-label="Product photos">
      <div class="section-head">
        <h2>Product photos</h2>
        <span>${images.length} photos</span>
      </div>
      <div class="qc-grid">
        ${images.map((image, index) => `
          <a href="${escapeHtml(image)}" target="_blank" rel="noopener noreferrer" class="qc-photo">
            <img src="${escapeHtml(image)}" alt="${escapeHtml(`${title} product photo ${index + 1}`)}" loading="lazy" />
          </a>
        `).join("")}
      </div>
    </section>`;
};

const agentIcons = {
  "Loongbuy": "https://www.google.com/s2/favicons?domain=loongbuy.com&sz=128",
  "LoongBuy": "https://www.google.com/s2/favicons?domain=loongbuy.com&sz=128",
  "Oopbuy": "https://www.google.com/s2/favicons?domain=oopbuy.com&sz=128",
  "OopBuy": "https://www.google.com/s2/favicons?domain=oopbuy.com&sz=128",
  "JoyAGoo": "https://www.google.com/s2/favicons?domain=joyagoo.com&sz=128",
  "Lovegobuy": "https://www.google.com/s2/favicons?domain=lovegobuy.com&sz=128",
  "Hipobuy": "https://www.google.com/s2/favicons?domain=hipobuy.com&sz=128",
  "Mulebuy": "https://www.google.com/s2/favicons?domain=mulebuy.com&sz=128",
  "Kakobuy": "https://www.google.com/s2/favicons?domain=kakobuy.com&sz=128",
  "Superbuy": "https://www.google.com/s2/favicons?domain=superbuy.com&sz=128",
  "CSSBuy": "https://www.google.com/s2/favicons?domain=cssbuy.com&sz=128",
  "Sugargoo": "https://www.google.com/s2/favicons?domain=sugargoo.com&sz=128",
  "Orientdig": "https://www.google.com/s2/favicons?domain=orientdig.com&sz=128",
  "AllChinaBuy": "https://www.google.com/s2/favicons?domain=allchinabuy.com&sz=128",
  "LitBuy": "https://www.google.com/s2/favicons?domain=litbuy.com&sz=128",
  "MyCNBox": "https://www.google.com/s2/favicons?domain=mycnb.com&sz=128",
  "OODTBuy": "/assets/agent-icons/oodtbuy.png",
  "OKEYHAUL": "/assets/agent-icons/okeyhaul.png"
};

const preferredAgentOrder = [
  "Loongbuy",
  "LoongBuy",
  "Oopbuy",
  "OopBuy",
  "JoyAGoo",
  "Lovegobuy",
  "Hipobuy",
  "Mulebuy",
  "Kakobuy",
  "Superbuy",
  "CSSBuy",
  "Sugargoo",
  "Orientdig",
  "AllChinaBuy",
  "LitBuy",
  "MyCNBox"
];

const renderAgentLogo = (name) => {
  const icon = agentIcons[name];
  const fallback = escapeHtml(name.slice(0, 2).toUpperCase());
  return icon
    ? `<img src="${escapeHtml(icon)}" alt="" loading="lazy" onerror="this.remove();this.nextElementSibling.hidden=false" /><span hidden>${fallback}</span>`
    : `<span>${fallback}</span>`;
};

const agentEntries = (product) => {
  const links = product.agentLinks && typeof product.agentLinks === "object" ? product.agentLinks : {};
  return Object.entries(links)
    .filter(([, url]) => url)
    .sort(([first], [second]) => {
      const a = preferredAgentOrder.indexOf(first);
      const b = preferredAgentOrder.indexOf(second);
      return (a === -1 ? 99 : a) - (b === -1 ? 99 : b);
    });
};

const renderBuyPanel = (product) => {
  const agents = agentEntries(product);
  const price = product.priceCny || product.price || "Check agent";
  const sourceUrl = product.url || "/";
  const novaUrl = mainSiteProductUrl(product);
  const list = agents.length ? agents : [["Original listing", sourceUrl]];
  return `
    <section class="order-routing" aria-label="Order on Nova Finds Go">
      <div>
        <p class="eyebrow">Ready to order or ask about this item?</p>
        <h2>Continue on Nova Finds Go</h2>
        <p>qcfindgo is the SEO and QC research page. Use Nova Finds Go for product search, support, and order inquiries. Keep this item ID ready: <strong>${escapeHtml(product.sourceItemId || "Check listing")}</strong>.</p>
      </div>
      <a class="nova-buy-link" href="${escapeHtml(novaUrl)}" rel="noopener noreferrer" target="_blank">View / Buy on Nova Finds Go</a>
    </section>
    <div class="buy-actions">
      <button class="buy-primary" type="button" data-open-agent-modal>Buy with agent</button>
      <a class="source-link" href="${escapeHtml(sourceUrl)}" rel="nofollow sponsored noopener noreferrer" target="_blank">Open original listing</a>
    </div>
    <div class="agent-modal" data-agent-modal hidden>
      <div class="agent-modal-backdrop" data-close-agent-modal></div>
      <section class="agent-modal-panel" role="dialog" aria-modal="true" aria-labelledby="agent-modal-title">
        <button class="agent-modal-close" type="button" aria-label="Close" data-close-agent-modal>×</button>
        <div class="agent-modal-head">
          <h2 id="agent-modal-title">Choose agent platform</h2>
          <p>Pick one agent to continue checkout</p>
        </div>
        <div class="agent-choice-list">
          ${list.map(([name, url], index) => `
            <a class="agent-choice${index < 4 ? " recommended" : ""}" href="${escapeHtml(url)}" rel="nofollow sponsored noopener noreferrer" target="_blank">
              <span class="agent-choice-logo">${renderAgentLogo(name)}</span>
              <span class="agent-choice-copy">
                <strong>${escapeHtml(name)}${index < 4 ? ` <em>Recommended</em>` : ""}</strong>
                <small>${escapeHtml(price)} · confirm style and size on agent page</small>
              </span>
              <span class="agent-choice-arrow">›</span>
            </a>
          `).join("")}
        </div>
        <p class="agent-modal-note">Select your style and size on this page first, then confirm the final option again with the agent before checkout.</p>
      </section>
    </div>`;
};

const productEnhancementScript = `
  <script>
    (() => {
      const mainImage = document.querySelector("[data-main-product-image]");
      document.querySelectorAll("[data-option-image]").forEach((button) => {
        button.addEventListener("click", () => {
          button.closest(".option-group")?.querySelectorAll(".option-chip").forEach((chip) => chip.classList.remove("selected"));
          button.classList.add("selected");
          if (mainImage && button.dataset.optionImage) mainImage.src = button.dataset.optionImage;
        });
      });
      document.querySelectorAll(".option-chip:not([data-option-image])").forEach((button) => {
        button.addEventListener("click", () => {
          button.closest(".option-group")?.querySelectorAll(".option-chip").forEach((chip) => chip.classList.remove("selected"));
          button.classList.add("selected");
        });
      });
      const modal = document.querySelector("[data-agent-modal]");
      const openButton = document.querySelector("[data-open-agent-modal]");
      const closeModal = () => {
        if (!modal) return;
        modal.hidden = true;
        document.body.classList.remove("modal-open");
      };
      openButton?.addEventListener("click", () => {
        if (!modal) return;
        modal.hidden = false;
        document.body.classList.add("modal-open");
        modal.querySelector(".agent-choice")?.focus();
      });
      document.querySelectorAll("[data-close-agent-modal]").forEach((button) => {
        button.addEventListener("click", closeModal);
      });
      document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") closeModal();
      });
    })();
  </script>`;

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
  "products",
  "qc-disclaimer",
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

const internalLinkList = (items) => `
  <div class="seo-link-grid">
    ${items.map((item) => `<a href="${escapeHtml(item.href)}">${escapeHtml(item.label)}</a>`).join("")}
  </div>`;

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

const qcChecklistHeading = (title) => {
  const clean = String(title || "QC checklist").trim();
  if (/\bQC checklist$/i.test(clean)) return clean;
  if (/\bQC$/i.test(clean)) return `${clean} checklist`;
  return `${clean} QC checklist`;
};

const qcChecklistSection = (title = "QC checklist") => `
  <section class="seo-copy">
    <h2>${escapeHtml(qcChecklistHeading(title))}</h2>
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

const shopCtaSection = `
  <section class="conversion-strip">
    <div>
      <p class="eyebrow">Orders and inquiries</p>
      <h2>Use qcfindgo to discover, then Nova Finds Go to order</h2>
      <p>qcfindgo is built for Google discovery, QC photo research, and long-tail product pages. When you are ready to search an item ID, ask support, or continue checkout, open Nova Finds Go.</p>
    </div>
    <a class="shop-cta" href="${escapeHtml(mainSiteUrl)}" rel="noopener noreferrer" target="_blank">Shop on Nova Finds Go</a>
  </section>`;

const gscPriorityLinks = [
  { href: "/keywords/qc-finder/", label: "qcfin / QC Finder" },
  { href: "/keywords/qc-finds/", label: "QC Finds" },
  { href: "/keywords/nike-qc/", label: "Nike QC" },
  { href: "/keywords/nike-shoes-qc/", label: "Nike Shoes QC" },
  { href: "/keywords/adidas-samba-qc/", label: "Adidas Samba QC" },
  { href: "/keywords/dior-b30-qc/", label: "Dior B30 QC" },
  { href: "/keywords/loro-piana-spreadsheet/", label: "Loro Piana Spreadsheet" },
  { href: "/compare/oopbuy-vs-superbuy/", label: "Oopbuy vs Superbuy" },
  { href: "/keywords/bq-sneakers/", label: "BQ Sneakers" },
  { href: "/keywords/best-sneaker-reps-spreadsheet/", label: "Sneaker Reps Spreadsheet" }
];

const searchIntentSection = (title, phrases = []) => `
  <section class="seo-copy">
    <h2>${escapeHtml(title)} search intent</h2>
    <p>This page targets shoppers who are already comparing QC photos, spreadsheet-style finds, W2C links, item IDs, prices, and agent routes before moving to Nova Finds Go for order support.</p>
    ${phrases.length ? `<p>Related searches covered: ${phrases.map(escapeHtml).join(", ")}.</p>` : ""}
  </section>`;

const priorityLinkSection = `
  <section class="seo-copy">
    <h2>Search Console priority pages</h2>
    <p>These pages focus on early queries already appearing in Google Search Console, then connect visitors to stronger brand, category, guide, and product pages.</p>
    ${internalLinkList(gscPriorityLinks)}
  </section>`;

write("brands/index.html", layout({
  title: "Streetwear Brands QC Finder | Nike, Adidas, LV, Dior, Gucci",
  description: "Browse streetwear and designer brand finds with QC-style product photos, category links, agent links, and product discovery pages.",
  canonical: `${config.siteUrl}/brands/`,
  h1: "Streetwear Brands QC Finder",
  content: cardGrid(topBrands.map(([brand, items]) => ({
    href: `/brands/${slugify(brand)}/`,
    label: brand,
    meta: `${items.length} QC finds`,
    image: items[0]?.image,
    alt: `${brand} QC finds`
  }))),
  schema: schemaOrg("CollectionPage", { name: "Streetwear Brands QC Finder" })
}));
pageUrls.push("/brands/");

topBrands.forEach(([brand, items]) => {
  const slug = slugify(brand);
  write(`brands/${slug}/index.html`, layout({
    title: `${brand} QC Finds | Sneakers and Streetwear - qcfindgo`,
    description: `Explore ${brand} QC finds, product photos, sneakers, streetwear apparel, bags, accessories, and agent-ready product links.`,
    canonical: `${config.siteUrl}/brands/${slug}/`,
    h1: `${brand} QC Finds`,
    content: `
      <section class="seo-copy">
        <h2>${escapeHtml(brand)} product discovery</h2>
        <p>Use this ${escapeHtml(brand)} page to compare QC-style product photos, titles, categories, prices, and agent links before opening a product page.</p>
      </section>
      ${buyerProcessSection(`${brand} QC finds`)}
      ${qcChecklistSection(brand)}
      ${shopCtaSection}
      ${cardGrid(productCardItems(items))}
      <section class="seo-copy"><h2>Related categories</h2><p>Browse sneakers, hoodies, T-shirts, designer shoes, bags, and accessories to build a stronger streetwear shortlist.</p>${internalLinkList([{ href: "/categories/sneakers/", label: "Sneaker QC finds" }, { href: "/categories/hoodies/", label: "Hoodie QC finds" }, { href: "/finds/", label: "Brand and category W2C finds" }, { href: "/keywords/", label: "Long-tail keyword pages" }])}</section>
      ${faqSection()}
      ${trustSection}
    `,
    schema: [schemaOrg("CollectionPage", { name: `${brand} QC Finds`, about: brand }), faqSchema()]
  }));
  pageUrls.push(`/brands/${slug}/`);
});

write("categories/index.html", layout({
  title: "Streetwear Categories | Sneakers, Hoodies, Tees and Shoes",
  description: "Browse QC finds by category, including sneakers, hoodies, T-shirts, designer shoes, pants, bags, watches, and accessories.",
  canonical: `${config.siteUrl}/categories/`,
  h1: "Streetwear Categories",
  content: cardGrid(topCategories.map(([category, items]) => ({
    href: `/categories/${category}/`,
    label: categoryLabel(category),
    meta: `${items.length} products`,
    image: items[0]?.image,
    alt: `${categoryLabel(category)} QC finds`
  }))),
  schema: schemaOrg("CollectionPage", { name: "Streetwear Categories" })
}));
pageUrls.push("/categories/");

topCategories.forEach(([category, items]) => {
  const label = categoryLabel(category);
  write(`categories/${category}/index.html`, layout({
    title: `${label} QC Finds | Streetwear Product Search - qcfindgo`,
    description: `Browse ${label.toLowerCase()} QC finds with streetwear product photos, brand filters, agent links, and US/EU buyer discovery notes.`,
    canonical: `${config.siteUrl}/categories/${category}/`,
    h1: `${label} QC Finds`,
    content: `
      <section class="seo-copy">
        <h2>${escapeHtml(label)} buying notes</h2>
        <p>Compare images, prices, item IDs, and brand signals before choosing a ${escapeHtml(label.toLowerCase())} find. Prioritize clear QC photos, consistent sizing information, and trusted agent pages.</p>
      </section>
      ${buyerProcessSection(`${label.toLowerCase()} QC finds`)}
      ${qcChecklistSection(label)}
      ${shopCtaSection}
      ${loadMoreGrid(items)}
      <section class="seo-copy"><h2>Related pages</h2>${internalLinkList([{ href: "/brands/nike/", label: "Nike QC finds" }, { href: "/brands/adidas/", label: "Adidas QC finds" }, { href: "/finds/", label: "Brand and category W2C finds" }, { href: "/keywords/", label: "Long-tail keyword pages" }])}</section>
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
  title: "W2C Finds by Brand and Category | QC Photos and Product Pages",
  description: "Browse long-tail W2C finds by brand and category, including Nike sneakers, Adidas shoes, Louis Vuitton bags, Dior sneakers, Gucci tees, hoodies, and accessories.",
  canonical: `${config.siteUrl}/finds/`,
  h1: "W2C Finds by Brand and Category",
  content: `
    <section class="seo-copy">
      <h2>Long-tail QC finder pages</h2>
      <p>These pages combine brand, category, QC photos, item IDs, prices, and product pages. They are designed for high-intent searches such as Nike sneaker reps, Gucci T-shirt QC photos, Dior sneaker W2C links, and Louis Vuitton bag finds.</p>
    </section>
    ${cardGrid(brandCategoryPairs.slice(0, 180).map((pair) => ({
      href: `/finds/${slugify(pair.brand)}-${pair.category}/`,
      label: `${pair.brand} ${categoryLabel(pair.category)} Finds`,
      meta: `${pair.count} QC product pages`,
      image: pair.items[0]?.image,
      alt: `${pair.brand} ${categoryLabel(pair.category)} QC photos`
    })))}
  `,
  schema: schemaOrg("CollectionPage", { name: "W2C Finds by Brand and Category" })
}));
pageUrls.push("/finds/");

brandCategoryPairs.slice(0, 180).forEach((pair) => {
  const brandSlug = slugify(pair.brand);
  const label = categoryLabel(pair.category);
  const slug = `${brandSlug}-${pair.category}`;
  write(`finds/${slug}/index.html`, layout({
    title: `${pair.brand} ${label} Reps | W2C Links and QC Photos`,
    description: `Compare ${pair.brand} ${label.toLowerCase()} reps with W2C links, QC photos, prices, item IDs, and product pages for US and Europe buyers.`,
    canonical: `${config.siteUrl}/finds/${slug}/`,
    h1: `${pair.brand} ${label} Reps and QC Photos`,
    content: `
      <section class="seo-copy">
        <h2>${escapeHtml(pair.brand)} ${escapeHtml(label)} W2C shortlist</h2>
        <p>This long-tail page groups ${escapeHtml(pair.brand)} ${escapeHtml(label.toLowerCase())} finds so shoppers can compare QC photos, product titles, source item IDs, prices, and buying routes before opening a listing.</p>
        <p>Search intent covered: ${escapeHtml(pair.brand)} ${escapeHtml(label.toLowerCase())} reps, ${escapeHtml(pair.brand)} ${escapeHtml(label.toLowerCase())} spreadsheet, ${escapeHtml(pair.brand)} ${escapeHtml(label.toLowerCase())} QC photos, and ${escapeHtml(pair.brand)} ${escapeHtml(label.toLowerCase())} W2C links.</p>
      </section>
      ${buyerProcessSection(`${pair.brand} ${label.toLowerCase()} reps`)}
      ${qcChecklistSection(`${pair.brand} ${label}`)}
      ${shopCtaSection}
      ${loadMoreGrid(pair.items)}
      <section class="seo-copy"><h2>Related pages</h2>${internalLinkList([
        { href: `/brands/${brandSlug}/`, label: `${pair.brand} QC finds` },
        { href: `/categories/${pair.category}/`, label: `${label} QC finds` },
        { href: "/keywords/", label: "Long-tail keyword pages" },
        { href: "/blog/how-to-use-qc-photos-before-buying-streetwear/", label: "How to use QC photos" }
      ])}</section>
      ${faqSection()}
      ${trustSection}
    `,
    schema: [schemaOrg("CollectionPage", { name: `${pair.brand} ${label} W2C Finds`, about: `${pair.brand} ${label}` }), faqSchema()]
  }));
  pageUrls.push(`/finds/${slug}/`);
});

const recentProducts = productRecords.slice(0, 96);
write("new-finds/index.html", layout({
  title: "New W2C Finds | Latest QC Photos and Product Pages",
  description: "Browse the latest W2C finds synced from Nova Finds Go with QC photos, item IDs, streetwear products, sneakers, hoodies, bags, and accessories.",
  canonical: `${config.siteUrl}/new-finds/`,
  h1: "New W2C Finds and QC Photos",
  content: `
    <section class="seo-copy">
      <h2>Latest synced product finds</h2>
      <p>This page highlights newly synced product pages from Nova Finds Go. Use it to discover recent sneakers, hoodies, designer shoes, bags, accessories, and streetwear products with QC photos and product pages.</p>
    </section>
    ${buyerProcessSection("new W2C finds")}
    ${loadMoreGrid(recentProducts)}
    ${qcChecklistSection("New product")}
    ${shopCtaSection}
    ${internalLinkList([
      { href: "/finds/", label: "Brand and category finds" },
      { href: "/keywords/", label: "Long-tail keyword pages" },
      { href: "/blog/how-to-use-a-reps-spreadsheet-safely/", label: "Spreadsheet safety guide" }
    ])}
  `,
  schema: schemaOrg("CollectionPage", { name: "New W2C Finds" })
}));
pageUrls.push("/new-finds/");

write("agents/index.html", layout({
  title: "Agent Spreadsheet Pages | QC Finder Routes - qcfindgo",
  description: "Compare agent spreadsheet pages for QC photos, W2C links, sneaker finds, streetwear products, shipping checks, and buyer routes.",
  canonical: `${config.siteUrl}/agents/`,
  h1: "Agent Spreadsheet Pages",
  content: `
    ${searchIntentSection("Agent spreadsheet", ["agent spreadsheet", "reps spreadsheet", "W2C spreadsheet", "QC photo agent"])}
    ${cardGrid(config.agentPages.map((agent) => ({
      href: `/agents/${agent.slug}/`,
      label: `${agent.name} Spreadsheet Finds`,
      meta: agent.keyword,
      image: productRecords[0]?.image,
      alt: `${agent.name} spreadsheet QC finds`
    })))}
    ${priorityLinkSection}
  `,
  schema: schemaOrg("CollectionPage", { name: "Agent Spreadsheet Pages" })
}));
pageUrls.push("/agents/");

config.agentPages.forEach((agent) => {
  const items = productRecords
    .filter((product) => agentEntries(product).some(([name]) => slugify(name) === agent.slug))
    .slice(0, 96);
  const agentProducts = items.length ? items : productRecords.slice(0, 96);
  write(`agents/${agent.slug}/index.html`, layout({
    title: `${agent.name} Spreadsheet Finds | QC Photos and W2C Links`,
    description: `Browse ${agent.name} spreadsheet finds with QC photos, W2C product links, item IDs, prices, sneakers, streetwear, and Nova Finds Go order routes.`,
    canonical: `${config.siteUrl}/agents/${agent.slug}/`,
    h1: `${agent.name} Spreadsheet Finds`,
    content: `
      ${searchIntentSection(agent.keyword, [`${agent.name} spreadsheet`, `${agent.name} QC photos`, `${agent.name} W2C links`])}
      ${buyerProcessSection(`${agent.name} spreadsheet finds`)}
      ${qcChecklistSection(agent.name)}
      ${shopCtaSection}
      ${loadMoreGrid(agentProducts)}
      <section class="seo-copy"><h2>Related agent comparisons</h2>${internalLinkList([
        { href: "/compare/oopbuy-vs-superbuy/", label: "Oopbuy vs Superbuy" },
        { href: "/compare/kakobuy-vs-oopbuy/", label: "Kakobuy vs Oopbuy" },
        { href: "/compare/best-agent-for-sneakers/", label: "Best agent for sneaker reps" },
        { href: "/keywords/best-sneaker-reps-spreadsheet/", label: "Best sneaker reps spreadsheet" }
      ])}</section>
      ${faqSection()}
    `,
    schema: [schemaOrg("CollectionPage", { name: `${agent.name} Spreadsheet Finds`, about: agent.keyword }), faqSchema()]
  }));
  pageUrls.push(`/agents/${agent.slug}/`);
});

write("compare/index.html", layout({
  title: "Agent Comparisons | Oopbuy, Superbuy and Kakobuy - qcfindgo",
  description: "Compare Oopbuy, Superbuy, Kakobuy and other agent options for QC photos, W2C links, spreadsheet finds, shipping routes, and buyer workflows.",
  canonical: `${config.siteUrl}/compare/`,
  h1: "Agent Comparisons",
  content: `
    ${searchIntentSection("Agent comparison", ["Oopbuy vs Superbuy", "Kakobuy vs Oopbuy", "best agent for sneaker reps"])}
    ${cardGrid(config.comparePages.map((page) => ({
      href: `/compare/${page.slug}/`,
      label: page.title,
      meta: page.keyword,
      image: productRecords[0]?.image,
      alt: `${page.title} agent comparison`
    })))}
    ${priorityLinkSection}
  `,
  schema: schemaOrg("CollectionPage", { name: "Agent Comparisons" })
}));
pageUrls.push("/compare/");

config.comparePages.forEach((page) => {
  const agentSet = new Set(page.agents.map((agent) => slugify(agent)));
  const items = productRecords
    .filter((product) => agentEntries(product).some(([name]) => agentSet.has(slugify(name))))
    .slice(0, 96);
  const relatedProducts = items.length ? items : productRecords.slice(0, 96);
  write(`compare/${page.slug}/index.html`, layout({
    title: `${page.title} | Agent Comparison and QC Finder`,
    description: page.description,
    canonical: `${config.siteUrl}/compare/${page.slug}/`,
    h1: `${page.title}: Agent Comparison`,
    content: `
      ${searchIntentSection(page.keyword, [page.keyword, `${page.title} QC photos`, `${page.title} spreadsheet`, `${page.title} W2C links`])}
      <section class="seo-copy">
        <h2>Quick comparison</h2>
        <p>${escapeHtml(page.description)} Compare available product images, agent routing, seller details, service fees, shipping estimates, and final support before placing an order.</p>
        <p>For a new site, this page helps capture lower-competition comparison searches while linking visitors back into product pages and Nova Finds Go order paths.</p>
      </section>
      ${buyerProcessSection(page.title)}
      ${qcChecklistSection(page.title)}
      ${shopCtaSection}
      ${loadMoreGrid(relatedProducts)}
      <section class="seo-copy"><h2>Related pages</h2>${internalLinkList([
        { href: "/agents/oopbuy/", label: "Oopbuy spreadsheet finds" },
        { href: "/agents/superbuy/", label: "Superbuy spreadsheet finds" },
        { href: "/keywords/best-sneaker-reps-spreadsheet/", label: "Best sneaker reps spreadsheet" },
        { href: "/blog/best-agents-for-sneaker-reps/", label: "Best agents for sneaker reps" }
      ])}</section>
      ${faqSection()}
      ${trustSection}
    `,
    schema: [schemaOrg("Article", {
      headline: `${page.title}: Agent Comparison`,
      description: page.description,
      author: { "@type": "Organization", name: "qcfindgo" },
      datePublished: today,
      dateModified: today
    }), faqSchema()]
  }));
  pageUrls.push(`/compare/${page.slug}/`);
});

const keywordLandingPages = [
  { slug: "qc-finder", title: "QC Finder", terms: ["sneaker"], fallback: "/finds/", description: "Use qcfindgo as a QC finder for sneaker reps, streetwear finds, W2C links, item IDs, prices, and Nova Finds Go order routes.", phrases: ["qcfin", "qcfindgo", "qc find", "QC finder"] },
  { slug: "qc-finds", title: "QC Finds", terms: ["sneaker"], fallback: "/finds/", description: "Browse QC finds with product photos, spreadsheet-style discovery pages, W2C links, item IDs, prices, and agent-ready buying routes.", phrases: ["qcfinds", "qc finds", "qcfindes", "qcfinda"] },
  { slug: "nike-qc", title: "Nike QC", terms: ["nike"], fallback: "/brands/nike/", description: "Review Nike QC photos for sneakers, hoodies, tees, item IDs, W2C links, prices, and Nova Finds Go product routes.", phrases: ["nike qc", "Nike QC photos", "Nike sneaker QC", "Nike reps QC"] },
  { slug: "nike-shoes-qc", title: "Nike Shoes QC", terms: ["nike", "shoe"], fallback: "/brands/nike/", description: "Compare Nike shoes QC photos, sneaker shape, toe box, swoosh placement, item IDs, W2C links, and Nova Finds Go buying routes.", phrases: ["nike shoes qc", "Nike shoe QC photos", "Nike sneakers QC", "Nike reps shoes"] },
  { slug: "nike-hoodie-qc", title: "Nike Hoodie QC", terms: ["nike", "hoodie"], fallback: "/brands/nike/", description: "Review Nike hoodie QC photos, logo placement, fabric weight, sizing notes, item IDs, prices, W2C links, and buying routes.", phrases: ["nike hoodie qc", "Nike hoodie reps", "Nike hoodie QC photos"] },
  { slug: "adidas-samba-qc", title: "Adidas Samba QC", terms: ["adidas", "samba"], fallback: "/brands/adidas/", description: "Browse Adidas Samba QC photos, sole profile checks, three-stripe details, sizing notes, item IDs, W2C links, and buying routes.", phrases: ["adidas samba qc", "Adidas Samba reps", "Adidas Samba QC photos"] },
  { slug: "dior-b30-qc", title: "Dior B30 QC", terms: ["dior", "b30"], fallback: "/brands/dior/", description: "Compare Dior B30 QC photos for sneaker shape, panels, logo placement, sole details, item IDs, prices, W2C links, and order routes.", phrases: ["dior b30 qc", "Dior B30 reps", "Dior sneaker QC photos"] },
  { slug: "lv-bag-qc", title: "LV Bag QC", terms: ["louis vuitton", "bag"], fallback: "/brands/louis-vuitton/", description: "Review LV bag QC photos, canvas alignment, hardware, stitching, logo placement, item IDs, W2C links, prices, and buyer routes.", phrases: ["lv bag qc", "Louis Vuitton bag QC photos", "LV reps bag"] },
  { slug: "gucci-shoes-qc", title: "Gucci Shoes QC", terms: ["gucci", "shoe"], fallback: "/brands/gucci/", description: "Compare Gucci shoes QC photos, logo placement, sole profile, stitching, materials, item IDs, W2C links, and Nova Finds Go product routes.", phrases: ["gucci shoes qc", "Gucci shoes reps", "Gucci QC photos"] },
  { slug: "designer-bag-qc", title: "Designer Bag QC", terms: ["bag"], fallback: "/categories/designer-bags/", description: "Browse designer bag QC photos for LV, Dior, Gucci, hardware checks, stitching, logo placement, item IDs, W2C links, and prices.", phrases: ["designer bag qc", "designer bag QC photos", "bag reps QC"] },
  { slug: "streetwear-shoes-for-us-buyers", title: "Streetwear Shoes for US Buyers", terms: ["shoe"], fallback: "/categories/designer-shoes/", description: "Find streetwear shoes for US buyers with QC photos, product IDs, prices, W2C links, agent notes, and Nova Finds Go order routes.", phrases: ["streetwear shoes us buyers", "W2C shoes US buyers", "rep shoes US"] },
  { slug: "designer-finds-for-europe-buyers", title: "Designer Finds for Europe Buyers", terms: ["dior", "gucci", "louis vuitton"], fallback: "/finds/", description: "Compare designer finds for Europe buyers across shoes, bags, hoodies, QC photos, item IDs, W2C links, and buying routes.", phrases: ["designer finds europe buyers", "W2C designer Europe", "Europe reps QC"] },
  { slug: "loro-piana-spreadsheet", title: "Loro Piana Spreadsheet", terms: ["loro piana"], fallback: "/brands/loro-piana/", description: "Browse Loro Piana spreadsheet finds with QC photos, item IDs, quiet luxury product notes, W2C links, and buying routes.", phrases: ["loro piana spreadsheet", "Loro Piana reps spreadsheet", "Loro Piana QC photos"] },
  { slug: "bq-sneakers", title: "BQ Sneakers", terms: ["sneaker"], fallback: "/categories/sneakers/", description: "Compare BQ sneakers and sneaker QC finds with product photos, item IDs, prices, W2C links, and agent-ready routes.", phrases: ["bq sneakers", "BQ sneaker QC", "BQ shoes finds"] },
  { slug: "nike-sneaker-reps", title: "Nike Sneaker Reps", terms: ["nike", "sneaker"], fallback: "/brands/nike/", description: "Compare Nike sneaker reps with W2C links, QC photos, product IDs, prices, and buying routes." },
  { slug: "adidas-samba-reps", title: "Adidas Samba Reps", terms: ["adidas", "samba"], fallback: "/brands/adidas/", description: "Browse Adidas Samba reps, QC photos, W2C links, and similar Adidas sneaker finds." },
  { slug: "louis-vuitton-bag-reps", title: "Louis Vuitton Bag Reps", terms: ["louis vuitton", "bag"], fallback: "/brands/louis-vuitton/", description: "Find Louis Vuitton bag reps with QC photos, product IDs, W2C links, and buying options." },
  { slug: "dior-sneaker-reps", title: "Dior Sneaker Reps", terms: ["dior", "sneaker"], fallback: "/brands/dior/", description: "Compare Dior sneaker reps with QC photos, source IDs, W2C links, prices, and product pages." },
  { slug: "gucci-t-shirt-reps", title: "Gucci T-Shirt Reps", terms: ["gucci", "t-shirt"], fallback: "/brands/gucci/", description: "Browse Gucci T-shirt reps with QC photos, W2C links, item IDs, prices, and product pages." },
  { slug: "black-hoodie-reps", title: "Black Hoodie Reps", terms: ["hoodie"], fallback: "/categories/hoodies/", description: "Explore black hoodie and streetwear hoodie reps with QC photo checks, W2C links, prices, and product pages." },
  { slug: "designer-shoes-qc-photos", title: "Designer Shoes QC Photos", terms: ["designer-shoes"], fallback: "/categories/designer-shoes/", description: "Review designer shoes QC photos, W2C links, brand pages, prices, and product routes." },
  { slug: "best-sneaker-reps-spreadsheet", title: "Best Sneaker Reps Spreadsheet", terms: ["sneaker"], fallback: "/categories/sneakers/", description: "Compare sneaker reps spreadsheet finds with QC photos, W2C links, item IDs, prices, and US or Europe buying notes." },
  { slug: "nike-dunk-low-reps", title: "Nike Dunk Low Reps", terms: ["nike", "dunk"], fallback: "/brands/nike/", description: "Browse Nike Dunk Low reps with QC photos, W2C links, seller item IDs, prices, and product routes." },
  { slug: "nike-air-force-1-reps", title: "Nike Air Force 1 Reps", terms: ["nike", "air force"], fallback: "/brands/nike/", description: "Compare Nike Air Force 1 reps with QC photos, source links, item IDs, prices, and buying options." },
  { slug: "adidas-yeezy-reps", title: "Adidas Yeezy Reps", terms: ["adidas", "yeezy"], fallback: "/brands/adidas/", description: "Find Adidas Yeezy reps with QC photo checks, W2C links, sneaker sizing notes, prices, and product pages." },
  { slug: "gucci-bag-reps", title: "Gucci Bag Reps", terms: ["gucci", "bag"], fallback: "/brands/gucci/", description: "Browse Gucci bag reps with QC photos, hardware checks, W2C links, item IDs, prices, and product pages." },
  { slug: "louis-vuitton-sneaker-reps", title: "Louis Vuitton Sneaker Reps", terms: ["louis vuitton", "sneaker"], fallback: "/brands/louis-vuitton/", description: "Compare Louis Vuitton sneaker reps with QC photos, shape checks, W2C links, prices, and product pages." },
  { slug: "dior-bag-reps", title: "Dior Bag Reps", terms: ["dior", "bag"], fallback: "/brands/dior/", description: "Review Dior bag reps with QC photo checks, logo placement notes, item IDs, W2C links, and prices." },
  { slug: "designer-hoodie-reps", title: "Designer Hoodie Reps", terms: ["hoodie"], fallback: "/categories/hoodies/", description: "Explore designer hoodie reps with QC photos, print placement checks, sizing notes, W2C links, and product pages." },
  { slug: "streetwear-t-shirt-reps", title: "Streetwear T-Shirt Reps", terms: ["t-shirt"], fallback: "/categories/tshirts/", description: "Browse streetwear T-shirt reps with QC photos, print checks, brand pages, prices, W2C links, and product pages." },
  { slug: "designer-belt-reps", title: "Designer Belt Reps", terms: ["belt"], fallback: "/categories/other-accessories/", description: "Compare designer belt reps with QC photos, buckle details, material checks, item IDs, W2C links, and prices." },
  { slug: "rep-shoes-with-qc-photos", title: "Rep Shoes with QC Photos", terms: ["shoe"], fallback: "/categories/designer-shoes/", description: "Find rep shoes with QC photos, W2C links, sizing checks, source item IDs, prices, and product pages." },
  { slug: "w2c-sneakers-for-us-buyers", title: "W2C Sneakers for US Buyers", terms: ["sneaker"], fallback: "/categories/sneakers/", description: "Browse W2C sneakers for US buyers with QC photos, item IDs, prices, route notes, and product comparisons." },
  { slug: "w2c-streetwear-for-europe-buyers", title: "W2C Streetwear for Europe Buyers", terms: ["hoodie"], fallback: "/categories/hoodies/", description: "Use this W2C streetwear page for Europe buyers comparing QC photos, product IDs, and category pages." },
  { slug: "cheap-streetwear-finds", title: "Cheap Streetwear Finds", terms: ["t-shirt"], fallback: "/categories/tshirts/", description: "Compare affordable streetwear finds with QC photos, prices, W2C links, item IDs, and brand pages." },
  { slug: "qc-photo-checklist-for-reps", title: "QC Photo Checklist for Reps", terms: ["sneaker"], fallback: "/blog/how-to-use-qc-photos-before-buying-streetwear/", description: "Use this QC photo checklist for reps to compare images, material, shape, stitching, labels, sizing, and W2C links." }
];

write("keywords/index.html", layout({
  title: "QC Finder Keywords | Nike QC, Spreadsheets and W2C Finds",
  description: "Browse qcfindgo keyword pages for Nike QC, QC finds, Loro Piana spreadsheet, sneaker reps, W2C links, product IDs, and QC photos.",
  canonical: `${config.siteUrl}/keywords/`,
  h1: "QC Finder Keyword Pages",
  content: `${priorityLinkSection}${shopCtaSection}${cardGrid(keywordLandingPages.map((page) => {
    const items = searchProducts(page.terms, 12);
    return {
      href: `/keywords/${page.slug}/`,
      label: page.title,
      meta: `${items.length || "Curated"} related finds`,
      image: items[0]?.image || productRecords[0]?.image,
      alt: `${page.title} QC photos`
    };
  }))}`,
  schema: schemaOrg("CollectionPage", { name: "Long-Tail Keyword Pages" })
}));
pageUrls.push("/keywords/");

keywordLandingPages.forEach((page) => {
  let items = searchProducts(page.terms, 96);
  if (!items.length && page.fallback.startsWith("/brands/")) {
    const brandSlug = page.fallback.split("/").filter(Boolean).pop();
    const brandEntry = topBrands.find(([brand]) => slugify(brand) === brandSlug);
    items = brandEntry?.[1]?.slice(0, 96) || [];
  }
  if (!items.length && page.fallback.startsWith("/categories/")) {
    const categorySlug = page.fallback.split("/").filter(Boolean).pop();
    items = byCategory.get(categorySlug)?.slice(0, 96) || [];
  }
  if (!items.length) items = productRecords.slice(0, 96);

  write(`keywords/${page.slug}/index.html`, layout({
    title: `${page.title} | W2C Links and QC Photos`,
    description: page.description,
    canonical: `${config.siteUrl}/keywords/${page.slug}/`,
    h1: `${page.title}: W2C Links and QC Photos`,
    content: `
      ${searchIntentSection(page.title, page.phrases || [page.title, `${page.title} QC photos`, `${page.title} W2C links`])}
      <section class="seo-copy">
        <h2>${escapeHtml(page.title)} buying intent</h2>
        <p>${escapeHtml(page.description)} This page is built for shoppers comparing product photos, item IDs, prices, categories, and buying routes before choosing a product page.</p>
      </section>
      ${buyerProcessSection(page.title)}
      ${qcChecklistSection(page.title)}
      ${shopCtaSection}
      ${loadMoreGrid(items)}
      <section class="seo-copy"><h2>Related pages</h2>${internalLinkList([
        { href: page.fallback, label: `Main ${page.title} page` },
        ...gscPriorityLinks.filter((item) => item.href !== `/keywords/${page.slug}/`).slice(0, 3),
        { href: "/finds/", label: "Brand and category W2C finds" },
        { href: "/new-finds/", label: "New W2C finds" },
        { href: "/blog/how-to-use-a-reps-spreadsheet-safely/", label: "How to use a reps spreadsheet safely" }
      ])}</section>
      ${faqSection()}
    `,
    schema: [schemaOrg("CollectionPage", { name: page.title, about: page.title }), faqSchema()]
  }));
  pageUrls.push(`/keywords/${page.slug}/`);
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
    title: `${title} | ${brand} - Streetwear QC Finder`,
    description: `Review ${title} QC photos, ${brand} product details, price notes, category links, and agent-ready buying options for US and Europe buyers.`,
    canonical,
    h1: title,
    content: `
      <section class="product-detail">
        <div class="product-media"><img src="${escapeHtml(product.image)}" alt="${escapeHtml(`${title} QC photos and product details`)}" loading="eager" data-main-product-image /></div>
        <div class="product-copy">
          <p class="eyebrow">${escapeHtml(brand)} • ${escapeHtml(category)}</p>
          <h2>QC product overview</h2>
          <p>${escapeHtml(title)} is listed as a ${escapeHtml(category.toLowerCase())} find for shoppers comparing QC-style photos, item details, pricing, and agent options before opening the original product link.</p>
          <dl class="product-facts">
            <div><dt>Brand</dt><dd>${escapeHtml(brand)}</dd></div>
            <div><dt>Category</dt><dd><a href="/categories/${escapeHtml(product._category)}/">${escapeHtml(category)}</a></dd></div>
            <div><dt>Item ID</dt><dd>${escapeHtml(product.sourceItemId || "Check listing")}</dd></div>
            <div><dt>Price</dt><dd>${escapeHtml(product.price || product.priceCny || "Check agent")}</dd></div>
          </dl>
          <p>Use the images to check shape, material texture, print placement, stitching, tags, color tone, and overall streetwear styling. For sneakers, compare panels, sole shape, toe box, logo placement, and heel details.</p>
          ${renderBuyPanel(product)}
        </div>
      </section>
      ${renderOptionGroups(product)}
      ${renderQcGallery(product, title)}
      ${renderProductGallery(product, title)}
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
      ${productEnhancementScript}
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
      ${shopCtaSection}
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
  ["returns", "Returns and Refunds", "qcfindgo does not process orders directly. Return and refund policies depend on the selected agent, seller, or purchase platform."],
  ["qc-disclaimer", "QC Finder Disclaimer", "qcfindgo is an independent product discovery and QC photo research website. Brand names are used only to organize search, comparison, and buyer research pages."]
];

simplePages.forEach(([slug, title, description]) => {
  write(`${slug}/index.html`, layout({
    title: `${title} - qcfindgo`,
    description,
    canonical: `${config.siteUrl}/${slug}/`,
    h1: title,
  content: `<section class="seo-copy"><p>${escapeHtml(description)}</p><p>Email: <a href="mailto:${escapeHtml(config.contactEmail)}">${escapeHtml(config.contactEmail)}</a></p><p>Browse <a href="/brands/">brand QC finds</a>, <a href="/categories/">streetwear categories</a>, and <a href="/blog/">QC guides</a>.</p></section>${shopCtaSection}`,
    schema: schemaOrg("WebPage", { name: title, description })
  }));
  pageUrls.push(`/${slug}/`);
});

const keywordRows = [
  ["keyword","type","intent","target_page","priority","notes"],
  ["qcfin","brand","navigational","/keywords/qc-finder/","high","Early GSC query; capture typo and brand discovery demand"],
  ["qcfinds","brand","navigational","/keywords/qc-finds/","high","Early GSC query; connect to product discovery hub"],
  ["qc finds","brand","navigational","/keywords/qc-finds/","high","Early GSC query; exact phrase landing page"],
  ["qc find","brand","navigational","/keywords/qc-finder/","high","Early GSC query; exact phrase landing page"],
  ["nike qc","long-tail","commercial","/keywords/nike-qc/","high","Early GSC query; route users to Nike product pages"],
  ["loro piana spreadsheet","long-tail","commercial","/keywords/loro-piana-spreadsheet/","high","Early GSC query; quiet luxury spreadsheet page"],
  ["bq sneakers","long-tail","commercial","/keywords/bq-sneakers/","medium","Early GSC query; sneaker discovery landing page"],
  ["oopbuy vs superbuy","comparison","research","/compare/oopbuy-vs-superbuy/","high","Early GSC query; agent comparison landing page"],
  ["nike sneaker qc photos","brand","commercial","/brands/nike/","high","US and Europe sneaker discovery"],
  ["nike dunk low reps","long-tail","commercial","/keywords/nike-dunk-low-reps/","high","Dedicated keyword landing page"],
  ["adidas samba qc finder","brand","commercial","/brands/adidas/","high","Long-tail Adidas sneaker query"],
  ["adidas samba reps","long-tail","commercial","/keywords/adidas-samba-reps/","high","Dedicated keyword landing page"],
  ["adidas yeezy reps","long-tail","commercial","/keywords/adidas-yeezy-reps/","medium","Dedicated keyword landing page"],
  ["louis vuitton bag qc photos","brand","commercial","/brands/louis-vuitton/","high","Designer bag QC page"],
  ["louis vuitton sneaker reps","long-tail","commercial","/keywords/louis-vuitton-sneaker-reps/","medium","Dedicated keyword landing page"],
  ["dior sneakers qc finder","brand","commercial","/brands/dior/","high","Dior was provided as DIRO; site uses Dior"],
  ["dior bag reps","long-tail","commercial","/keywords/dior-bag-reps/","medium","Dedicated keyword landing page"],
  ["gucci t shirt qc photos","brand","commercial","/brands/gucci/","high","Designer apparel long-tail"],
  ["gucci bag reps","long-tail","commercial","/keywords/gucci-bag-reps/","medium","Dedicated keyword landing page"],
  ["streetwear sneakers qc","core","commercial","/categories/sneakers/","high","Category page"],
  ["designer shoes qc photos","core","commercial","/categories/designer-shoes/","high","Category page"],
  ["rep shoes with qc photos","long-tail","commercial","/keywords/rep-shoes-with-qc-photos/","high","Dedicated keyword landing page"],
  ["streetwear hoodie qc finder","core","commercial","/categories/hoodies/","medium","Category page"],
  ["designer hoodie reps","long-tail","commercial","/keywords/designer-hoodie-reps/","medium","Dedicated keyword landing page"],
  ["streetwear t shirt reps","long-tail","commercial","/keywords/streetwear-t-shirt-reps/","medium","Dedicated keyword landing page"],
  ["best sneaker reps spreadsheet","long-tail","research","/keywords/best-sneaker-reps-spreadsheet/","high","Competitor comparison query"],
  ["w2c sneakers for us buyers","long-tail","commercial","/keywords/w2c-sneakers-for-us-buyers/","high","US buyer landing page"],
  ["w2c streetwear for europe buyers","long-tail","commercial","/keywords/w2c-streetwear-for-europe-buyers/","high","Europe buyer landing page"],
  ["cheap streetwear finds","long-tail","commercial","/keywords/cheap-streetwear-finds/","medium","Price-sensitive discovery query"],
  ["qc photo checklist for reps","informational","research","/keywords/qc-photo-checklist-for-reps/","high","Informational support page"],
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
1. Keep /sitemap.xml submitted in Google Search Console after every product or SEO page update.
2. Fix 404 URLs with redirects, then monitor the not-indexed report weekly.
3. Strengthen pages already receiving impressions: qcfin, qcfinds, qc finds, nike qc, bq sneakers, loro piana spreadsheet, and oopbuy vs superbuy.
4. Publish two English guides per week under /blog/ and add internal links to product pages.
5. Improve product copy for top products by clicks, impressions, and Nova Finds Go order clicks.
6. Build social profiles and 5-10 safe citations after indexing begins.

## Current GSC Baseline
- Indexed pages: 801
- Not indexed pages: 1,011
- Last visible 3-month performance: 15 clicks, 329 impressions, 4.6% CTR, 31.1 average position
- Priority queries: qcfin, qcfinds, qc finds, nike qc, bq sneakers, loro piana spreadsheet, oopbuy vs superbuy

## Long-Tail Page Map
- /finds/ is the discovery hub for brand + category combinations.
- /new-finds/ highlights recently imported products so Google sees fresh crawl paths.
- /keywords/ collects high-intent terms such as qc finder, qc finds, nike qc, loro piana spreadsheet, bq sneakers, nike dunk low reps, best sneaker reps spreadsheet, and W2C sneakers for US buyers.
- /compare/ targets lower-competition agent comparison searches such as Oopbuy vs Superbuy and Kakobuy vs Oopbuy.
- /agents/ targets agent spreadsheet searches and links those visitors to product pages.
- /qc-disclaimer/ explains the site's role as an independent QC finder and improves trust signals.

## Google Search Console Workflow
- Resubmit https://qcfindgo.com/sitemap.xml after each product import or SEO generation.
- Manually request indexing for the homepage, /new-finds/, /keywords/qc-finder/, /keywords/qc-finds/, /keywords/nike-qc/, /keywords/loro-piana-spreadsheet/, /compare/oopbuy-vs-superbuy/, and /keywords/best-sneaker-reps-spreadsheet/.
- Wait 24-72 hours before judging coverage reports. GSC processing can lag even when live URL tests pass.

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
