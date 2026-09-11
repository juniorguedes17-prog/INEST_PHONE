import assert from 'node:assert/strict';
import { dirname } from 'node:path';
import { readFileSync } from 'node:fs';
import { setImmediate } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import test, { mock } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

type Props = Record<string, unknown>;
type Element = { type: string | ((props: Props) => Element); props: Props };
type ProviderReport = {
  provider: string;
  status: 'OK' | 'EMPTY' | 'UNAVAILABLE' | 'RATE_LIMITED';
  returnedCount: number;
  diagnostics?: Record<string, unknown>;
};
const componentDirectory = dirname(fileURLToPath(import.meta.url));

const product = {
  source: 'US',
  providerName: 'amazon_us',
  sourceProductId: 'amazon:item',
  sourceName: 'iPhone 17 Pro 512GB',
  displayName: 'iPhone 17 Pro 512GB',
  supplier: 'Amazon',
  retailer: 'Amazon',
  sourceUrl: 'https://example.com/amazon:item',
  category: 'iPhone',
  model: 'iPhone 17 Pro',
  capacity: '512GB',
  condition: 'SEMINOVO',
  priceUsd: 1000,
};
const secondProduct = {
  ...product,
  providerName: 'apple_us',
  sourceProductId: 'apple:item-2',
  sourceName: 'MacBook Air',
  category: 'Mac',
  model: 'MacBook Air',
  capacity: '256GB',
  condition: 'NOVO' as const,
  retailer: 'Apple Store USA',
  priceUsd: 2000,
  offerKind: 'FAMILY_STARTING_AT' as const,
};
const thirdProduct = {
  ...product,
  providerName: 'upcitemdb_us',
  sourceProductId: 'upc:item-3',
  sourceName: 'iPhone 17',
  model: 'iPhone 17',
  capacity: '128GB',
  condition: 'CPO' as const,
  retailer: null,
  priceUsd: 500,
};
const appleIphone = {
  ...product,
  providerName: 'apple_us',
  sourceProductId: 'apple-us:MJQ64LL/A',
  sourceName: 'iPhone 18 Pro 256GB Glacier',
  displayName: 'iPhone 18 Pro 256GB Glacier',
  retailer: 'Apple Store USA',
  supplier: 'Apple Store USA',
  model: 'iPhone 18 Pro',
  capacity: '256GB',
  color: 'Glacier',
  condition: 'NOVO' as const,
};
const canon = {
  ...product,
  sourceName: 'Canon EOS Rebel T7 DSLR Camera',
  category: 'Camera',
  model: 'EOS Rebel T7',
  sourceManufacturer: 'Canon',
};
const garmin = {
  ...product,
  providerName: 'upcitemdb_us',
  sourceName: 'Garmin vivoactive 5 42mm GPS Ivory',
  category: 'Wearable',
  model: 'vivoactive 5',
  sourceManufacturer: 'Garmin',
};
const ready = {
  status: 'READY_FOR_COST',
  semanticDecision: { status: 'READY', reason: null },
  redirector: { redirector: 'REI_DO_IMPORTADO' },
  shippingWeightLbs: null,
  condition: 'SEMINOVO',
  normalizedPricing: { category: 'iPhone', model: 'iPhone 17 Pro', capacity: '512GB', color: null },
};
const componentSource = readFileSync(`${componentDirectory}/UsaRadarOrigin.tsx`, 'utf8');
const componentCode = ts.transpileModule(
  `${componentSource}\nexport { humanizeUsaBlockedReason as __testHumanizeUsaBlockedReason };`,
  {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  },
).outputText;

