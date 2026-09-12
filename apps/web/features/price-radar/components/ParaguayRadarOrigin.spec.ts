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
const componentDirectory = dirname(fileURLToPath(import.meta.url));
const product = {
  id: 'py-1',
  name: 'iPhone 17 Pro 256GB',
  store: 'Compras Paraguai',
  category: 'iPhone',
  priceUsd: 999,
  productUrl: 'https://example.com/py-1',
  imageUrl: null,
  brand: 'Apple',
  sourceManufacturer: 'Apple',
  sourceManufacturerProvenance: 'EXPLICIT_SOURCE',
  model: 'iPhone 17 Pro',
  capacity: '256GB',
  color: 'Titânio',
  city: 'Ciudad del Este',
  priceBrlSource: null,
  availability: 'Disponível',
  storeUrl: 'https://example.com/store',
  consultedAt: '2026-09-07T12:00:00.000Z',
  origin: 'PARAGUAY',
  externalId: 'external-py-1',
  minimumPriceUsd: 999,
  averagePriceUsd: 999,
  maximumPriceUsd: 999,
  storeCount: 1,
  offerCount: 1,
  condition: 'NOVO',
};
const componentCode = ts.transpileModule(
  readFileSync(`${componentDirectory}/ParaguayRadarOrigin.tsx`, 'utf8'),
  {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  },
).outputText;

function setup() {
  let releaseSearch: (() => void) | undefined;
  const services = {
    searchImportProducts: mock.fn(
      (filters: unknown) =>
        new Promise<{ results: (typeof product)[]; filters: unknown }>((resolve) => {
          releaseSearch = () => resolve({ results: [product], filters });
        }),
    ),
    calculateImportCost: mock.fn(async () => ({ product })),
    confirmImportManufacturer: mock.fn(async () => ({ product })),
  };
  const pricing = { calculateTemporaryImportPricing: mock.fn(async (payload: unknown) => payload) };
  const state: unknown[] = [];
  let cursor = 0;
  const exports: {
    ParaguayRadarOrigin?: () => Element;
    CalculationModal?: (props: Props) => Element;
    buildTemporaryPricingRequest?: (calculation: Props) => Props;
  } = {};
  const jsx = (type: Element['type'], props: Props) => ({ type, props });

  runInNewContext(componentCode, {
    exports,
    Error,
    window: {
      setTimeout: () => 1,
      clearTimeout: () => undefined,
      sessionStorage: { setItem: () => undefined },
    },
    require: (name: string) => {
      if (name === 'react') {
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
          useCallback: (callback: unknown) => callback,
          useEffect: () => undefined,
          useMemo: (factory: () => unknown) => factory(),
        };
      }
      if (name === 'next/navigation') return { useRouter: () => ({ push: mock.fn() }) };
      if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx, Fragment: 'fragment' };
      if (name === '@/components/shared')
        return Object.fromEntries(
          [
            'ActionButton',
            'EmptyState',
            'ErrorState',
            'KpiCard',
            'LoadingState',
            'Modal',
            'Pagination',
            'SearchInput',
            'StatusBadge',
          ].map((key) => [key, key]),
        );
      if (name.endsWith('/ProductFacetsDrawer'))
        return { ProductFacetsDrawer: 'ProductFacetsDrawer', buildFacetOptions: () => [] };
      if (name.endsWith('/import-radar-service')) return services;
      if (name.endsWith('/pricing-service')) return pricing;
      if (name.endsWith('/pricing'))
        return { TEMPORARY_IMPORT_PRICING_STORAGE_KEY: 'inest.temporary-import-pricing' };
      if (name.endsWith('/brazil-radar-facets'))
        return {
          buildCanonicalModelFacetOptions: () => [],
          getCanonicalCapacities: () => [],
          getCanonicalCategory: (source: Props) => source.category ?? '',
          getCanonicalColors: () => [],
          getCanonicalModelKey: (source: Props) => source.model ?? '',
          getCatalogFacetLabel: (value: string) => value,
          normalizeCatalogFilterText: (value: string) => value,
        };
      if (name.endsWith('/product-card-presentation'))
        return {
          getProductCardPresentation: (input: Props) => ({
            title: input.rawDescription,
            attributes: [],
          }),
        };
      throw new Error(`Unexpected dependency: ${name}`);
    },
  });

  const render = () => {
    cursor = 0;
    return exports.ParaguayRadarOrigin!();
  };
  const nodes = (name: string): Element[] => {
    const found: Element[] = [];
    const visit = (value: unknown) => {
      if (Array.isArray(value)) return value.forEach(visit);
      if (!value || typeof value !== 'object' || !('props' in value)) return;
      const element = value as Element;
      if ((typeof element.type === 'string' ? element.type : element.type.name) === name) {
        found.push(element);
      }
      Object.values(element.props).forEach(visit);
    };
    visit(render());
    return found;
  };
  const call = async (name: string, handler: string, value?: unknown) => {
    const node = nodes(name)[0];
    assert.ok(node, `${name} must be rendered`);
    await (node.props[handler] as (argument?: unknown) => unknown)(value);
    await setImmediate();
  };
  return {
    services,
    nodes,
    call,
    CalculationModal: exports.CalculationModal,
    buildTemporaryPricingRequest: exports.buildTemporaryPricingRequest,
    releaseSearch: () => releaseSearch?.(),
  };
}

