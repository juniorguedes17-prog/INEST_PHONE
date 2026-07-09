import { readFileSync } from 'node:fs';

const API_URL = process.env.API_URL ?? 'http://127.0.0.1:3333/api/v1';

function parseEnvFile(path) {
  const result = {};
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
    const [key, ...parts] = trimmed.split('=');
    result[key] = parts.join('=').replace(/^["']|["']$/g, '');
  }
  return result;
}

const localEnv = parseEnvFile('.env.local');
const email = localEnv.SEED_ADMIN_EMAIL;
const password = localEnv.SEED_ADMIN_PASSWORD;

if (!email || !password) {
  throw new Error('SEED_ADMIN_EMAIL/SEED_ADMIN_PASSWORD ausentes em .env.local.');
}

const summary = {
  passed: [],
  failed: [],
  created: {},
};

async function request(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'content-type': 'application/json',
      ...(options.headers ?? {}),
    },
  });
  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!response.ok) {
    const message = typeof body === 'object' && body ? body.message || body.error : body;
    throw new Error(`${response.status} ${path}: ${message ?? response.statusText}`);
  }
  return body;
}

function dataOf(body) {
  if (body && typeof body === 'object' && 'data' in body) return body.data;
  return body;
}

async function step(name, fn) {
  try {
    const value = await fn();
    summary.passed.push(name);
    return value;
  } catch (error) {
    summary.failed.push({ name, error: error instanceof Error ? error.message : String(error) });
    return null;
  }
}

const health = await step('Health check com PostgreSQL', () => request('/health'));

const login = await step('Login com administrador seed', () =>
  request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  }),
);

const token = dataOf(login)?.tokens?.accessToken ?? login?.tokens?.accessToken;
if (!token) {
  console.log(JSON.stringify(summary, null, 2));
  process.exit(1);
}

const authHeaders = { authorization: `Bearer ${token}` };
const stamp = Date.now();

const session = await step('Sessao autenticada', () => request('/auth/session', { headers: authHeaders }));
const settings = await step('Configuracoes - leitura', () =>
  request('/settings', { headers: authHeaders }),
);
const settingsData = dataOf(settings);
await step('Configuracoes - atualizacao idempotente', () =>
  request('/settings', {
    method: 'PATCH',
    headers: authHeaders,
    body: JSON.stringify(settingsData),
  }),
);

const refs = await step('Produtos - referencias', () =>
  request('/products/references', { headers: authHeaders }),
);
const refsData = dataOf(refs);
const category =
  refsData?.categories?.[0] ??
  (await step('Produtos - criar categoria homologacao', () =>
    request('/products/categories', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        name: `HOMOLOGACAO Categoria ${stamp}`,
        slug: `homologacao-categoria-${stamp}`,
        type: 'ACCESSORY',
      }),
    }),
  ));
const categoryId = dataOf(category)?.id ?? category?.id;

const productModel = await step('Produtos - criar modelo homologacao', () =>
  request('/products/models', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      categoryId,
      name: `HOMOLOGACAO Modelo ${stamp}`,
      normalizedName: `homologacao-modelo-${stamp}`,
      productType: 'ACCESSORY',
    }),
  }),
);
const modelId = dataOf(productModel)?.id ?? productModel?.id;

const color = await step('Produtos - criar cor homologacao', () =>
  request('/products/colors', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      name: `HOMOLOGACAO Cor ${stamp}`,
      normalizedName: `homologacao-cor-${stamp}`,
    }),
  }),
);
const colorId = dataOf(color)?.id ?? color?.id;

const storage = await step('Produtos - criar capacidade homologacao', () =>
  request('/products/storages', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      value: `${stamp}`,
      unit: 'GB',
      displayName: `HOMOLOGACAO ${stamp} GB`,
    }),
  }),
);
const storageId = dataOf(storage)?.id ?? storage?.id;

const product = await step('Produtos - criar produto', () =>
  request('/products', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      categoryId,
      modelId,
      colorId,
      storageId,
      productType: 'ACCESSORY',
      status: 'ACTIVE',
      qualityGrade: 'Grade A+',
      criticalNotes: '',
    }),
  }),
);
const productId = dataOf(product)?.id ?? product?.id;
summary.created.productId = productId;