function setup(
  preflightResponse: object | ((...args: unknown[]) => object | Promise<object>) = ready,
  searchProducts: Array<Record<string, unknown>> = [product],
  searchProviders: ProviderReport[] = [{ provider: 'amazon_us', status: 'OK', returnedCount: 1 }],
  options: {
    enrichmentDecision?: object;
    executionPreflight?: object;
  } = {},
) {
  const services = {
    searchUsaWithDiagnostics: mock.fn(async () => ({
      products: searchProducts,
      providers: searchProviders,
    })),
    resolveUsaEnrichment: mock.fn(async () => ({
      decision: options.enrichmentDecision ?? { status: 'READY', reason: null },
    })),
    preflightUsaCost: mock.fn(async (...args: unknown[]) =>
      typeof preflightResponse === 'function' ? preflightResponse(...args) : preflightResponse,
    ),
    executeUsaCost: mock.fn(async (...args: unknown[]) => {
      const redirector = args[1] as Props;
      return {
        preflight:
          options.executionPreflight ??
          (typeof preflightResponse === 'function' ? ready : preflightResponse),
        calculation: {
          sourceProductId: product.sourceProductId,
          sourceCommercialIdentity: {
            sourceName: product.sourceName,
            sourceUrl: product.sourceUrl,
            retailer: product.retailer,
            provider: product.providerName,
          },
          redirector,
          productPriceUsd: product.priceUsd,
          finalCost: { currency: 'BRL', amountBrl: 5500 },
          breakdown: { productValueBrl: 5000, shippingBrl: 500 },
        },
      };
    }),
    resolveUsaShippingWeight: mock.fn(async () => ({
      status: 'WEIGHT_FOUND',
      shippingWeightLbs: 3.95,
    })),
    registerUsaShippingWeight: mock.fn(async () => ({
      status: 'WEIGHT_FOUND',
      shippingWeightLbs: 3.95,
      registration: 'CREATED',
    })),
    confirmUsaManufacturer: mock.fn(),
  };
  const pricing = {
    calculateTemporaryImportPricing: mock.fn(async (payload: unknown) => payload),
  };
  const state: unknown[] = [];
  const storage = new Map<string, string>();
  let cursor = 0;
  const exports: {
    UsaRadarOrigin?: () => Element;
    __testHumanizeUsaBlockedReason?: (reason: string) => string;
  } = {};
  const jsx = (type: Element['type'], props: Props) => ({ type, props });
  const router = { push: mock.fn() };

  runInNewContext(componentCode, {
    exports,
    Error,
    window: {
      sessionStorage: { setItem: (key: string, value: string) => storage.set(key, value) },
    },
    require: (name: string) => {
      if (name === 'react')
        return {
          useState: (initial: unknown) => {
            const index = cursor++;
            if (!(index in state)) state[index] = initial;
            return [
              state[index],
              (value: unknown) => {
                state[index] =
                  typeof value === 'function'
                    ? (value as (current: unknown) => unknown)(state[index])
                    : value;
              },
            ];
          },
          useRef: (initial: unknown) => {
            const index = cursor++;
            if (!(index in state)) state[index] = { current: initial };
            return state[index];
          },
          useCallback: (callback: unknown) => callback,
          useMemo: (factory: () => unknown) => factory(),
        };
      if (name === 'next/navigation') return { useRouter: () => router };
      if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx, Fragment: 'fragment' };
      if (name === '@/components/shared')
        return Object.fromEntries(
          [
            'ActionButton',
            'EmptyState',
            'ErrorState',
            'KpiCard',
            'LoadingState',
            'SearchInput',
            'StatusBadge',
          ].map((key) => [key, key]),
        );
      if (name.endsWith('/ProductFacetsDrawer'))
        return {
          ProductFacetsDrawer: 'ProductFacetsDrawer',
          buildFacetOptions: (values: Array<string | null | undefined>) =>
            Array.from(new Set(values.filter((value): value is string => Boolean(value)))).map(
              (value) => ({ value, label: value, count: 1 }),
            ),
        };
      if (name.endsWith('/import-radar-service')) return services;
      if (name.endsWith('/pricing-service')) return pricing;
      if (name.endsWith('/pricing'))
        return { TEMPORARY_IMPORT_PRICING_STORAGE_KEY: 'inest.temporary-import-pricing' };
      if (name.endsWith('/ParaguayRadarOrigin')) return { CalculationModal: 'CalculationModal' };
      throw new Error(`Unexpected dependency: ${name}`);
    },
  });
  const render = () => {
    cursor = 0;
    return exports.UsaRadarOrigin!();
  };
  const nodes = (name: string): Element[] => {
    const found: Element[] = [];
    const visit = (value: unknown) => {
      if (Array.isArray(value)) return value.forEach(visit);
      if (!value || typeof value !== 'object' || !('props' in value)) return;
      const element = value as Element;
      if ((typeof element.type === 'string' ? element.type : element.type.name) === name)
        found.push(element);
      Object.values(element.props).forEach(visit);
    };
    visit(render());
    return found;
  };
  const call = async (name: string, handler: string, value?: unknown) => {
    const node = nodes(name)[0];
    assert.ok(node, `${name} must be rendered`);
    await (node.props[handler] as (value?: unknown) => unknown)(value);
    await setImmediate();
  };
  const select = async () => {
    await call('SearchInput', 'onChange', { target: { value: 'iphone' } });
    await call('form', 'onSubmit', { preventDefault() {} });
    await call('UsaProductCard', 'onSelect', true);
  };
  return {
    services,
    pricing,
    router,
    storage,
    nodes,
    call,
    select,
    humanizeUsaBlockedReason: exports.__testHumanizeUsaBlockedReason!,
  };
}