test('replaces only the PY toolbar cost action with the existing search flow', async () => {
  const h = setup();
  const actionButtons = () => h.nodes('ActionButton');
  const button = (label: string) => actionButtons().find((node) => node.props.children === label);

  assert.equal(button('Calcular Custo'), undefined);
  assert.ok(button('Buscar'));
  assert.ok(button('Atualizar'));
  assert.ok(button('Limpar'));
  assert.ok(button('Filtros'));
  assert.equal(button('Buscar')?.props.disabled, true);

  await h.call('SearchInput', 'onChange', { target: { value: 'iphone' } });
  assert.equal(button('Buscar')?.props.disabled, false);
  await (button('Buscar')?.props.onClick as () => void)();
  assert.equal(button('Buscando...')?.props.disabled, true);
  assert.equal(button('Atualizar')?.props.disabled, true);
  assert.equal(h.services.searchImportProducts.mock.callCount(), 1);
  h.releaseSearch();
  await setImmediate();
  assert.equal(
    JSON.stringify(h.services.searchImportProducts.mock.calls[0]?.arguments[0]),
    JSON.stringify({ search: 'iphone', category: '', provider: 'compras_paraguai' }),
  );

  assert.ok(h.nodes('ParaguayProductCard')[0]);
  await h.call('ParaguayProductCard', 'onSelect', true);
  assert.equal(h.nodes('ParaguayProductCard')[0]?.props.selected, true);
  await h.call('ParaguayProductCard', 'onCalculate');
  assert.equal(h.services.calculateImportCost.mock.callCount(), 1);
  assert.ok(h.nodes('CalculationModal')[0]?.props.calculation);
});

test('does not disguise a missing PY structured model as the commercial product name', () => {
  const buildRequest = setup().buildTemporaryPricingRequest;
  assert.ok(buildRequest);
  const calculation = {
    product: { ...product, model: undefined },
    catalogProductId: null,
    sourceCommercialIdentity: {
      displayName: 'Nome apenas para apresentacao',
      commercialName: 'iPhone 17 Pro 256GB Natural Novo',
      sourceManufacturer: 'Apple',
      sourceManufacturerProvenance: 'EXPLICIT_SOURCE',
    },
    dollarQuote: 5,
    breakdown: {
      convertedPrice: 4995,
      cdeExit: 0,
      redirectCost: 0,
      brazilDispatch: 0,
      invoiceTax: 0,
      correiosLabel: 0,
    },
    total: 4995,
    condition: 'NOVO',
    matchedProductType: 'Celular',
  };

  const withoutModel = buildRequest(calculation);
  const withModel = buildRequest({
    ...calculation,
    product: { ...product, model: 'iPhone 17 Pro' },
  });

  assert.equal(withoutModel.model, undefined);
  assert.equal(withModel.model, 'iPhone 17 Pro');
  assert.equal(withoutModel.productName, product.name);
  assert.equal(withoutModel.displayName, 'Nome apenas para apresentacao');
  assert.equal('commercialName' in withoutModel, false);
});

