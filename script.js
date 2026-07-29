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
const logoTile = (label, mark, accent = "#eef2ff") => {
  const words = String(label || mark || "?").replace(/&/g, " ").split(/\s+/).filter(Boolean);
  const firstLine = xmlEscape(words.slice(0, 2).join(" ").slice(0, 13) || mark || "?");
  const secondLine = xmlEscape(words.slice(2, 4).join(" ").slice(0, 13));
  const hasSecondLine = Boolean(secondLine);
  return svgData(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" role="img" aria-label="${xmlEscape(label || mark || "?")}">
      <rect x="4" y="4" width="88" height="88" rx="18" fill="#111726" stroke="rgba(255,255,255,.14)" stroke-width="2"/>
      <rect x="10" y="10" width="76" height="76" rx="14" fill="rgba(255,255,255,.035)"/>
      <text x="48" y="${hasSecondLine ? 43 : 50}" text-anchor="middle" dominant-baseline="middle" font-family="Inter,Arial,sans-serif" font-size="${firstLine.length > 9 ? 12 : 15}" font-weight="900" fill="${accent}">${firstLine}</text>
      ${hasSecondLine ? `<text x="48" y="61" text-anchor="middle" dominant-baseline="middle" font-family="Inter,Arial,sans-serif" font-size="${secondLine.length > 9 ? 12 : 15}" font-weight="900" fill="${accent}">${secondLine}</text>` : ""}
    </svg>
  `);
};
const brandLogo = (name, artwork) => svgData(`
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 96" role="img" aria-label="${xmlEscape(name)}">
    ${artwork}
  </svg>
`);
const brandWordmark = (name, text = name, size = 24, weight = 900, family = "Inter,Arial,sans-serif") => brandLogo(name, `
  <text x="80" y="54" text-anchor="middle" dominant-baseline="middle" font-family="${family}" font-size="${size}" font-weight="${weight}" fill="#eef2ff">${xmlEscape(text)}</text>
`);
const brandIcon = (file) => `/assets/brand-icons/${file}.png`;
const brandSvg = (file) => `/assets/brand-icons-svg/${file}.svg`;
const brandLogos = {
  "adidas": brandSvg("adidas"),
  "Adidas": brandSvg("adidas"),
  "Air Jordan": brandSvg("air-jordan"),
  "Alexander McQueen": brandIcon("alexander-mcqueen"),
  "Ami": brandIcon("ami"),
  "AMI": brandIcon("ami"),
  "Amiri": brandIcon("amiri"),
  "AMIRI": brandIcon("amiri"),
  "Apple": brandSvg("apple"),
  "Arc'teryx": brandIcon("arc-teryx"),
  "ASICS": brandSvg("asics"),
  "Balenciaga": brandSvg("balenciaga"),
  "BAPE": brandIcon("bape"),
  "Birkenstock": brandIcon("birkenstock"),
  "BOSS": brandSvg("boss"),
  "Bottega Veneta": brandIcon("bottega-veneta"),
  "Burberry": brandSvg("burberry"),
  "Bvlgari": brandIcon("bvlgari"),
  "C.P. Company": brandIcon("c-p-company"),
  "Cactus Plant Flea Market": brandIcon("cactus-plant-flea-market"),
  "Calvin Klein": brandSvg("calvin-klein"),
  "Canada Goose": brandIcon("canada-goose"),
  "Carhartt": brandIcon("carhartt"),
  "Carhartt WIP": brandIcon("carhartt-wip"),
  "Cartier": brandSvg("cartier"),
  "Casablanca": brandIcon("casablanca"),
  "Casio": brandIcon("casio"),
  "Celine": brandIcon("celine"),
  "Chanel": brandSvg("chanel"),
  "Christian Louboutin": brandIcon("christian-louboutin"),
  "Chrome Hearts": brandIcon("chrome-hearts"),
  "Comme des Gar\u00e7ons Play": brandIcon("comme-des-gar-ons-play"),
  "Comme des Gar\u00e7ons PLAY": brandIcon("comme-des-gar-ons-play"),
  "Converse": brandIcon("converse"),
  "Corteiz": brandIcon("corteiz"),
  "Crocs": brandIcon("crocs"),
  "Denim Tears": brandIcon("denim-tears"),
  "Diesel": brandIcon("diesel"),
  "Dior": brandSvg("dior"),
  "Dolce & Gabbana": brandIcon("dolce-gabbana"),
  "Emporio Armani": brandIcon("emporio-armani"),
  "Eric Emanuel": brandIcon("eric-emanuel"),
  "Fear of God Essentials": brandIcon("fear-of-god-essentials"),
  "Fendi": brandSvg("fendi"),
  "Gallery Dept.": brandIcon("gallery-dept"),
  "GAP": brandIcon("gap"),
  "Givenchy": brandSvg("givenchy"),
  "Golden Goose": brandIcon("golden-goose"),
  "Goyard": brandIcon("goyard"),
  "Gucci": brandSvg("gucci"),
  "Hellstar": brandIcon("hellstar"),
  "Herm\u00e8s": brandSvg("herm-s"),
  "Hoka": brandIcon("hoka"),
  "JBL": brandSvg("jbl"),
  "Kenzo": brandIcon("kenzo"),
  "Lacoste": brandSvg("lacoste"),
  "Lanvin": brandIcon("lanvin"),
  "Loewe": brandSvg("loewe"),
  "Loro Piana": brandIcon("loro-piana"),
  "Louis Vuitton": brandSvg("louis-vuitton"),
  "Maison Margiela": brandIcon("maison-margiela"),
  "Mertra": brandIcon("mertra"),
  "Miu Miu": brandIcon("miu-miu"),
  "Mixed Emotion": brandIcon("mixed-emotion"),
  "MLB": brandIcon("mlb"),
  "Moncler": brandSvg("moncler"),
  "Multiple Brands": brandIcon("other"),
  "NBA": brandIcon("nba"),
  "New Balance": brandSvg("new-balance"),
  "New Era": brandIcon("new-era"),
  "Nike": brandSvg("nike"),
  "NUMERIS": brandIcon("numeris"),
  "Off-White": brandSvg("off-white"),
  "On Running": brandIcon("on-running"),
  "Other": brandIcon("other"),
  "Palm Angels": brandIcon("palm-angels"),
  "Patagonia": brandIcon("patagonia"),
  "Patek Philippe": brandIcon("patek-philippe"),
  "Philipp Plein": brandIcon("philipp-plein"),
  "Polo Ralph Lauren": brandIcon("polo-ralph-lauren"),
  "Prada": brandSvg("prada"),
  "Puma": brandSvg("puma"),
  "Ray-Ban": brandIcon("ray-ban"),
  "Represent": brandIcon("represent"),
  "Rhude": brandIcon("rhude"),
  "Rolex": brandSvg("rolex"),
  "Salomon": brandSvg("salomon"),
  "Salvatore Ferragamo": brandIcon("salvatore-ferragamo"),
  "Sp5der": brandIcon("sp5der"),
  "Stone Island": brandSvg("stone-island"),
  "Stussy": brandIcon("stussy"),
  "Supreme": brandSvg("supreme"),
  "Swarovski": brandSvg("swarovski"),
  "SynaWorld": brandIcon("synaworld"),
  "The North Face": brandSvg("the-north-face"),
  "Timberland": brandSvg("timberland"),
  "Tom Ford": brandIcon("tom-ford"),
  "Tommy Hilfiger": brandIcon("tommy-hilfiger"),
  "Trapstar": brandIcon("trapstar"),
  "Travis Scott": brandIcon("travis-scott"),
  "UGG": brandIcon("ugg"),
  "Under Armour": brandSvg("under-armour"),
  "Valentino": brandSvg("valentino"),
  "Van Cleef": brandIcon("van-cleef"),
  "Vans": brandSvg("vans"),
  "Versace": brandSvg("versace"),
  "Vivienne Westwood": brandIcon("vivienne-westwood"),
  "Vlone": brandWordmark("Vlone", "VLONE", 36, 900),
  "YSL": brandIcon("ysl"),
};
const categoryIcon = (name, label) => {
  const common = `fill="none" stroke="#eef2ff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"`;
  const icons = {
    sneakers: `<path ${common} d="M18 58c12 2 24-1 36-11l8 9 16 4c5 1 7 5 5 10H17c-5 0-6-7 1-12Z"/><path ${common} d="M43 48l10 11M34 53l8 8"/>`,
    tshirts: `<path ${common} d="M34 18h28l10 8 12 5-9 16-10-4v35H31V43l-10 4-9-16 12-5 10-8Z"/><path ${common} d="M39 19c3 7 15 7 18 0"/>`,
    boots: `<path ${common} d="M32 18h22v38l21 6c7 2 10 7 8 14H26c-5 0-8-4-7-9l6-23c2-8 5-16 7-26Z"/><path ${common} d="M32 48h25M29 62h32"/>`,
    "designer-shoes": `<path ${common} d="M18 61c16 2 31-2 45-14l11 10c6 2 10 6 8 13H18c-5 0-7-5 0-9Z"/><path ${common} d="M40 54h17"/>`,
    jackets: `<path ${common} d="M36 17h24l14 10v50H22V27l14-10Z"/><path ${common} d="M48 22v55M34 35l-10-8M62 35l10-8"/>`,
    hoodies: `<path ${common} d="M30 39c0-17 36-17 36 0l12 9v29H18V48l12-9Z"/><path ${common} d="M36 39c4 7 20 7 24 0M36 56v13M60 56v13"/>`,
    "sports-sets": `<path ${common} d="M34 17h28l10 8 11 6-8 15-10-4v36H31V42l-10 4-8-15 11-6 10-8Z"/><text x="48" y="61" text-anchor="middle" font-family="Inter,Arial,sans-serif" font-size="30" font-weight="900" fill="#eef2ff">7</text>`,
    "pants-shorts": `<path ${common} d="M30 17h36l-5 61H48l-3-34-8 34H24l6-61Z"/><path ${common} d="M31 30h34M48 18v24"/>`,
    "designer-bags": `<rect ${common} x="24" y="35" width="48" height="42" rx="8"/><path ${common} d="M36 35c0-18 24-18 24 0"/>`,
    "designer-watches": `<path ${common} d="M39 15h18l4 20a18 18 0 0 1 0 26l-4 20H39l-4-20a18 18 0 0 1 0-26l4-20Z"/><circle ${common} cx="48" cy="48" r="15"/>`,
    "other-accessories": `<path ${common} d="M14 45h22l7 16h10l7-16h22"/><circle ${common} cx="27" cy="45" r="13"/><circle ${common} cx="69" cy="45" r="13"/>`,
    electronics: `<rect ${common} x="32" y="13" width="32" height="70" rx="8"/><path ${common} d="M44 72h8"/>`
  };
  return svgData(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" role="img" aria-label="${xmlEscape(label)}">
      ${icons[name] || `<text x="48" y="56" text-anchor="middle" font-family="Inter,Arial,sans-serif" font-size="28" font-weight="900" fill="#eef2ff">${xmlEscape(String(label || "?").slice(0, 2).toUpperCase())}</text>`}
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

Object.entries(visualCategories).forEach(([name, item]) => {
  item.image = categoryIcon(name, item.label);
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

const agentImage = (name, mark, image) => image || visualAgents[name] || logoTile(name, mark, "#ff8c16");
const brandImage = (brand, mark) => brandImages[brand] || brandWordmark(brand, brand, brand.length > 10 ? 18 : 28, 900);

const brandImages = {
  ...brandLogos,
  "Carhartt WIP": brandLogos["Carhartt WIP"] || brandIcon("carhartt-wip"),
  "Cartier": brandLogos["Cartier"] || brandIcon("cartier"),
  "Celine": brandLogos["Celine"] || brandIcon("celine"),
  "Chanel": brandLogos["Chanel"] || brandIcon("chanel"),
  "Dsquared2": brandWordmark("Dsquared2", "D2", 38, 900),
  "DSquared2": brandWordmark("DSquared2", "D2", 38, 900),
  "Fendi": brandLogos["Fendi"] || brandIcon("fendi"),
  "Givenchy": brandLogos["Givenchy"] || brandIcon("givenchy"),
  "Lacoste": brandLogos["Lacoste"] || brandIcon("lacoste"),
  "Loewe": brandLogos["Loewe"] || brandIcon("loewe"),
  "Moncler": brandLogos["Moncler"] || brandIcon("moncler"),
  "Prada": brandLogos["Prada"] || brandIcon("prada"),
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
  const fallbackImage = safeUrl(brandWordmark(label, label, String(label || "").length > 10 ? 18 : 28, 900));
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