test('maps USA normalization failures and real conflicts to distinct user messages', () => {
  const { humanizeUsaBlockedReason } = setup();

  assert.equal(
    humanizeUsaBlockedReason('NORMALIZATION_TIMEOUT'),
    'Não foi possível concluir a identificação deste produto agora. Tente novamente.',
  );
  assert.equal(
    humanizeUsaBlockedReason('NORMALIZATION_MODEL_ERROR'),
    'Não foi possível identificar este produto agora. Tente novamente.',
  );
  assert.equal(
    humanizeUsaBlockedReason('NORMALIZATION_INVALID_OUTPUT'),
    'Não foi possível validar as informações deste produto agora. Tente novamente.',
  );
  assert.equal(
    humanizeUsaBlockedReason('ENRICHMENT_CONFLICT'),
    'Encontramos informações conflitantes para este produto.',
  );
});

test('derives USA filters and metrics from the filtered product dataset', async () => {
  const h = setup(ready, [product, secondProduct, thirdProduct]);
  await h.call('SearchInput', 'onChange', { target: { value: 'iphone' } });
  await h.call('form', 'onSubmit', { preventDefault() {} });

  const drawer = () => h.nodes('ProductFacetsDrawer')[0]!;
  const filterProps = () => drawer().props as Props;
  const metrics = () =>
    Object.fromEntries(h.nodes('KpiCard').map((node) => [node.props.label, node.props.value]));
  const clearFilters = () => drawer().props.onClear as () => void;
  const facetValues = (name: string) =>
    ((filterProps()[name] as Props).options as Props[]).map((option) => option.value);
  const retailerGroup = () => (filterProps().additionalGroups as Props[])[0]!;
  const toggleFacet = (name: string, value: string) =>
    ((filterProps()[name] as Props).onToggle as (nextValue: string) => void)(value);
  const changeCondition = (value: string) =>
    ((filterProps().condition as Props).onChange as (nextValue: string) => void)(value);
  const toggleRetailer = (value: string) =>
    (retailerGroup().onToggle as (nextValue: string) => void)(value);

  assert.equal(drawer().props.open, false);
  assert.deepEqual(facetValues('categories').sort(), ['Mac', 'iPhone']);
  assert.deepEqual((retailerGroup().options as Props[]).map((option) => option.value).sort(), [
    'Amazon',
    'Apple Store USA',
  ]);
  assert.equal(h.nodes('UsaProductCard').length, 3);
  assert.deepEqual(metrics(), {
    Produtos: '3',
    Fornecedores: '2',
    'Menor preço': '$500.00',
    'Preço médio': '$1,166.67',
    'Maior preço': '$2,000.00',
  });
  assert.ok(
    h
      .nodes('UsaProductCard')
      .some((node) => (node.props.product as Props).offerKind === 'FAMILY_STARTING_AT'),
  );

  const filterButton = h.nodes('ActionButton').find((node) => node.props.children === 'Filtros');
  assert.ok(filterButton);
  (filterButton.props.onClick as () => void)();
  assert.equal(drawer().props.open, true);

  toggleFacet('categories', 'iPhone');
  assert.equal(h.nodes('UsaProductCard').length, 2);
  assert.equal(metrics().Produtos, '2');
  clearFilters()();
  toggleFacet('models', 'MacBook Air');
  assert.equal(h.nodes('UsaProductCard').length, 1);
  clearFilters()();
  toggleFacet('capacities', '128GB');
  assert.equal(h.nodes('UsaProductCard').length, 1);
  clearFilters()();
  changeCondition('CPO');
  assert.equal(h.nodes('UsaProductCard').length, 1);
  clearFilters()();
  toggleRetailer('Amazon');
  assert.equal(h.nodes('UsaProductCard').length, 1);
  clearFilters()();

  toggleFacet('categories', 'iPhone');
  changeCondition('CPO');
  assert.equal(h.nodes('UsaProductCard').length, 1);
  clearFilters()();

  assert.equal(h.nodes('SearchInput')[0]?.props.value, 'iphone');
  assert.equal(h.services.searchUsaWithDiagnostics.mock.callCount(), 1);
});