await step('Produtos - listar', () => request('/products', { headers: authHeaders }));
await step('Produtos - consultar', () => request(`/products/${productId}`, { headers: authHeaders }));
await step('Produtos - atualizar', () =>
  request(`/products/${productId}`, {
    method: 'PATCH',
    headers: authHeaders,
    body: JSON.stringify({
      categoryId,
      modelId,
      colorId,
      storageId,
      productType: 'ACCESSORY',
      status: 'ACTIVE',
      qualityGrade: 'Excelente Estado',
      criticalNotes: '',
    }),
  }),
);

const supplier = await step('Fornecedores - criar fornecedor', () =>
  request('/suppliers', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      name: `HOMOLOGACAO Fornecedor ${stamp}`,
      contact: 'Contato Homologacao',
      phone: '+55 11 99999-9999',
      source: 'Nacional',
      status: 'ACTIVE',
      email: `homologacao-${stamp}@example.com`,
      whatsappLink: 'https://wa.me/5511999999999',
    }),
  }),
);
const supplierId = dataOf(supplier)?.id ?? supplier?.id;
summary.created.supplierId = supplierId;

await step('Fornecedores - listar', () => request('/suppliers', { headers: authHeaders }));
await step('Fornecedores - consultar', () => request(`/suppliers/${supplierId}`, { headers: authHeaders }));
await step('Fornecedores - atualizar', () =>
  request(`/suppliers/${supplierId}`, {
    method: 'PATCH',
    headers: authHeaders,
    body: JSON.stringify({
      name: `HOMOLOGACAO Fornecedor ${stamp} Atualizado`,
      contact: 'Contato Homologacao',
      phone: '+55 11 99999-9999',
      source: 'Nacional',
      status: 'ACTIVE',
      email: `homologacao-${stamp}@example.com`,
      whatsappLink: 'https://wa.me/5511999999999',
    }),
  }),
);

const quote = await step('Radar de Precos - criar cotacao', () =>
  request('/price-radar/quotes', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      productId,
      supplierId,
      costProduct: 1234.56,
      deliveryTime: '3-5 dias uteis',
      city: 'Sao Paulo',
      contact: 'Contato Homologacao',
      quality: 'Grade A+',
      notes: 'Cotacao criada por homologacao tecnica.',
      quoteDate: new Date().toISOString(),
    }),
  }),
);
const quoteId = dataOf(quote)?.id ?? quote?.id;
summary.created.quoteId = quoteId;

await step('Radar de Precos - listar cotacoes', () =>
  request('/price-radar/quotes', { headers: authHeaders }),
);
await step('Radar de Precos - KPIs', () => request('/price-radar/kpis', { headers: authHeaders }));
await step('Radar de Precos - consultar cotacao', () =>
  request(`/price-radar/quotes/${quoteId}`, { headers: authHeaders }),
);
await step('Radar de Precos - atualizar cotacao', () =>
  request(`/price-radar/quotes/${quoteId}`, {
    method: 'PATCH',
    headers: authHeaders,
    body: JSON.stringify({
      productId,
      supplierId,
      costProduct: 1235.56,
      deliveryTime: '3-5 dias uteis',
      city: 'Sao Paulo',
      contact: 'Contato Homologacao',
      quality: 'Grade A+',
      notes: 'Cotacao atualizada por homologacao tecnica.',
      quoteDate: new Date().toISOString(),
    }),
  }),
);
await step('Radar de Precos - validar qualidade', () =>
  request('/price-radar/validate', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ quality: 'Grade A+', notes: '' }),
  }),
);
await step('Radar de Precos - importar CSV tecnico', () =>
  request('/price-radar/import/csv', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      csvContent: `productId,supplierId,costProduct,deliveryTime,city,quality,notes\n${productId},${supplierId},1240.00,3-5 dias uteis,Sao Paulo,Grade A+,Importacao tecnica`,
    }),
  }),
);

