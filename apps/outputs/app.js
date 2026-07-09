const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const viewTitles = {
  dashboard: "Dashboard",
  radar: "Radar de Preços",
  importRadar: "Radar de Importação",
  pricing: "Precificação",
  offers: "Gerador de Ofertas",
  products: "Produtos e Estoque",
  clients: "Clientes",
  suppliers: "Fornecedores",
  finance: "Financeiro",
  bi: "Business Intelligence",
  users: "Usuários",
  settings: "Configurações",
};

const importConfigStorageKey = "inest.importFinancialConfiguration";

const importFinancialConfiguration = {
  dollarQuote: 5.35,
  cdeExitPerBox: 110,
  brazilDispatchPerBox: 50,
  invoiceTaxPercent: 3,
  correiosLabel: 120,
};

const importRedirectRules = [
  { type: "Perfume", cost: 25, terms: ["perfume"] },
  { type: "iPhone 15 ao 17 Pro Max", cost: 100, terms: ["iphone 15", "iphone 16", "iphone 17", "pro max"] },
  { type: "iPhone 14 Pro Max e abaixo / outros celulares", cost: 60, terms: ["iphone 14", "iphone 13", "iphone 12", "celular"] },
  { type: "MacBook / Notebook", cost: 200, terms: ["macbook", "notebook"] },
  { type: "iPad", cost: 100, terms: ["ipad"] },
  { type: "Apple Watch / Garmin", cost: 60, terms: ["apple watch", "garmin"] },
  { type: "Outros Smart Watches", cost: 30, terms: ["smart watch", "smartwatch"] },
];

const importMockProducts = [
  { id: "cp-ip16pm-256", name: "iPhone 16 Pro Max 256GB Natural", url: "https://www.comprasparaguai.com.br/busca/?q=iphone%2016%20pro%20max", priceUsd: 1190 },
  { id: "cp-ip14pm-128", name: "iPhone 14 Pro Max 128GB Roxo", url: "https://www.comprasparaguai.com.br/busca/?q=iphone%2014%20pro%20max", priceUsd: 780 },
  { id: "cp-mba-m3", name: "MacBook Air M3 256GB Meia-noite", url: "https://www.comprasparaguai.com.br/busca/?q=macbook%20air%20m3", priceUsd: 1120 },
  { id: "cp-ipad-air", name: "iPad Air 128GB Azul", url: "https://www.comprasparaguai.com.br/busca/?q=ipad%20air", priceUsd: 620 },
  { id: "cp-watch-garmin", name: "Garmin Forerunner 965", url: "https://www.comprasparaguai.com.br/busca/?q=garmin%20forerunner", priceUsd: 430 },
  { id: "cp-perfume", name: "Perfume Bleu de Chanel 100ml", url: "https://www.comprasparaguai.com.br/busca/?q=bleu%20de%20chanel", priceUsd: 118 },
  { id: "cp-smart-watch", name: "Smart Watch Xiaomi Redmi Watch 4", url: "https://www.comprasparaguai.com.br/busca/?q=smart%20watch", priceUsd: 82 },
];

const importState = {
  query: "",
  loading: false,
  selectedProductId: null,
  selectedType: "",
};

const prices = [
  { product: "iPhone 15 Pro 256GB Natural", supplier: "Prime Imports", cost: 5890, variation: -3.8, stock: 7, deadline: "3-5 dias úteis", city: "São Paulo", quality: "Grade A+", status: "Aprovado" },
  { product: "iPhone 15 128GB Preto", supplier: "Alpha Mobile", cost: 4210, variation: 1.2, stock: 12, deadline: "1-2 dias úteis", city: "Campinas", quality: "Sem alertas", status: "Aprovado" },
  { product: "iPhone 14 128GB Estelar", supplier: "Connect BR", cost: 3340, variation: -1.6, stock: 4, deadline: "7-10 dias úteis", city: "Santos", quality: "Excelente Estado", status: "Aprovado" },
  { product: "iPhone 13 128GB Meia-noite", supplier: "Prime Imports", cost: 2860, variation: 0.4, stock: 18, deadline: "3-5 dias úteis", city: "São Paulo", quality: "Grade B", status: "Oculto" },
  { product: "AirPods Pro 2", supplier: "Global Tech", cost: 1280, variation: -5.1, stock: 23, deadline: "1-2 dias úteis", city: "Rio de Janeiro", quality: "AS IS Premium", status: "Aprovado" },
];

const financialConfiguration = {
  fixedCost: 180,
  defaultFreight: 120,
  defaultPaymentFee: 90,
  defaultDesiredProfit: 650,
};

const modelProfitSheet = {
  "iPhone 16 Pro Max": 980,
  "iPhone 15 Pro": 920,
  "iPhone 15": 720,
  "iPhone 14": 620,
  "MacBook Air M3": 1250,
  "iPad Air": 700,
  "Apple Watch S9": 430,
  "AirPods Pro 2": 360,
};