test('preserves partial-search diagnostics while metrics use available products', async () => {
  const h = setup(
    ready,
    [product],
    [
      { provider: 'apple_us', status: 'OK', returnedCount: 1 },
      { provider: 'amazon_us', status: 'UNAVAILABLE', returnedCount: 0 },
    ],
  );
  await h.call('SearchInput', 'onChange', { target: { value: 'iphone' } });
  await h.call('form', 'onSubmit', { preventDefault() {} });

  assert.ok(
    h
      .nodes('p')
      .some(
        (node) =>
          node.props.role === 'status' &&
          JSON.stringify(node.props.children).includes('Algumas fontes não responderam'),
      ),
  );
  assert.equal(
    h.nodes('KpiCard').find((node) => node.props.label === 'Produtos')?.props.value,
    '1',
  );
});

test('exposes each UPC status and existing counters without changing products', async () => {
  for (const status of ['OK', 'EMPTY', 'RATE_LIMITED', 'UNAVAILABLE'] as const) {
    const expectedProduct = status === 'OK' ? thirdProduct : product;
    const h = setup(
      ready,
      [expectedProduct],
      [
        {
          provider: 'upcitemdb_us',
          status,
          returnedCount: status === 'OK' ? 1 : 0,
          diagnostics: {
            itemsReceived: 8,
            offersEvaluated: 21,
            emitted: status === 'OK' ? 1 : 0,
            discarded: { stale: 14, price: 2, unavailable: 4, malformed: 1 },
          },
        },
      ],
    );
    await h.call('SearchInput', 'onChange', { target: { value: 'iphone' } });
    await h.call('form', 'onSubmit', { preventDefault() {} });

    const report = h.nodes('details')[0];
    assert.ok(report);
    assert.ok(JSON.stringify(h.nodes('summary')[0]?.props.children).includes(status));
    const diagnosticText = h.nodes('span').map((node) => JSON.stringify(node.props.children));
    assert.ok(diagnosticText.some((text) => text.includes('Itens') && text.includes('8')));
    assert.ok(
      diagnosticText.some((text) => text.includes('Ofertas avaliadas') && text.includes('21')),
    );
    assert.ok(
      diagnosticText.some(
        (text) => text.includes('Aceitas') && text.includes(String(status === 'OK' ? 1 : 0)),
      ),
    );
    assert.equal(h.nodes('UsaProductCard').length, 1);
    assert.equal(h.nodes('UsaProductCard')[0]?.props.product, expectedProduct);
  }
});

test('keeps the shared unit-cost rule disabled for zero or multiple selections', async () => {
  const h = setup(ready, [product, secondProduct]);
  await h.call('SearchInput', 'onChange', { target: { value: 'iphone' } });
  await h.call('form', 'onSubmit', { preventDefault() {} });
  const costButton = () =>
    h.nodes('ActionButton').find((node) => node.props.children === 'Calcular Custo');

  assert.equal(costButton()?.props.disabled, true);
  const cards = h.nodes('UsaProductCard');
  await (cards[0]!.props.onSelect as (checked: boolean) => void)(true);
  await setImmediate();
  await (h.nodes('UsaProductCard')[1]!.props.onSelect as (checked: boolean) => void)(true);
  await setImmediate();
  assert.equal(costButton()?.props.disabled, true);
});

test('opens the shared USA cost modal before calculating and uses usa-cost for Rei CELULAR', async () => {
  const h = setup();
  await h.select();
  await h.call('UsaProductCard', 'onCalculate');
  const initialModal = h.nodes('CalculationModal')[0]!;
  assert.equal(initialModal.props.usaCostExecution, null);
  assert.ok(initialModal.props.usaBeforeCost);
  await h.call('UsaRedirectorPanel', 'onChange', 'REI_DO_IMPORTADO');
  await h.call('UsaRedirectorPanel', 'onSubmit');
  assert.equal(h.services.executeUsaCost.mock.callCount(), 1);
  assert.equal(h.services.executeUsaCost.mock.calls[0]!.arguments[0], product);
  assert.equal(h.nodes('CalculationModal')[0]!.props.calculation, null);
  assert.equal(
    (h.nodes('CalculationModal')[0]!.props.usaCostExecution as Props).calculation !== null,
    true,
  );
});

