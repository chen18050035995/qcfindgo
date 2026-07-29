const products = Array.isArray(window.PRODUCTS) ? window.PRODUCTS : [];
const searchForm = document.querySelector("#search-form");
const searchInput = document.querySelector("#search-input");
const categoryGrid = document.querySelector("#category-grid");
const brandGrid = document.querySelector("#brand-grid");
const agentGrid = document.querySelector("#agent-grid");
const results = document.querySelector("#results");
const resultGrid = document.querySelector("#result-grid");
const resultTitle = document.querySelector("#result-title");
const clearResults = document.querySelector("#clear-results");
const productCount = document.querySelector("#product-count");
const brandCount = document.querySelector("#brand-count");
const agentCount = document.querySelector("#agent-count");
const updatedAt = document.querySelector("#updated-at");

const categoryLabels = {
  sneakers: { label: "Sneakers", icon: "SH" },
  tshirts: { label: "T-Shirts", icon: "TS" },
  boots: { label: "Boots", icon: "BT" },
  "designer-shoes": { label: "Designer Shoes", icon: "DS" },
  jackets: { label: "Jackets", icon: "JK" },
  hoodies: { label: "Hoodies & Sweatshirts", icon: "HD" },
  "sports-sets": { label: "Jerseys", icon: "JR" },
  "pants-shorts": { label: "Trousers & Pants", icon: "PT" },
  "designer-bags": { label: "Bags", icon: "BG" },
  "designer-watches": { label: "Watches", icon: "WT" },
  "other-accessories": { label: "Accessories", icon: "AC" },
  electronics: { label: "Electronics", icon: "EL" }
};

const categoryOrder = [
  "sneakers",
  "tshirts",
  "boots",
  "designer-shoes",
  "jackets",
  "hoodies",
  "sports-sets",
  "pants-shorts",
  "designer-bags",
  "designer-watches",
  "other-accessories",
  "electronics"
];

const agents = [
  ["LoongBuy", "LB", "#ff7a00"],
  ["OopBuy", "OB", "#ff2d8f"],
  ["JoyAGoo", "JA", "#c7ff00"],
  ["Lovegobuy", "LG", "#ff384f"],
  ["Hipobuy", "HB", "#1f8bff"],
  ["Mulebuy", "MB", "#8d39ff"],
  ["Kakobuy", "KB", "#ff3448"],
  ["Superbuy", "SB", "#f04438"],
  ["CSSBuy", "CSS", "#5dc629"],
  ["Sugargoo", "SG", "#ffb000"],
  ["Orientdig", "OD", "#ff8c16"],
  ["AllChinaBuy", "ACB", "#2f7fff"]
];