const pricingProducts = [
  { id: "ip16pm-256-natural", model: "iPhone 16 Pro Max", category: "iPhone", status: "Novo", color: "Natural Titanium", capacity: "256GB", supplier: "Prime Imports", city: "Sao Paulo", deadline: "3-5 dias uteis", cost: 7310, updatedAt: "2026-07-07T09:30:00", createdAt: "2026-07-07T08:40:00", warranty: "1 ano de garantia Apple", imageTone: "titanium" },
  { id: "ip15pro-256-natural", model: "iPhone 15 Pro", category: "iPhone", status: "Seminovo", color: "Natural", capacity: "256GB", supplier: "Prime Imports", city: "Sao Paulo", deadline: "3-5 dias uteis", cost: 5890, updatedAt: "2026-07-07T09:12:00", createdAt: "2026-07-06T16:10:00", warranty: "6 meses de garantia pela loja", imageTone: "natural" },
  { id: "ip15-128-black", model: "iPhone 15", category: "iPhone", status: "Novo", color: "Preto", capacity: "128GB", supplier: "Alpha Mobile", city: "Campinas", deadline: "1-2 dias uteis", cost: 4210, updatedAt: "2026-07-07T08:55:00", createdAt: "2026-07-07T08:10:00", warranty: "1 ano de garantia Apple", imageTone: "black" },
  { id: "ip14-128-starlight", model: "iPhone 14", category: "iPhone", status: "CPO", color: "Estelar", capacity: "128GB", supplier: "Connect BR", city: "Santos", deadline: "7-10 dias uteis", cost: 3340, updatedAt: "2026-07-06T17:20:00", createdAt: "2026-07-05T11:15:00", warranty: "6 meses de garantia pela loja", imageTone: "starlight" },
  { id: "mba-m3-256-midnight", model: "MacBook Air M3", category: "MacBook", status: "Novo", color: "Meia-noite", capacity: "256GB", supplier: "Global Tech", city: "Rio de Janeiro", deadline: "7-10 dias uteis", cost: 7380, updatedAt: "2026-07-07T10:04:00", createdAt: "2026-07-04T13:35:00", warranty: "1 ano de garantia Apple", imageTone: "midnight" },
  { id: "ipad-air-128-blue", model: "iPad Air", category: "iPad", status: "Novo", color: "Azul", capacity: "128GB", supplier: "Alpha Mobile", city: "Campinas", deadline: "1-2 dias uteis", cost: 3890, updatedAt: "2026-07-07T07:45:00", createdAt: "2026-07-06T09:20:00", warranty: "1 ano de garantia Apple", imageTone: "blue" },
  { id: "watch-s9-45-graphite", model: "Apple Watch S9", category: "Apple Watch", status: "Seminovo", color: "Grafite", capacity: "45mm", supplier: "Connect BR", city: "Santos", deadline: "3-5 dias uteis", cost: 2360, updatedAt: "2026-07-06T15:35:00", createdAt: "2026-07-05T15:05:00", warranty: "6 meses de garantia pela loja", imageTone: "graphite" },
  { id: "airpods-pro-2-usbc", model: "AirPods Pro 2", category: "AirPods", status: "Novo", color: "Branco", capacity: "USB-C", supplier: "Global Tech", city: "Rio de Janeiro", deadline: "1-2 dias uteis", cost: 1280, updatedAt: "2026-07-07T09:50:00", createdAt: "2026-07-07T09:00:00", warranty: "1 ano de garantia Apple", imageTone: "white" },
];

const pricingState = {
  page: 1,
  pageSize: 5,
  mode: "list",
  loading: true,
};

const approvedQualities = ["Grade A+", "Excelente Estado", "AS IS Premium", "Sem alertas"];

const alerts = [
  ["Preço caiu", "AirPods Pro 2 reduziu 5,1% no fornecedor Global Tech."],
  ["Margem abaixo da meta", "iPhone 15 Pro Max está com margem projetada de 17,6%."],
  ["Reserva pendente", "3 unidades aguardam confirmação de pagamento."],
];

const activities = [
  ["Oferta enviada", "Marina Alves recebeu oferta de iPhone 15 Pro 256GB."],
  ["Entrada no estoque", "5 unidades de iPhone 14 128GB registradas com IMEI."],
  ["Despesa lançada", "Frete internacional categorizado no financeiro."],
  ["Fornecedor atualizado", "Prime Imports enviou nova lista de preços."],
];

const products = [
  ["iPhone 15 Pro", "256GB Natural", "7 unidades", "R$ 6.890"],
  ["iPhone 15", "128GB Preto", "12 unidades", "R$ 5.120"],
  ["iPhone 14", "128GB Estelar", "4 unidades", "R$ 4.180"],
  ["iPhone 13", "128GB Meia-noite", "18 unidades", "R$ 3.540"],
  ["AirPods Pro 2", "USB-C", "23 unidades", "R$ 1.790"],
  ["Apple Watch S9", "45mm Grafite", "6 unidades", "R$ 3.120"],
];