for (const reason of [
  'NORMALIZATION_TIMEOUT',
  'NORMALIZATION_MODEL_ERROR',
  'NORMALIZATION_INVALID_OUTPUT',
] as const) {
  test(`uses backend cost readiness for Rei despite ${reason} and keeps Pricing fail-closed`, async () => {
    const semanticDecision = { status: 'BLOCKED' as const, reason };
    const costReady = {
      ...ready,
      semanticDecision,
      redirector: { redirector: 'REI_DO_IMPORTADO' as const },
      shippingWeightLbs: null,
    };
    const h = setup(
      costReady,
      [appleIphone],
      [{ provider: 'apple_us', status: 'OK', returnedCount: 1 }],
      {
        enrichmentDecision: semanticDecision,
      },
    );

    await h.select();
    await h.call('UsaProductCard', 'onCalculate');
    await h.call('UsaRedirectorPanel', 'onChange', 'REI_DO_IMPORTADO');

    assert.equal(h.nodes('UsaRedirectorPanel')[0]!.props.ready, true);
    await h.call('UsaRedirectorPanel', 'onSubmit');

    const modal = h.nodes('CalculationModal')[0]!;
    assert.equal(h.services.executeUsaCost.mock.callCount(), 1);
    assert.equal((modal.props.usaCostExecution as Props).calculation !== null, true);
    assert.equal(modal.props.usaCanSendToPricing, false);
    await h.call('CalculationModal', 'onSendToPricing');
    assert.equal(h.pricing.calculateTemporaryImportPricing.mock.callCount(), 0);
  });
}

test('uses the backend preflight result for Red after timeout, including its weight requirement', async () => {
  const semanticDecision = { status: 'BLOCKED' as const, reason: 'NORMALIZATION_TIMEOUT' as const };
  const missingWeight = {
    status: 'NEEDS_INPUT',
    reason: 'MISSING_WEIGHT',
    input: { type: 'WEIGHT', field: 'shippingWeightLbs' },
    redirector: { redirector: 'RED_DELAWARE', shippingMode: 'EXPRESS' },
  };
  const h = setup(
    missingWeight,
    [appleIphone],
    [{ provider: 'apple_us', status: 'OK', returnedCount: 1 }],
    {
      enrichmentDecision: semanticDecision,
    },
  );

  await h.select();
  await h.call('UsaProductCard', 'onCalculate');
  await h.call('UsaRedirectorPanel', 'onChange', 'RED_DELAWARE');

  assert.equal(h.nodes('UsaShippingWeightPanel').length, 1);
  assert.equal(h.nodes('UsaRedirectorPanel')[0]!.props.ready, false);
  assert.equal(h.services.executeUsaCost.mock.callCount(), 0);
});

test('calculates through Red when its backend preflight becomes ready after timeout', async () => {
  const semanticDecision = { status: 'BLOCKED' as const, reason: 'NORMALIZATION_TIMEOUT' as const };
  const costReady = {
    ...ready,
    semanticDecision,
    redirector: { redirector: 'RED_DELAWARE' as const, shippingMode: 'EXPRESS' as const },
    shippingWeightLbs: 3.95,
  };
  const h = setup(
    costReady,
    [appleIphone],
    [{ provider: 'apple_us', status: 'OK', returnedCount: 1 }],
    {
      enrichmentDecision: semanticDecision,
    },
  );

  await h.select();
  await h.call('UsaProductCard', 'onCalculate');
  await h.call('UsaRedirectorPanel', 'onChange', 'RED_DELAWARE');
  assert.equal(h.nodes('UsaRedirectorPanel')[0]!.props.ready, true);
  await h.call('UsaRedirectorPanel', 'onSubmit');

  assert.equal(h.services.executeUsaCost.mock.callCount(), 1);
  assert.equal(h.nodes('CalculationModal')[0]!.props.usaCanSendToPricing, false);
});

for (const [name, sourceProduct] of [
  ['Canon', canon],
  ['Garmin', garmin],
] as const) {
  test(`calculates OTHER only when the backend returns ready for ${name}`, async () => {
    const semanticDecision = {
      status: 'BLOCKED' as const,
      reason: 'NORMALIZATION_TIMEOUT' as const,
    };
    const costReady = {
      ...ready,
      semanticDecision,
      redirector: { redirector: 'RED_DELAWARE' as const, shippingMode: 'EXPRESS' as const },
      shippingWeightLbs: 3.95,
    };
    const h = setup(
      costReady,
      [sourceProduct],
      [{ provider: sourceProduct.providerName, status: 'OK', returnedCount: 1 }],
      {
        enrichmentDecision: semanticDecision,
      },
    );

    await h.select();
    await h.call('UsaProductCard', 'onCalculate');
    await h.call('UsaRedirectorPanel', 'onChange', 'RED_DELAWARE');
    await h.call('UsaRedirectorPanel', 'onSubmit');

    assert.equal(h.services.executeUsaCost.mock.callCount(), 1);
  });
}