const iconify = (name) => `https://api.iconify.design/${name}.svg?color=%23eef2ff`;
const simpleIcon = (name) => `https://cdn.simpleicons.org/${name}/ffffff`;
const favicon = (domain) => `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
const svgData = (svg) => `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
const xmlEscape = (value) => String(value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;");
const tileIcon = (mark, label, accent = "#b6ff22") => {
  const text = xmlEscape(String(mark || label || "?").slice(0, 4).toUpperCase());
  const aria = xmlEscape(String(label || text));
  return svgData(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" role="img" aria-label="${aria}">
      <rect x="4" y="4" width="88" height="88" rx="18" fill="#111726" stroke="rgba(255,255,255,.16)" stroke-width="2"/>
      <rect x="10" y="10" width="76" height="76" rx="14" fill="rgba(255,255,255,.035)"/>
      <text x="48" y="56" text-anchor="middle" dominant-baseline="middle" font-family="Inter,Arial,sans-serif" font-size="${text.length > 2 ? 26 : 36}" font-weight="900" fill="${accent}">${text}</text>
    </svg>
  `);
};

const visualCategories = {
  sneakers: { label: "Sneakers", mark: "SN", image: iconify("mdi:shoe-sneaker") },
  tshirts: { label: "T-Shirts", mark: "TS", image: iconify("mdi:tshirt-crew") },
  boots: { label: "Boots", mark: "BT", image: iconify("game-icons:chelsea-boot") },
  "designer-shoes": { label: "Leather Shoes", mark: "LS", image: iconify("game-icons:flat-shoe") },
  jackets: { label: "Jackets", mark: "JK", image: iconify("game-icons:trench-body-armor") },
  hoodies: { label: "Hoodies & Sweatshirts", mark: "HD", image: iconify("game-icons:hoodie") },
  "sports-sets": { label: "Jerseys", mark: "7", image: iconify("game-icons:soccer-jersey") },
  "pants-shorts": { label: "Trousers & Pants", mark: "PT", image: iconify("game-icons:trousers") },
  "designer-bags": { label: "Bags", mark: "BG", image: iconify("mdi:bag-personal") },
  "designer-watches": { label: "Watches", mark: "WT", image: iconify("mdi:watch") },
  "other-accessories": { label: "Accessories", mark: "AC", image: iconify("mdi:sunglasses") },
  electronics: { label: "Electronics", mark: "EL", image: iconify("mdi:cellphone") }
};

Object.values(visualCategories).forEach((item) => {
  item.image = tileIcon(item.mark, item.label);
});

const visualAgents = {
  LoongBuy: favicon("loongbuy.com"),
  OopBuy: favicon("oopbuy.com"),
  JoyAGoo: favicon("joyagoo.com"),
  Lovegobuy: favicon("lovegobuy.com"),
  Hipobuy: favicon("hipobuy.com"),
  Mulebuy: favicon("mulebuy.com"),
  Kakobuy: favicon("kakobuy.com"),
  Superbuy: favicon("superbuy.com"),
  CSSBuy: favicon("cssbuy.com"),
  Sugargoo: favicon("sugargoo.com"),
  Orientdig: favicon("orientdig.com"),
  AllChinaBuy: favicon("allchinabuy.com")
};

const extraAgents = [
  ["LitBuy", "LIT", "#ffcf00", favicon("litbuy.com")],
  ["MyCNBox", "MCB", "#ff1717", favicon("mycnbox.com")],
  ["RizzitGO", "R", "#b6ff00", favicon("rizzitgo.com")],
  ["Vigorbuy", "VB", "#ff174d", favicon("vigorbuy.com")],
  ["iTaoBuy", "ITB", "#ff7200", favicon("itaobuy.com")],
  ["FishGoo", "FG", "#2f7fff", favicon("fishgoo.com")],
  ["Eastmallbuy", "EM", "#ffffff", favicon("eastmallbuy.com")],
  ["OODTBuy", "OOD", "#ff7a00", favicon("oodtbuy.com")],
  ["OKEYHAUL", "OK", "#ff7300", favicon("okeyhaul.com")],
  ["GTBuy", "GT", "#ff6400", favicon("gtbuy.com")],
  ["Boonbuy", "BB", "#ff9a00", favicon("boonbuy.com")]
];

const agentImage = (name, mark, image) => image || visualAgents[name] || tileIcon(mark, name, "#ff8c16");
const brandImage = (brand, mark) => brandImages[brand] || tileIcon(mark, brand, "#eef2ff");

const brandImages = {
  "Adidas": simpleIcon("adidas"),
  "Air Jordan": simpleIcon("jumpman"),
  "Apple": simpleIcon("apple"),
  "Balenciaga": simpleIcon("balenciaga"),
  "BAPE": favicon("bape.com"),
  "Burberry": simpleIcon("burberry"),
  "Carhartt WIP": simpleIcon("carhartt"),
  "Cartier": simpleIcon("cartier"),
  "Chanel": simpleIcon("chanel"),
  "Chrome Hearts": favicon("chromehearts.com"),
  "Corteiz": favicon("crtz.xyz"),
  "Dior": simpleIcon("dior"),
  "DSquared2": favicon("dsquared2.com"),
  "Fear of God Essentials": favicon("fearofgod.com"),
  "Fendi": simpleIcon("fendi"),
  "Gallery Dept.": favicon("gallerydept.com"),
  "Givenchy": simpleIcon("givenchy"),
  "Golden Goose": favicon("goldengoose.com"),
  "Gucci": simpleIcon("gucci"),
  "Hellstar": favicon("hellstar.com"),
  "Hermes": simpleIcon("hermes"),
  "Hoka": simpleIcon("hoka"),
  "JBL": simpleIcon("jbl"),
  "Kenzo": favicon("kenzo.com"),
  "Lacoste": simpleIcon("lacoste"),
  "Lanvin": favicon("lanvin.com"),
  "Loewe": simpleIcon("loewe"),
  "Louis Vuitton": simpleIcon("louisvuitton"),
  "Maison Margiela": favicon("maisonmargiela.com"),
  "Moncler": simpleIcon("moncler"),
  "New Balance": simpleIcon("newbalance"),
  "Nike": simpleIcon("nike"),
  "Off-White": simpleIcon("offwhite"),
  "On Running": favicon("on.com"),
  "Onitsuka Tiger": favicon("onitsukatiger.com"),
  "Palm Angels": favicon("palmangels.com"),
  "PlayStation": simpleIcon("playstation"),
  "Polo Ralph Lauren": simpleIcon("ralphlauren"),
  "Prada": simpleIcon("prada"),
  "Rolex": simpleIcon("rolex"),
  "Stone Island": favicon("stoneisland.com"),
  "Stussy": simpleIcon("stussy"),
  "Supreme": simpleIcon("supreme"),
  "Swarovski": simpleIcon("swarovski"),
  "The North Face": simpleIcon("thenorthface"),
  "Tom Ford": favicon("tomford.com"),
  "Tommy Hilfiger": simpleIcon("tommyhilfiger"),
  "Trapstar": favicon("trapstarlondon.com"),
  "Under Armour": simpleIcon("underarmour"),
  "Valentino": favicon("valentino.com"),
  "Vans": simpleIcon("vans"),
  "Versace": favicon("versace.com"),
  "YSL": simpleIcon("ysl"),
  "Yamaha": simpleIcon("yamaha")
};

const normalize = (value) => {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[-_/]+/g, " ")
    .replace(/\s+/g, " ");
};

const escapeHtml = (value) => {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
};

const safeUrl = (value) => {
  try {
    const url = new URL(String(value || ""), window.location.href);
    if (url.protocol === "data:" && url.href.startsWith("data:image/svg+xml")) return url.href;
    return ["http:", "https:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
};

const renderIconMark = ({ image, mark, label }) => {
  const fallback = escapeHtml(mark || String(label || "?").slice(0, 3).toUpperCase());
  const fallbackImage = safeUrl(tileIcon(mark, label, "#b6ff22"));
  if (!image) return `<span class="icon-mark"><b>${fallback}</b></span>`;
  return `
    <span class="icon-mark image-mark">
      <img src="${escapeHtml(safeUrl(image))}" data-fallback-src="${escapeHtml(fallbackImage)}" alt="" loading="lazy" decoding="async" />
      <b hidden>${fallback}</b>
    </span>
  `;
};

const attachIconFallbacks = (root = document) => {
  root.querySelectorAll(".icon-mark img[data-fallback-src]").forEach((img) => {
    const fallbackSrc = img.dataset.fallbackSrc;
    if (!fallbackSrc || img.dataset.fallbackReady) return;
    img.dataset.fallbackReady = "true";
    const useFallback = () => {
      if (img.src !== fallbackSrc) img.src = fallbackSrc;
    };
    img.addEventListener("error", useFallback, { once: true });
    if (img.complete && img.naturalWidth === 0) useFallback();
  });
};

const compact = (value) => {
  return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(Number(value) || 0);
};

const getBrand = (product) => String(product.brand || product.subcategory || "Other").trim();

const slugify = (value) => {
  return String(value || "item")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90) || "item";
};

const usedSlugs = new Map();
const getProductSlug = (product) => {
  if (product._seoSlug) return product._seoSlug;
  const base = slugify(`${getBrand(product)} ${product.title || "product"} ${product.sourceItemId || ""}`);
  const used = usedSlugs.get(base) || 0;
  usedSlugs.set(base, used + 1);
  product._seoSlug = used ? `${base}-${used + 1}` : base;
  return product._seoSlug;
};

const getSearchText = (product) => {
  return normalize([
    product.title,
    product.originalTitle,
    product.brand,
    product.category,
    product.categoryLabel,
    product.subcategory,
    product.sourceItemId,
    product.url,
    product.price,
    product.priceCny,
    product.alt
  ].filter(Boolean).join(" "));
};

const realProducts = products.filter((product) => {
  const image = String(product.image || "");
  return image && !image.includes("nova-finds-hero.png") && !image.includes("images.unsplash.com");
});

realProducts.forEach(getProductSlug);

const renderStats = () => {
  const brands = new Set(realProducts.map(getBrand).filter((brand) => brand && brand.toLowerCase() !== "other"));
  productCount.textContent = compact(realProducts.length);
  brandCount.textContent = compact(brands.size);
  agentCount.textContent = compact(agents.length + extraAgents.length);
  updatedAt.textContent = new Intl.DateTimeFormat("en", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(new Date());
};

const countCategories = () => {
  const counts = new Map();
  realProducts.forEach((product) => {
    if (product.category) counts.set(product.category, (counts.get(product.category) || 0) + 1);
    if (Array.isArray(product.extraCategories)) {
      product.extraCategories.forEach((item) => {
        if (item?.category) counts.set(item.category, (counts.get(item.category) || 0) + 1);
      });
    }
  });
  return counts;
};

const renderCategories = () => {
  const counts = countCategories();
  const entries = categoryOrder
    .filter((category) => counts.has(category))
    .map((category) => [category, counts.get(category)]);

  categoryGrid.innerHTML = entries.map(([category, count]) => {
    const item = visualCategories[category] || categoryLabels[category] || { label: category, mark: "QC" };
    return `
      <a class="icon-card" href="/categories/${escapeHtml(category)}/" data-category="${escapeHtml(category)}">
        ${renderIconMark({ ...item, mark: item.mark || item.icon })}
        <span>${escapeHtml(item.label)}</span>
        <small>${escapeHtml(compact(count))}</small>
      </a>
    `;
  }).join("");
};

const renderBrands = () => {
  const counts = new Map();
  realProducts.forEach((product) => {
    const brand = getBrand(product);
    if (!brand || brand.toLowerCase() === "other") return;
    counts.set(brand, (counts.get(brand) || 0) + 1);
  });

  const entries = [...counts.entries()]
    .sort((first, second) => second[1] - first[1] || first[0].localeCompare(second[0]))
    .slice(0, 36);

  brandGrid.innerHTML = entries.map(([brand, count]) => {
    const mark = brand.split(/\s+/).map((part) => part[0]).join("").slice(0, 3).toUpperCase();
    return `
      <a class="icon-card" href="/brands/${escapeHtml(slugify(brand))}/" data-query="${escapeHtml(brand)}">
        ${renderIconMark({ image: brandImage(brand, mark), mark, label: brand })}
        <span>${escapeHtml(brand)}</span>
        <small>${escapeHtml(compact(count))}</small>
      </a>
    `;
  }).join("");
};

const renderAgents = () => {
  agentGrid.innerHTML = [...agents, ...extraAgents].map(([name, mark, color, image]) => {
    return `
      <button class="icon-card" type="button" data-agent="${escapeHtml(name)}" style="--brand-color:${escapeHtml(color)}">
        ${renderIconMark({ image: agentImage(name, mark, image), mark, label: name })}
        <span>${escapeHtml(name)}</span>
      </button>
    `;
  }).join("");
};

const getProductUrl = (product) => `/products/${getProductSlug(product)}/`;

const renderResults = (items, label) => {
  const shown = items.slice(0, 48);
  results.hidden = false;
  resultTitle.textContent = `${label} - ${items.length} results`;
  resultGrid.innerHTML = shown.length
    ? shown.map((product) => `
      <a class="result-card" href="${escapeHtml(getProductUrl(product))}">
        <img src="${escapeHtml(safeUrl(product.image))}" alt="${escapeHtml(product.alt || product.title || "Product QC photos")}" loading="lazy" />
        <span class="result-info">
          <strong>${escapeHtml(product.title || "Product")}</strong>
          <span>${escapeHtml(getBrand(product))} - ${escapeHtml(product.sourceItemId || "")}</span>
        </span>
      </a>
    `).join("")
    : `<p>No matching products found.</p>`;
  results.scrollIntoView({ behavior: "smooth", block: "start" });
};

const searchProducts = (query) => {
  const term = normalize(query);
  if (!term) return;
  const items = realProducts.filter((product) => getSearchText(product).includes(term));
  renderResults(items, query);
};

searchForm.addEventListener("submit", (event) => {
  event.preventDefault();
  searchProducts(searchInput.value);
});

document.addEventListener("click", (event) => {
  const categoryLink = event.target.closest("[data-category]");
  if (categoryLink && event.metaKey) return;

  const queryLink = event.target.closest("[data-query]");
  if (queryLink && event.metaKey) return;

  const modeButton = event.target.closest("[data-mode-search]");
  if (modeButton && !modeButton.disabled) {
    searchInput.focus();
  }
});

clearResults.addEventListener("click", () => {
  results.hidden = true;
  resultGrid.innerHTML = "";
  searchInput.value = "";
  searchInput.focus();
});

renderStats();
renderCategories();
renderBrands();
renderAgents();
attachIconFallbacks();