const clients = [
  ["Marina Alves", "São Paulo", "Indicação", "R$ 6.420", "Hoje"],
  ["Rafael Lima", "Campinas", "Instagram", "R$ 4.870", "Ontem"],
  ["Bianca Costa", "Santos", "WhatsApp", "R$ 5.210", "03/07/2026"],
  ["Lucas Pereira", "Rio de Janeiro", "Meta Ads", "R$ 3.980", "01/07/2026"],
];

const suppliers = [
  { name: "Prime Imports", city: "São Paulo", state: "SP", phone: "(11) 99999-9999", whatsapp: "(11) 99999-9999", whatsappLink: "https://wa.me/5511999999999", notes: "Fornecedor premium com listas diárias.", status: "Ativo", contact: "Bruno Martins", partnerSince: "18 meses", activeProducts: 38, lastUpdate: "07/07 às 09:30", reliability: "96%" },
  { name: "Alpha Mobile", city: "Campinas", state: "SP", phone: "(19) 98888-8888", whatsapp: "(19) 98888-8888", whatsappLink: "https://wa.me/5519988888888", notes: "Boa disponibilidade de lacrados.", status: "Ativo", contact: "Carla Nunes", partnerSince: "12 meses", activeProducts: 24, lastUpdate: "07/07 às 08:55", reliability: "91%" },
  { name: "Connect BR", city: "Santos", state: "SP", phone: "(13) 97777-7777", whatsapp: "(13) 97777-7777", whatsappLink: "https://wa.me/5513977777777", notes: "Forte em seminovos e CPO.", status: "Ativo", contact: "Diego Ramos", partnerSince: "9 meses", activeProducts: 19, lastUpdate: "06/07 às 17:20", reliability: "88%" },
  { name: "Global Tech", city: "Rio de Janeiro", state: "RJ", phone: "(21) 96666-6666", whatsapp: "(21) 96666-6666", whatsappLink: "https://wa.me/5521966666666", notes: "Atualiza AirPods, iPads e MacBooks com frequência.", status: "Ativo", contact: "Paula Ferraz", partnerSince: "15 meses", activeProducts: 31, lastUpdate: "07/07 às 10:04", reliability: "93%" },
];

const users = [
  ["Julio Admin", "Administrador", "Ativo", "Agora", "Todos os módulos"],
  ["Ana Gestora", "Gestor", "Ativo", "Hoje, 14:20", "Comercial e financeiro"],
  ["Pedro Operador", "Operador", "Ativo", "Ontem, 18:10", "Ofertas, clientes e estoque"],
];

function setView(viewName) {
  document.querySelectorAll(".view").forEach((view) => {
    view.classList.toggle("active", view.id === viewName);
  });
  document.querySelectorAll(".nav-item").forEach((item) => {
    item.classList.toggle("active", item.dataset.view === viewName);
  });
  document.getElementById("viewTitle").textContent = viewTitles[viewName];
  document.getElementById("sidebar").classList.remove("open");
}

function statusClass(value) {
  if (value < 0) return "positive";
  if (value > 1) return "negative";
  return "neutral";
}

function money(value) {
  return currency.format(value);
}