test('preserves a real enrichment conflict as blocked by the backend', async () => {
  const semanticDecision = { status: 'BLOCKED' as const, reason: 'ENRICHMENT_CONFLICT' as const };
  const h = setup(
    {
      status: 'BLOCKED',
      reason: 'ENRICHMENT_CONFLICT',
      redirector: { redirector: 'REI_DO_IMPORTADO' },
    },
    [appleIphone],
    [{ provider: 'apple_us', status: 'OK', returnedCount: 1 }],
    { enrichmentDecision: semanticDecision },
  );

  await h.select();
  await h.call('UsaProductCard', 'onCalculate');
  await h.call('UsaRedirectorPanel', 'onChange', 'REI_DO_IMPORTADO');

  assert.equal(h.nodes('UsaRedirectorPanel')[0]!.props.ready, false);
  assert.equal(h.services.executeUsaCost.mock.callCount(), 0);
});

test('preserves the existing manufacturer confirmation interaction for NEEDS_INPUT', async () => {
  const manufacturerDecision = {
    status: 'NEEDS_INPUT' as const,
    reason: 'MANUFACTURER_MISSING' as const,
    input: {
      type: 'MANUFACTURER' as const,
      field: 'manufacturer' as const,
      suggestedValue: 'Canon',
    },
  };
  const h = setup(
    {
      status: 'NEEDS_INPUT',
      reason: 'MANUFACTURER_MISSING',
      input: manufacturerDecision.input,
      redirector: { redirector: 'REI_DO_IMPORTADO' },
    },
    [canon],
    [{ provider: 'amazon_us', status: 'OK', returnedCount: 1 }],
    { enrichmentDecision: manufacturerDecision },
  );

  await h.select();
  await h.call('UsaProductCard', 'onCalculate');

  assert.ok(h.nodes('input').some((node) => node.props.placeholder === 'Fabricante'));
  assert.equal(h.services.executeUsaCost.mock.callCount(), 0);
});

test('preserves FAMILY_STARTING_AT as blocked by the backend', async () => {
  const h = setup(
    {
      status: 'BLOCKED',
      reason: 'SOURCE_CONFIGURATION_REQUIRED',
      redirector: { redirector: 'REI_DO_IMPORTADO' },
    },
    [secondProduct],
    [{ provider: 'apple_us', status: 'OK', returnedCount: 1 }],
  );

  await h.select();
  await h.call('UsaProductCard', 'onCalculate');
  await h.call('UsaRedirectorPanel', 'onChange', 'REI_DO_IMPORTADO');

  assert.equal(h.nodes('UsaRedirectorPanel')[0]!.props.ready, false);
  assert.equal(h.services.executeUsaCost.mock.callCount(), 0);
});

test('does not calculate Canon OTHER when the backend requires a shipping weight', async () => {
  const semanticDecision = { status: 'BLOCKED' as const, reason: 'NORMALIZATION_TIMEOUT' as const };
  const h = setup(
    {
      status: 'NEEDS_INPUT',
      reason: 'MISSING_WEIGHT',
      input: { type: 'WEIGHT', field: 'shippingWeightLbs' },
      redirector: { redirector: 'RED_DELAWARE', shippingMode: 'EXPRESS' },
    },
    [canon],
    [{ provider: 'amazon_us', status: 'OK', returnedCount: 1 }],
    { enrichmentDecision: semanticDecision },
  );
  await h.select();
  await h.call('UsaProductCard', 'onCalculate');
  await h.call('UsaRedirectorPanel', 'onChange', 'RED_DELAWARE');
  assert.equal(h.nodes('UsaShippingWeightPanel').length, 1);
  assert.equal(h.nodes('UsaRedirectorPanel')[0]!.props.ready, false);
  assert.equal(h.services.executeUsaCost.mock.callCount(), 0);
});

