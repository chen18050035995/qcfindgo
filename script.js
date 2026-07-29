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
const updatedAt = document.querySelector("#updated-at");

const categoryLabels = {
  sneakers: { label: "Sneakers", icon: "♟" },
  tshirts: { label: "T-Shirts", icon: "♜" },
  boots: { label: "Boots", icon: "▰" },
  "designer-shoes": { label: "Leather Shoes", icon: "▱" },
  jackets: { label: "Jackets", icon: "▥" },
  hoodies: { label: "Hoodies & Sweatshirts", icon: "▧" },
  "sports-sets": { label: "Jerseys", icon: "7" },
  "pants-shorts": { label: "Trousers & Pants", icon: "▤" },
  "designer-bags": { label: "Bags", icon: "▣" },
  "designer-watches": { label: "Watches", icon: "◎" },
  "other-accessories": { label: "Accessories", icon: "◇" },
  electronics: { label: "Electronics", icon: "▢" }
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
    return ["http:", "https:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
};

const compact = (value) => {
  return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(Number(value) || 0);
};

const getBrand = (product) => String(product.brand || product.subcategory || "Other").trim();

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

const renderStats = () => {
  const brands = new Set(realProducts.map(getBrand).filter((brand) => brand && brand.toLowerCase() !== "other"));
  productCount.textContent = compact(realProducts.length);
  brandCount.textContent = compact(brands.size);
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
    const item = categoryLabels[category] || { label: category, icon: "▥" };
    return `
      <button class="icon-card" type="button" data-category="${escapeHtml(category)}">
        <span class="icon-mark">${escapeHtml(item.icon)}</span>
        <span>${escapeHtml(item.label)}</span>
        <small>${escapeHtml(compact(count))}</small>
      </button>
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
      <button class="icon-card" type="button" data-query="${escapeHtml(brand)}">
        <span class="icon-mark">${escapeHtml(mark)}</span>
        <span>${escapeHtml(brand)}</span>
        <small>${escapeHtml(compact(count))}</small>
      </button>
    `;
  }).join("");
};

const renderAgents = () => {
  agentGrid.innerHTML = agents.map(([name, mark, color]) => {
    return `
      <button class="icon-card" type="button" data-agent="${escapeHtml(name)}" style="--brand-color:${escapeHtml(color)}">
        <span class="icon-mark">${escapeHtml(mark)}</span>
        <span>${escapeHtml(name)}</span>
      </button>
    `;
  }).join("");
};

const getProductUrl = (product) => {
  const id = product.sourceItemId ? `?id=${encodeURIComponent(product.sourceItemId)}` : "";
  return `https://www.novafindsgo.com/product.html${id}`;
};

const renderResults = (items, label) => {
  const shown = items.slice(0, 48);
  results.hidden = false;
  resultTitle.textContent = `${label} · ${items.length} results`;
  resultGrid.innerHTML = shown.length
    ? shown.map((product) => `
      <a class="result-card" href="${escapeHtml(getProductUrl(product))}" target="_blank" rel="noopener noreferrer">
        <img src="${escapeHtml(safeUrl(product.image))}" alt="${escapeHtml(product.alt || product.title || "Product")}" loading="lazy" />
        <span class="result-info">
          <strong>${escapeHtml(product.title || "Product")}</strong>
          <span>${escapeHtml(getBrand(product))} · ${escapeHtml(product.sourceItemId || "")}</span>
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
  const categoryButton = event.target.closest("[data-category]");
  if (categoryButton) {
    const category = categoryButton.dataset.category;
    const items = realProducts.filter((product) => {
      const extra = Array.isArray(product.extraCategories) && product.extraCategories.some((item) => item?.category === category);
      return product.category === category || extra;
    });
    renderResults(items, categoryLabels[category]?.label || category);
    return;
  }

  const queryButton = event.target.closest("[data-query]");
  if (queryButton) {
    searchInput.value = queryButton.dataset.query || "";
    searchProducts(searchInput.value);
    return;
  }

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