function numberOrFallback(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function getImportProductType(productName) {
  const normalized = productName.toLowerCase();
  return importRedirectRules.find((rule) => rule.terms.some((term) => normalized.includes(term)))?.type || "";
}

function getImportRedirectRule(type) {
  return importRedirectRules.find((rule) => rule.type === type);
}

function getSelectedImportProduct() {
  return importMockProducts.find((product) => product.id === importState.selectedProductId);
}

function getFilteredImportProducts() {
  const query = importState.query.trim().toLowerCase();
  if (!query) return importMockProducts;
  return importMockProducts.filter((product) => product.name.toLowerCase().includes(query));
}

function loadImportConfigFromStorage() {
  const saved = localStorage.getItem(importConfigStorageKey);
  if (!saved) return;

  try {
    const parsed = JSON.parse(saved);
    Object.assign(importFinancialConfiguration, {
      dollarQuote: numberOrFallback(parsed.financial?.dollarQuote, importFinancialConfiguration.dollarQuote),
      cdeExitPerBox: numberOrFallback(parsed.financial?.cdeExitPerBox, importFinancialConfiguration.cdeExitPerBox),
      brazilDispatchPerBox: numberOrFallback(parsed.financial?.brazilDispatchPerBox, importFinancialConfiguration.brazilDispatchPerBox),
      invoiceTaxPercent: numberOrFallback(parsed.financial?.invoiceTaxPercent, importFinancialConfiguration.invoiceTaxPercent),
      correiosLabel: numberOrFallback(parsed.financial?.correiosLabel, importFinancialConfiguration.correiosLabel),
    });

    if (Array.isArray(parsed.redirectRules)) {
      parsed.redirectRules.forEach((savedRule) => {
        const rule = importRedirectRules.find((item) => item.type === savedRule.type);
        if (rule) {
          rule.cost = numberOrFallback(savedRule.cost, rule.cost);
        }
      });
    }
  } catch {
    localStorage.removeItem(importConfigStorageKey);
  }
}

function persistImportConfig() {
  localStorage.setItem(importConfigStorageKey, JSON.stringify({
    financial: importFinancialConfiguration,
    redirectRules: importRedirectRules.map(({ type, cost }) => ({ type, cost })),
  }));
}

function calculateImportCost(product, type) {
  const rule = getImportRedirectRule(type);
  const priceBrl = product.priceUsd * importFinancialConfiguration.dollarQuote;
  const invoiceTaxAmount = priceBrl * (importFinancialConfiguration.invoiceTaxPercent / 100);
  const redirectCost = rule?.cost ?? 0;
  const totalEstimated = priceBrl
    + importFinancialConfiguration.cdeExitPerBox
    + redirectCost
    + importFinancialConfiguration.brazilDispatchPerBox
    + invoiceTaxAmount
    + importFinancialConfiguration.correiosLabel;

  return {
    priceBrl,
    redirectCost,
    invoiceTaxAmount,
    totalEstimated,
  };
}

function renderImportConfig() {
  document.getElementById("importConfigDollar").value = importFinancialConfiguration.dollarQuote;
  document.getElementById("importConfigCde").value = importFinancialConfiguration.cdeExitPerBox;
  document.getElementById("importConfigDispatch").value = importFinancialConfiguration.brazilDispatchPerBox;
  document.getElementById("importConfigInvoice").value = importFinancialConfiguration.invoiceTaxPercent;
  document.getElementById("importConfigLabel").value = importFinancialConfiguration.correiosLabel;
  document.getElementById("importDollarIndicator").textContent = money(importFinancialConfiguration.dollarQuote);
  document.getElementById("redirectConfigList").innerHTML = importRedirectRules.map((rule, index) => `
    <label>${rule.type}
      <input type="number" step="0.01" value="${rule.cost}" data-redirect-rule-index="${index}" />
    </label>
  `).join("");
}

function saveImportConfig() {
  importFinancialConfiguration.dollarQuote = numberOrFallback(document.getElementById("importConfigDollar").value, 0);
  importFinancialConfiguration.cdeExitPerBox = numberOrFallback(document.getElementById("importConfigCde").value, 0);
  importFinancialConfiguration.brazilDispatchPerBox = numberOrFallback(document.getElementById("importConfigDispatch").value, 0);
  importFinancialConfiguration.invoiceTaxPercent = numberOrFallback(document.getElementById("importConfigInvoice").value, 0);
  importFinancialConfiguration.correiosLabel = numberOrFallback(document.getElementById("importConfigLabel").value, 0);

  document.querySelectorAll("[data-redirect-rule-index]").forEach((input) => {
    importRedirectRules[Number(input.dataset.redirectRuleIndex)].cost = numberOrFallback(input.value, 0);
  });

  persistImportConfig();
  renderImportConfig();
  renderImportResults();
  renderImportCalculation();
  showToast("Configuração de importação salva");
}

function renderImportResults() {
  const loading = document.getElementById("importLoadingState");
  const empty = document.getElementById("importEmptyState");
  const list = document.getElementById("importResultList");
  const products = getFilteredImportProducts();

  loading.classList.toggle("show", importState.loading);
  empty.classList.toggle("show", !importState.loading && products.length === 0);

  list.innerHTML = importState.loading ? "" : products.map((product) => {
    const converted = product.priceUsd * importFinancialConfiguration.dollarQuote;
    const detectedType = getImportProductType(product.name) || "Selecionar manualmente";
    return `
      <article class="import-result-card">
        <div>
          <strong>${product.name}</strong>
          <span>${detectedType}</span>
          <a href="${product.url}" target="_blank" rel="noopener noreferrer">Link direto do produto</a>
        </div>
        <div>
          <strong>US$ ${product.priceUsd.toLocaleString("en-US", { minimumFractionDigits: 2 })}</strong>
          <span>${money(converted)}</span>
        </div>
        <button class="offer-action" type="button" data-import-product="${product.id}">Selecionar para cálculo</button>
      </article>
    `;
  }).join("");
}

function renderImportTypeOptions() {
  document.getElementById("importProductTypeSelect").innerHTML = [
    `<option value="">Selecionar tipo manualmente</option>`,
    ...importRedirectRules.map((rule) => `<option value="${rule.type}">${rule.type}</option>`),
  ].join("");
}

function renderImportCalculation() {
  const product = getSelectedImportProduct();
  const empty = document.getElementById("importCalculationEmpty");
  const panel = document.getElementById("importCalculationPanel");

  empty.classList.toggle("hide", Boolean(product));
  panel.classList.toggle("show", Boolean(product));
  if (!product) return;

  const type = importState.selectedType || getImportProductType(product.name);
  const calculation = calculateImportCost(product, type);
  document.getElementById("importProductTypeSelect").value = type;
  document.getElementById("importSelectedName").textContent = product.name;
  document.getElementById("importSelectedLink").href = product.url;
  document.getElementById("importEstimatedTotal").textContent = money(calculation.totalEstimated);
  document.getElementById("importBreakdown").innerHTML = [
    ["Produto convertido", calculation.priceBrl],
    ["Saída CDE", importFinancialConfiguration.cdeExitPerBox],
    ["Redirecionamento", calculation.redirectCost],
    ["Despacho Brasil", importFinancialConfiguration.brazilDispatchPerBox],
    ["Nota Fiscal", calculation.invoiceTaxAmount],
    ["Etiqueta Correios", importFinancialConfiguration.correiosLabel],
  ].map(([label, value]) => `<div><span>${label}</span><strong>${money(value)}</strong></div>`).join("");
}

function searchImportProducts() {
  importState.query = document.getElementById("importSearchInput").value;
  importState.loading = true;
  renderImportResults();
  window.setTimeout(() => {
    importState.loading = false;
    renderImportResults();
  }, 180);
}

function getSupplierByName(name) {
  return suppliers.find((supplier) => supplier.name === name);
}

function buildSupplierWhatsAppLink(item) {
  const supplier = getSupplierByName(item.supplier);
  const message = `Olá! Tenho interesse no ${item.product} que encontrei no Radar de Preços da iNest. Poderia confirmar disponibilidade e valor?`;
  return `${supplier?.whatsappLink || "https://wa.me/"}?text=${encodeURIComponent(message)}`;
}

function closeSupplierModal() {
  document.getElementById("supplierModalBackdrop").classList.remove("show");
}

function openSupplierModal(name) {
  const supplier = getSupplierByName(name);
  if (!supplier) return;
  document.getElementById("supplierModalTitle").textContent = supplier.name;
  document.getElementById("supplierModalContent").innerHTML = `
    <article><span>Cidade</span><strong>${supplier.city} • ${supplier.state}</strong></article>
    <article><span>Tempo como fornecedor</span><strong>${supplier.partnerSince}</strong></article>
    <article><span>Produtos cadastrados</span><strong>${supplier.activeProducts}</strong></article>
    <article><span>Última atualização</span><strong>${supplier.lastUpdate}</strong></article>
    <article><span>Contato</span><strong>${supplier.contact}</strong></article>
    <article><span>WhatsApp</span><strong>${supplier.whatsapp}</strong></article>
    <article class="wide"><span>Observações internas</span><strong>${supplier.notes}</strong></article>
    <article><span>Status</span><strong>${supplier.status}</strong></article>
    <article><span>Confiabilidade</span><strong>${supplier.reliability}</strong></article>
  `;
  document.getElementById("supplierModalBackdrop").classList.add("show");
}

function renderPrices(filter = "") {
  const visiblePrices = prices.filter((item) => approvedQualities.includes(item.quality));
  const filteredPrices = visiblePrices
    .filter((item) => `${item.product} ${item.supplier}`.toLowerCase().includes(filter.toLowerCase()))
  const costs = filteredPrices.map((item) => item.cost);
  const suppliers = new Set(filteredPrices.map((item) => item.supplier));
  document.getElementById("radarMinPrice").textContent = currency.format(costs.length ? Math.min(...costs) : 0);
  document.getElementById("radarAveragePrice").textContent = currency.format(costs.length ? costs.reduce((sum, cost) => sum + cost, 0) / costs.length : 0);
  document.getElementById("radarMaxPrice").textContent = currency.format(costs.length ? Math.max(...costs) : 0);
  document.getElementById("radarSupplierCount").textContent = `${suppliers.size} fornecedores`;
  document.getElementById("radarHiddenCount").textContent = prices.length - visiblePrices.length;
  document.getElementById("radarFoundCount").textContent = `${filteredPrices.length} produtos encontrados`;

  const rows = filteredPrices
    .map((item) => {
      const supplier = getSupplierByName(item.supplier);
      return `
      <article class="pricing-product-card radar-price-card">
        <div class="pricing-product-image radar-product-thumb"><span></span></div>
        <div class="pricing-product-info radar-product-info">
          <div class="pricing-product-title radar-product-title">
            <strong>${item.product}</strong>
            <span class="status-pill">${item.quality}</span>
          </div>
          <div class="pricing-tags radar-product-tags">
            <span>${item.status}</span>
            <span>${item.stock} unidades</span>
          </div>
          <small>Atualizado em 07/07 às 09:30</small>
        </div>
        <div class="radar-supplier-block">
          <strong>${item.supplier}</strong>
          <span>${supplier ? `${supplier.city} • ${supplier.state}` : item.city}</span>
          <span>Entrega: ${item.deadline}</span>
        </div>
        <div class="radar-price-block">
          <strong>${currency.format(item.cost)}</strong>
          <span>Atualizado em 07/07 às 09:30</span>
          <a class="offer-action" href="${buildSupplierWhatsAppLink(item)}" target="_blank" rel="noopener noreferrer">WhatsApp</a>
          <button class="details-action" type="button" data-supplier-details="${item.supplier}">Ver fornecedor</button>
        </div>
      </article>
    `;
    })
    .join("");
  document.getElementById("priceRows").innerHTML = rows || `
    <div class="empty-state show">
      <strong>Nenhum produto encontrado.</strong>
      <span>Ajuste a busca para visualizar outras cotações disponíveis.</span>
    </div>
  `;
}

function renderSimpleLists() {
  document.getElementById("alertList").innerHTML = alerts
    .map(([title, detail]) => `<article class="alert"><div><strong>${title}</strong><span>${detail}</span></div><span class="badge">Hoje</span></article>`)
    .join("");

  document.getElementById("activityList").innerHTML = activities
    .map(([title, detail]) => `<article class="activity"><div><strong>${title}</strong><span>${detail}</span></div><span>Agora</span></article>`)
    .join("");

  document.getElementById("productGrid").innerHTML = products
    .map(([name, spec, stock, price]) => `
      <article class="product-card">
        <div class="product-art"></div>
        <div><strong>${name}</strong><span>${spec}</span></div>
        <footer><span class="badge">${stock}</span><strong>${price}</strong></footer>
      </article>
    `)
    .join("");

  document.getElementById("clientRows").innerHTML = clients
    .map((client) => `<tr>${client.map((cell, index) => `<td>${index === 0 ? `<strong>${cell}</strong>` : cell}</td>`).join("")}</tr>`)
    .join("");

  document.getElementById("supplierRows").innerHTML = suppliers
    .map((supplier) => `
      <tr>
        <td><strong>${supplier.name}</strong></td>
        <td>${supplier.city}</td>
        <td>${supplier.state}</td>
        <td>${supplier.phone}</td>
        <td>${supplier.whatsapp}</td>
        <td><a href="${supplier.whatsappLink}" target="_blank" rel="noopener noreferrer">Abrir WhatsApp</a></td>
        <td>${supplier.notes}</td>
        <td><span class="badge">${supplier.status}</span></td>
      </tr>
    `)
    .join("");

  document.getElementById("userRows").innerHTML = users
    .map((user) => `<tr>${user.map((cell, index) => `<td>${index === 0 ? `<strong>${cell}</strong>` : cell}</td>`).join("")}</tr>`)
    .join("");

  document.getElementById("cashflow").innerHTML = [
    ["Receitas confirmadas", "R$ 214.900", "positive"],
    ["Compras de estoque", "R$ 132.600", "negative"],
    ["Taxas e fretes", "R$ 25.700", "negative"],
    ["Saldo operacional", "R$ 56.600", "positive"],
  ]
    .map(([label, value, tone]) => `<div class="flow-row"><span>${label}</span><strong class="${tone}">${value}</strong></div>`)
    .join("");
}

function getModelProfit(product) {
  return modelProfitSheet[product.model] ?? financialConfiguration.defaultDesiredProfit;
}

function calculateSalePrice(product) {
  return product.cost
    + financialConfiguration.fixedCost
    + financialConfiguration.defaultFreight
    + financialConfiguration.defaultPaymentFee
    + getModelProfit(product);
}

function formatUpdateTime(value) {
  const date = new Date(value);
  return `Atualizado em ${date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} as ${date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
}

function selectedCheckboxValues(name) {
  return [...document.querySelectorAll(`#pricing input[name="${name}"]:checked`)].map((input) => input.value);
}

function getPricingFilters() {
  return {
    categories: selectedCheckboxValues("category"),
    statuses: selectedCheckboxValues("status"),
    maxPrice: Number(document.getElementById("pricingPriceRange").value),
    supplier: document.getElementById("pricingSupplierFilter").value,
    city: document.getElementById("pricingCityFilter").value,
    deadline: document.getElementById("pricingDeadlineFilter").value,
    sort: document.getElementById("pricingSort").value,
  };
}

function getFilteredPricingProducts() {
  const filters = getPricingFilters();
  return pricingProducts
    .map((product) => ({
      ...product,
      desiredProfit: getModelProfit(product),
      salePrice: calculateSalePrice(product),
    }))
    .filter((product) => filters.categories.includes(product.category))
    .filter((product) => filters.statuses.includes(product.status))
    .filter((product) => product.salePrice <= filters.maxPrice)
    .filter((product) => filters.supplier === "all" || product.supplier === filters.supplier)
    .filter((product) => filters.city === "all" || product.city === filters.city)
    .filter((product) => filters.deadline === "all" || product.deadline === filters.deadline)
    .sort((a, b) => {
      if (filters.sort === "highest") return b.salePrice - a.salePrice;
      if (filters.sort === "recent") return new Date(b.createdAt) - new Date(a.createdAt);
      if (filters.sort === "updated") return new Date(b.updatedAt) - new Date(a.updatedAt);
      if (filters.sort === "profit") return b.desiredProfit - a.desiredProfit;
      return a.salePrice - b.salePrice;
    });
}

function productImage(product) {
  return `
    <div class="pricing-product-image ${product.imageTone}" aria-label="Imagem oficial do produto">
      <span></span>
    </div>
  `;
}

function renderPricingProduct(product) {
  const price = currency.format(product.salePrice);
  const profitSource = modelProfitSheet[product.model] ? "Google Sheets" : "Lucro padrao";
  return `
    <article class="pricing-product-card">
      ${productImage(product)}
      <div class="pricing-product-info">
        <div class="pricing-product-title">
          <strong>${product.model}</strong>
          <span class="status-pill">${product.status}</span>
        </div>
        <div class="pricing-tags">
          <span>${product.color}</span>
          <span>${product.capacity}</span>
          <span>${product.supplier}</span>
          <span>${product.deadline}</span>
        </div>
        <small>${formatUpdateTime(product.updatedAt)} · Lucro por modelo: ${profitSource}</small>
      </div>
      <div class="pricing-product-action">
        <strong>${price}</strong>
        <button class="offer-action" data-offer-product="${product.id}">Gerar Oferta</button>
        <button class="details-action" data-details-product="${product.id}">Detalhes</button>
      </div>
    </article>
  `;
}

function renderPricingPagination(total) {
  const pages = Math.max(1, Math.ceil(total / pricingState.pageSize));
  pricingState.page = Math.min(pricingState.page, pages);
  document.getElementById("pricingPagination").innerHTML = Array.from({ length: pages }, (_, index) => {
    const page = index + 1;
    return `<button class="${page === pricingState.page ? "active" : ""}" data-pricing-page="${page}">${page}</button>`;
  }).join("");
}

function renderPricingCatalog() {
  const skeleton = document.getElementById("pricingSkeleton");
  const results = document.getElementById("pricingResults");
  const emptyState = document.getElementById("pricingEmptyState");
  const filtered = getFilteredPricingProducts();
  const start = (pricingState.page - 1) * pricingState.pageSize;
  const visible = filtered.slice(start, start + pricingState.pageSize);

  skeleton.classList.toggle("show", pricingState.loading);
  results.classList.toggle("card-mode", pricingState.mode === "cards");
  results.classList.toggle("list-mode", pricingState.mode === "list");
  results.innerHTML = pricingState.loading ? "" : visible.map(renderPricingProduct).join("");
  emptyState.classList.toggle("show", !pricingState.loading && filtered.length === 0);
  document.getElementById("pricingFoundCount").textContent = `${filtered.length} ${filtered.length === 1 ? "produto encontrado" : "produtos encontrados"}`;
  renderPricingPagination(filtered.length);
}

function refreshPricingCatalog() {
  pricingState.loading = true;
  renderPricingCatalog();
  window.setTimeout(() => {
    pricingState.loading = false;
    renderPricingCatalog();
  }, 180);
}

function updatePricingFilters() {
  pricingState.page = 1;
  refreshPricingCatalog();
}

function setPricingMode(mode) {
  pricingState.mode = mode;
  document.getElementById("pricingListMode").classList.toggle("active", mode === "list");
  document.getElementById("pricingCardMode").classList.toggle("active", mode === "cards");
  renderPricingCatalog();
}

function closePricingFilters() {
  document.getElementById("pricing").classList.remove("filters-open");
}

function openPricingFilters() {
  document.getElementById("pricing").classList.add("filters-open");
}

function generateOfferFromPricing(productId) {
  const product = pricingProducts.find((item) => item.id === productId);
  if (!product) return;
  const salePrice = calculateSalePrice(product);
  document.getElementById("offerTemplate").value = product.status === "Novo" ? "sealed" : "used";
  document.getElementById("offerProduct").value = `${product.model} ${product.capacity}`;
  document.getElementById("offerColors").value = `${product.color} - ${currency.format(salePrice)}`;
  document.getElementById("offerDeadline").value = product.deadline;
  updateOffer();
  setView("offers");
  showToast("Oferta preenchida automaticamente");
}
function updateOffer() {
  const template = document.getElementById("offerTemplate").value;
  const product = document.getElementById("offerProduct").value;
  const colors = document.getElementById("offerColors").value;
  const deadline = document.getElementById("offerDeadline").value;
  const title = template === "sealed"
    ? "🏆 OFERTA DE LACRADO INEST 🏆"
    : "🏆 OFERTA DE SEMINOVO ORIGINAL INEST 🏆";
  const condition = template === "sealed" ? "📦 Novo e Lacrado" : "📦 Seminovo Original";
  const warranty = template === "sealed" ? "🛡️ 1 ano de garantia Apple" : "🛡️ 6 meses de garantia pela loja";
  document.getElementById("offerPreview").innerText = `${title}

⏳ VÁLIDA POR 24 HORAS ⏳

Todos os produtos são importados, o que muda é apenas o prazo.

${condition}

${warranty}

✈️ Prazo de entrega: ${deadline}

📱 ${product}

${colors}

📥 Me chama no privado e garanta sua reserva.`;
}

function showToast(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.classList.add("show");
  window.setTimeout(() => toast.classList.remove("show"), 1800);
}

document.querySelectorAll(".nav-item").forEach((item) => {
  item.addEventListener("click", () => setView(item.dataset.view));
});

document.getElementById("menuButton").addEventListener("click", () => {
  document.getElementById("sidebar").classList.toggle("open");
});

document.getElementById("themeButton").addEventListener("click", () => {
  document.body.classList.toggle("dark");
});

document.getElementById("quickOfferButton").addEventListener("click", () => setView("offers"));
document.getElementById("radarFilter").addEventListener("input", (event) => renderPrices(event.target.value));

document.getElementById("radarFilterToggle").addEventListener("click", () => {
  document.getElementById("radar").classList.add("filters-open");
});

document.getElementById("radarFilterClose").addEventListener("click", () => {
  document.getElementById("radar").classList.remove("filters-open");
});

document.getElementById("radarFilterBackdrop").addEventListener("click", () => {
  document.getElementById("radar").classList.remove("filters-open");
});

document.getElementById("priceRows").addEventListener("click", (event) => {
  const detailsButton = event.target.closest("[data-supplier-details]");
  if (!detailsButton) return;
  openSupplierModal(detailsButton.dataset.supplierDetails);
});

document.getElementById("supplierModalClose").addEventListener("click", closeSupplierModal);
document.getElementById("supplierModalBackdrop").addEventListener("click", (event) => {
  if (event.target.id === "supplierModalBackdrop") closeSupplierModal();
});

document.querySelectorAll("#radar .segmented-control button").forEach((button) => {
  button.addEventListener("click", () => {
    const mode = button.textContent.trim() === "Cards" ? "card-mode" : "list-mode";
    document.querySelectorAll("#radar .segmented-control button").forEach((item) => item.classList.toggle("active", item === button));
    document.getElementById("priceRows").classList.toggle("card-mode", mode === "card-mode");
    document.getElementById("priceRows").classList.toggle("list-mode", mode === "list-mode");
  });
});

document.getElementById("importSearchButton").addEventListener("click", searchImportProducts);
document.getElementById("importSearchInput").addEventListener("input", searchImportProducts);

document.getElementById("importResultList").addEventListener("click", (event) => {
  const button = event.target.closest("[data-import-product]");
  if (!button) return;
  importState.selectedProductId = button.dataset.importProduct;
  const product = getSelectedImportProduct();
  importState.selectedType = product ? getImportProductType(product.name) : "";
  renderImportCalculation();
});

document.getElementById("importProductTypeSelect").addEventListener("change", (event) => {
  importState.selectedType = event.target.value;
  renderImportCalculation();
});

document.getElementById("saveImportConfigButton").addEventListener("click", saveImportConfig);

document.querySelectorAll("#pricing input, #pricing select").forEach((control) => {
  control.addEventListener("input", updatePricingFilters);
  control.addEventListener("change", updatePricingFilters);
});

document.getElementById("pricingListMode").addEventListener("click", () => setPricingMode("list"));
document.getElementById("pricingCardMode").addEventListener("click", () => setPricingMode("cards"));
document.getElementById("pricingFilterTrigger").addEventListener("click", openPricingFilters);
document.getElementById("pricingFilterClose").addEventListener("click", closePricingFilters);
document.getElementById("pricingFilterBackdrop").addEventListener("click", closePricingFilters);

document.getElementById("pricingResults").addEventListener("click", (event) => {
  const offerButton = event.target.closest("[data-offer-product]");
  const detailsButton = event.target.closest("[data-details-product]");
  if (offerButton) generateOfferFromPricing(offerButton.dataset.offerProduct);
  if (detailsButton) showToast("Detalhes do produto preservados para a proxima etapa");
});

document.getElementById("pricingPagination").addEventListener("click", (event) => {
  const pageButton = event.target.closest("[data-pricing-page]");
  if (!pageButton) return;
  pricingState.page = Number(pageButton.dataset.pricingPage);
  renderPricingCatalog();
});

["offerTemplate", "offerProduct", "offerColors", "offerDeadline"].forEach((id) => {
  document.getElementById(id).addEventListener("input", updateOffer);
});

document.getElementById("copyOffer").addEventListener("click", async () => {
  const text = document.getElementById("offerPreview").innerText;
  try {
    await navigator.clipboard.writeText(text);
    showToast("Oferta copiada");
  } catch {
    showToast("Oferta pronta para copiar");
  }
});

document.getElementById("globalSearch").addEventListener("input", (event) => {
  const value = event.target.value.trim();
  if (value.length > 1) {
    setView("radar");
    document.getElementById("radarFilter").value = value;
    renderPrices(value);
  }
});

renderPrices();
loadImportConfigFromStorage();
renderImportTypeOptions();
renderImportConfig();
renderImportResults();
renderImportCalculation();
renderSimpleLists();
refreshPricingCatalog();
updateOffer();