test('keeps MISSING_WEIGHT on the persistent registration and reprocessing path', async () => {
  let persisted = false;
  const missing = {
    status: 'NEEDS_INPUT',
    reason: 'MISSING_WEIGHT',
    input: { type: 'WEIGHT', field: 'shippingWeightLbs' },
    redirector: { redirector: 'RED_DELAWARE', shippingMode: 'EXPRESS' },
  };
  const readyWithWeight = {
    ...ready,
    redirector: { redirector: 'RED_DELAWARE', shippingMode: 'EXPRESS' },
    shippingWeightLbs: 3.95,
  };
  const h = setup(() => (persisted ? readyWithWeight : missing));
  h.services.registerUsaShippingWeight.mock.mockImplementation(async () => {
    persisted = true;
    return { status: 'WEIGHT_FOUND', shippingWeightLbs: 3.95, registration: 'CREATED' };
  });

  await h.select();
  await h.call('UsaProductCard', 'onCalculate');
  await h.call('UsaRedirectorPanel', 'onChange', 'RED_DELAWARE');
  await h.call('UsaShippingWeightPanel', 'onInputChange', '3.95');
  await h.call('UsaShippingWeightPanel', 'onSubmit', { preventDefault() {} });

  assert.equal(h.services.registerUsaShippingWeight.mock.callCount(), 1);
  assert.equal(h.services.resolveUsaShippingWeight.mock.callCount(), 1);
  assert.equal(h.services.preflightUsaCost.mock.callCount(), 2);
  assert.equal(h.services.preflightUsaCost.mock.calls[1]!.arguments[2], undefined);
  assert.equal(h.nodes('UsaRedirectorPanel')[0]!.props.ready, true);
  assert.equal(h.services.executeUsaCost.mock.callCount(), 0);
});

test('uses KEY_INSUFFICIENT weight only in preflight and usa-cost without persistence', async () => {
  const insufficient = {
    status: 'NEEDS_INPUT',
    reason: 'KEY_INSUFFICIENT',
    input: { type: 'WEIGHT', field: 'shippingWeightLbs' },
    redirector: { redirector: 'RED_DELAWARE', shippingMode: 'EXPRESS' },
  };
  const readyWithWeight = {
    ...ready,
    redirector: { redirector: 'RED_DELAWARE', shippingMode: 'EXPRESS' },
    shippingWeightLbs: 3.95,
  };
  const h = setup((...args: unknown[]) => (args[2] === 3.95 ? readyWithWeight : insufficient));

  await h.select();
  await h.call('UsaProductCard', 'onCalculate');
  await h.call('UsaRedirectorPanel', 'onChange', 'RED_DELAWARE');
  assert.equal(h.nodes('UsaShippingWeightPanel').length, 1);
  await h.call('UsaShippingWeightPanel', 'onInputChange', '3.95');
  await h.call('UsaShippingWeightPanel', 'onSubmit', { preventDefault() {} });

  assert.equal(h.services.registerUsaShippingWeight.mock.callCount(), 0);
  assert.equal(h.services.preflightUsaCost.mock.calls[1]!.arguments[2], 3.95);
  assert.equal(h.nodes('UsaRedirectorPanel')[0]!.props.ready, true);

  await h.call('UsaRedirectorPanel', 'onSubmit');
  assert.equal(h.services.executeUsaCost.mock.callCount(), 1);
  assert.equal(h.services.executeUsaCost.mock.calls[0]!.arguments[3], 3.95);
});

test('invalidates a transient weight when the redirector changes', async () => {
  const insufficient = {
    status: 'NEEDS_INPUT',
    reason: 'KEY_INSUFFICIENT',
    input: { type: 'WEIGHT', field: 'shippingWeightLbs' },
    redirector: { redirector: 'RED_DELAWARE', shippingMode: 'EXPRESS' },
  };
  const readyWithWeight = { ...ready, shippingWeightLbs: 3.95 };
  const h = setup((...args: unknown[]) => (args[2] === 3.95 ? readyWithWeight : insufficient));

  await h.select();
  await h.call('UsaProductCard', 'onCalculate');
  await h.call('UsaRedirectorPanel', 'onChange', 'RED_DELAWARE');
  await h.call('UsaShippingWeightPanel', 'onInputChange', '3.95');
  await h.call('UsaShippingWeightPanel', 'onSubmit', { preventDefault() {} });
  await h.call('UsaRedirectorPanel', 'onChange', 'REI_DO_IMPORTADO');

  const lastCall = h.services.preflightUsaCost.mock.calls.at(-1)!;
  assert.equal(lastCall.arguments[2], undefined);
  assert.equal(h.nodes('UsaRedirectorPanel')[0]!.props.ready, false);
});