test('uses commercialName only in the USA/PY modal presentation with visual fallback', () => {
  const h = setup();
  const pyRendered = JSON.stringify(
    h.CalculationModal!({
      calculation: {
        product,
        sourceCommercialIdentity: {
          commercialName: 'Apple iPhone 17 Pro 256GB Natural Novo',
        },
        pricingEligibility: { status: 'ELIGIBLE', reason: null },
        breakdown: {},
        total: 0,
        matchedProductType: 'Celular',
      },
      sending: false,
      onClose: () => undefined,
      onSendToPricing: () => undefined,
      onConfirmManufacturer: () => undefined,
    }),
  );
  const usaRendered = JSON.stringify(
    h.CalculationModal!({
      calculation: null,
      usaCostExecution: {
        preflight: {
          status: 'READY_FOR_COST',
          commercialName: 'Garmin vivoactive 5 42mm GPS Ivory',
        },
        calculation: {
          sourceCommercialIdentity: {
            sourceName: 'Long raw Garmin retailer title',
            sourceUrl: 'https://example.com',
          },
          redirector: { redirector: 'RED_DELAWARE' },
          breakdown: {},
          finalCost: { amountBrl: 0 },
        },
      },
      usaDisplayName: 'Garmin vivoactive 5 42mm GPS Ivory',
      sending: false,
      onClose: () => undefined,
      onSendToPricing: () => undefined,
      onConfirmManufacturer: () => undefined,
    }),
  );

  assert.match(pyRendered, /Apple iPhone 17 Pro 256GB Natural Novo/);
  assert.match(usaRendered, /Garmin vivoactive 5 42mm GPS Ivory/);
  assert.doesNotMatch(usaRendered, /Long raw Garmin retailer title/);
});

test('renders Red Delaware breakdown labels without changing its values', () => {
  const h = setup();
  const rendered = JSON.stringify(
    h.CalculationModal!({
      calculation: null,
      usaCostExecution: {
        calculation: {
          sourceCommercialIdentity: { sourceName: 'Camera', sourceUrl: 'https://example.com' },
          redirector: { redirector: 'RED_DELAWARE' },
          breakdown: {
            productPriceUsd: 1000,
            usdBrlQuote: 5,
            shippingWeightLbs: 2,
            chargedLbs: 2,
            firstLbUsd: 150,
            additionalLbUsd: 25,
            shippingUsd: 175,
            productValueBrl: 5000,
            shippingBrl: 875,
          },
          finalCost: { amountBrl: 5875 },
        },
      },
      sending: false,
      onClose: () => undefined,
      onSendToPricing: () => undefined,
      onConfirmManufacturer: () => undefined,
    }),
  );

  assert.match(rendered, /Peso do Frete \(lb\)/);
  assert.match(rendered, /Custo do Primeiro lb \(USD\)/);
  assert.match(rendered, /Custo por lb Adicional \(USD\)/);
  assert.match(rendered, /Frete \(USD\)/);
  assert.ok(rendered.includes('"children":175'));
  assert.ok(rendered.includes('"children":"R$ 875,00"'));
  assert.doesNotMatch(rendered, /shippingWeightLbs|firstLbUsd|additionalLbUsd/);
});

test('renders Rei do Importado commercial labels and preserves every breakdown value', () => {
  const h = setup();
  const rendered = JSON.stringify(
    h.CalculationModal!({
      calculation: null,
      usaCostExecution: {
        calculation: {
          sourceCommercialIdentity: { sourceName: 'iPhone', sourceUrl: 'https://example.com' },
          redirector: { redirector: 'REI_DO_IMPORTADO' },
          breakdown: {
            productPriceUsd: 1000,
            usdBrlQuote: 5,
            shippingWeightLbs: null,
            classification: 'CELULAR',
            quantity: 1,
            weightKg: null,
            halfKgBlocks: null,
            baseShippingUsd: 150,
            shippingDiscountPercent: 10,
            shippingDiscountUsd: 15,
            shippingUsd: 135,
            insurancePercent: 0,
            insuranceBrl: 0,
            taxTreatment: 'TAXABLE',
            taxPercent: 7,
            taxUsd: 83.93,
            taxBrl: 444.83,
            productValueBrl: 5000,
            shippingBrl: 675,
          },
          finalCost: { amountBrl: 6119.83 },
        },
      },
      sending: false,
      onClose: () => undefined,
      onSendToPricing: () => undefined,
      onConfirmManufacturer: () => undefined,
    }),
  );

  for (const label of [
    'Quantidade',
    'Custo Base do Frete (USD)',
    'Desconto no Frete (%)',
    'Desconto no Frete (USD)',
    'Frete (USD)',
    'Taxa do Seguro (%)',
    'Seguro Contratado (R$)',
    'Imposto sobre Venda (%)',
    'Imposto Total (USD)',
    'Imposto Total (R$)',
  ]) {
    assert.ok(rendered.includes(label), `missing label: ${label}`);
  }
  for (const technicalLabel of [
    'quantity',
    'baseShippingUsd',
    'shippingDiscountPercent',
    'shippingDiscountUsd',
    'insurancePercent',
    'taxPercent',
  ]) {
    assert.ok(!rendered.includes(technicalLabel), `technical label rendered: ${technicalLabel}`);
  }
  assert.ok(rendered.includes('"children":150'));
  assert.ok(rendered.includes('"children":135'));
  assert.ok(rendered.includes('"children":"R$ 444,83"'));
});