await step('Precificacao - listar', () => request('/pricing', { headers: authHeaders }));
await step('Precificacao - consultar produto', () =>
  request(`/pricing/${productId}`, { headers: authHeaders }),
);
await step('Precificacao - recalcular', () =>
  request('/pricing/recalculate', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({}),
  }),
);
await step('Precificacao - gerar rascunho de oferta', () =>
  request('/pricing/generate-offer', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ productId }),
  }),
);

const importSearch = await step('Radar de Importacao - pesquisar mock/provider', () =>
  request('/import-radar/search?search=iphone', { headers: authHeaders }),
);
const importProduct = dataOf(importSearch)?.results?.[0] ?? importSearch?.results?.[0];
if (importProduct) {
  await step('Radar de Importacao - calcular custo', () =>
    request('/import-radar/calculate', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify(importProduct),
    }),
  );
}
await step('Radar de Importacao - historico', () =>
  request('/import-radar/history', { headers: authHeaders }),
);

await step('Ofertas - templates', () => request('/offers/templates', { headers: authHeaders }));
const generatedOffer = await step('Ofertas - gerar oferta', () =>
  request('/offers/generate', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ productId }),
  }),
);
const offerId = dataOf(generatedOffer)?.id ?? generatedOffer?.id;
if (offerId) {
  await step('Ofertas - consultar oferta', () =>
    request(`/offers/${offerId}`, { headers: authHeaders }),
  );
  await step('Ofertas - copiar', () =>
    request(`/offers/${offerId}/copy`, { method: 'POST', headers: authHeaders, body: '{}' }),
  );
  await step('Ofertas - compartilhar WhatsApp', () =>
    request(`/offers/${offerId}/share`, { method: 'POST', headers: authHeaders, body: '{}' }),
  );
  const duplicatedOffer = await step('Ofertas - duplicar', () =>
    request(`/offers/${offerId}/duplicate`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ reason: 'Homologacao tecnica.' }),
    }),
  );
  const duplicatedOfferId = dataOf(duplicatedOffer)?.id ?? duplicatedOffer?.id;
  if (duplicatedOfferId) {
    await step('Ofertas - excluir duplicada', () =>
      request(`/offers/${duplicatedOfferId}`, { method: 'DELETE', headers: authHeaders }),
    );
  }
  await step('Ofertas - excluir oferta', () =>
    request(`/offers/${offerId}`, { method: 'DELETE', headers: authHeaders }),
  );
}
await step('Ofertas - listar historico', () => request('/offers', { headers: authHeaders }));

await step('Dashboard - KPIs', () => request('/dashboard/kpis', { headers: authHeaders }));
await step('Dashboard - overview', () => request('/dashboard', { headers: authHeaders }));

await step('Integracoes - status', () => request('/integrations/status', { headers: authHeaders }));
await step('Integracoes - importar CSV preparado', () =>
  request('/integrations/import', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ source: 'csv', content: 'id,name\n1,Homologacao' }),
  }),
);
await step('Integracoes - exportar CSV', () =>
  request('/integrations/export', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ format: 'csv', dataset: 'homologation' }),
  }),
);
await step('Integracoes - WhatsApp link', () =>
  request('/integrations/whatsapp/link', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ message: 'Homologacao tecnica iNest Phone' }),
  }),
);
await step('Radar de Precos - ocultar cotacao', () =>
  request(`/price-radar/quotes/${quoteId}/hide`, {
    method: 'PATCH',
    headers: authHeaders,
    body: JSON.stringify({ reason: 'Homologacao tecnica concluida.' }),
  }),
);

await step('Produtos - soft delete', () =>
  request(`/products/${productId}`, { method: 'DELETE', headers: authHeaders }),
);
await step('Fornecedores - soft delete', () =>
  request(`/suppliers/${supplierId}`, { method: 'DELETE', headers: authHeaders }),
);

await step('Logout', () =>
  request('/auth/logout', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({}),
  }),
);

console.log(JSON.stringify(summary, null, 2));

if (summary.failed.length > 0) {
  process.exit(1);
}