test('invalidates a transient weight when the selected product changes', async () => {
  const insufficient = {
    status: 'NEEDS_INPUT',
    reason: 'KEY_INSUFFICIENT',
    input: { type: 'WEIGHT', field: 'shippingWeightLbs' },
    redirector: { redirector: 'RED_DELAWARE', shippingMode: 'EXPRESS' },
  };
  const readyWithWeight = { ...ready, shippingWeightLbs: 3.95 };
  const h = setup(
    (...args: unknown[]) => (args[2] === 3.95 ? readyWithWeight : insufficient),
    [product, secondProduct],
  );

  await h.select();
  await h.call('UsaProductCard', 'onCalculate');
  await h.call('UsaRedirectorPanel', 'onChange', 'RED_DELAWARE');
  await h.call('UsaShippingWeightPanel', 'onInputChange', '3.95');
  await h.call('UsaShippingWeightPanel', 'onSubmit', { preventDefault() {} });

  const firstCard = h.nodes('UsaProductCard')[0]!;
  await (firstCard.props.onSelect as (checked: boolean) => void)(false);
  await setImmediate();
  const nextCard = h.nodes('UsaProductCard')[1]!;
  await (nextCard.props.onSelect as (checked: boolean) => void)(true);
  await setImmediate();
  await (h.nodes('UsaProductCard')[1]!.props.onCalculate as () => void)();
  await setImmediate();
  await h.call('UsaRedirectorPanel', 'onChange', 'RED_DELAWARE');

  const lastCall = h.services.preflightUsaCost.mock.calls.at(-1)!;
  assert.equal(lastCall.arguments[2], undefined);
});

test('keeps KEY_AMBIGUOUS blocked without exposing a weight input', async () => {
  const h = setup({
    status: 'BLOCKED',
    reason: 'KEY_AMBIGUOUS',
    redirector: { redirector: 'RED_DELAWARE', shippingMode: 'EXPRESS' },
  });

  await h.select();
  await h.call('UsaProductCard', 'onCalculate');
  await h.call('UsaRedirectorPanel', 'onChange', 'RED_DELAWARE');

  assert.equal(h.nodes('UsaShippingWeightPanel').length, 0);
  assert.equal(h.nodes('UsaRedirectorPanel')[0]!.props.ready, false);
  assert.equal(h.services.registerUsaShippingWeight.mock.callCount(), 0);
  assert.equal(h.services.executeUsaCost.mock.callCount(), 0);
});

test('sends only the FinalCost through the existing temporary pricing handoff', async () => {
  const h = setup();
  await h.select();
  await h.call('UsaProductCard', 'onCalculate');
  await h.call('UsaRedirectorPanel', 'onChange', 'REI_DO_IMPORTADO');
  await h.call('UsaRedirectorPanel', 'onSubmit');
  await h.call('CalculationModal', 'onSendToPricing');
  assert.equal(h.pricing.calculateTemporaryImportPricing.mock.callCount(), 1);
  const payload = h.pricing.calculateTemporaryImportPricing.mock.calls[0]!.arguments[0] as Props;
  assert.equal(payload.origin, 'US');
  assert.equal(payload.totalCost, 5500);
  assert.equal(payload.provider, 'amazon_us');
  assert.equal(h.router.push.mock.calls[0]!.arguments[0], '/pricing?temporaryImport=usa');
  assert.ok(h.storage.has('inest.temporary-import-pricing'));
});

test('invalidates a Red calculation before allowing the same modal to calculate Rei', async () => {
  const h = setup();
  await h.select();
  await h.call('UsaProductCard', 'onCalculate');
  await h.call('UsaRedirectorPanel', 'onChange', 'RED_DELAWARE');
  await h.call('UsaRedirectorPanel', 'onSubmit');
  assert.equal(
    (
      ((h.nodes('CalculationModal')[0]!.props.usaCostExecution as Props).calculation as Props)
        .redirector as Props
    ).redirector,
    'RED_DELAWARE',
  );

  await h.call('UsaRedirectorPanel', 'onChange', 'REI_DO_IMPORTADO');
  const reconfiguringModal = h.nodes('CalculationModal')[0]!;
  assert.equal(reconfiguringModal.props.usaCostExecution, null);
  await h.call('UsaRedirectorPanel', 'onSubmit');
  assert.equal(h.services.executeUsaCost.mock.callCount(), 2);
  assert.equal(
    (
      ((h.nodes('CalculationModal')[0]!.props.usaCostExecution as Props).calculation as Props)
        .redirector as Props
    ).redirector,
    'REI_DO_IMPORTADO',
  );
});

test('the Radar USA source no longer invokes usa-priced-offer', () => {
  assert.doesNotMatch(
    readFileSync(`${componentDirectory}/UsaRadarOrigin.tsx`, 'utf8'),
    /executeUsaPricedOffer|usa-priced-offer/,
  );
});
