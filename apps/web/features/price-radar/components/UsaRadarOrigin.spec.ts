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
const secondProduct = { ...product, sourceProductId: 'amazon:item-2', sourceName: 'Outro produto' };
const ready = {
  status: 'READY_FOR_COST',
  redirector: { redirector: 'REI_DO_IMPORTADO' },
  shippingWeightLbs: null,
  condition: 'SEMINOVO',
  normalizedPricing: { category: 'iPhone', model: 'iPhone 17 Pro', capacity: '512GB', color: null },
};
const componentCode = ts.transpileModule(
  readFileSync(`${componentDirectory}/UsaRadarOrigin.tsx`, 'utf8'),
  {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  },
).outputText;

function setup(preflightResponse: object = ready, searchProducts = [product]) {
  const services = {
    searchUsaWithDiagnostics: mock.fn(async () => ({
      products: searchProducts,
      providers: [{ provider: 'amazon_us', status: 'OK', returnedCount: 1 }],
    })),
    resolveUsaEnrichment: mock.fn(async () => ({ decision: { status: 'READY', reason: null } })),
    preflightUsaCost: mock.fn(async () => preflightResponse),
    executeUsaCost: mock.fn(async (...args: unknown[]) => {
      const redirector = args[1] as Props;
      return {
        preflight: ready,
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
    resolveUsaShippingWeight: mock.fn(),
    registerUsaShippingWeight: mock.fn(),
    confirmUsaManufacturer: mock.fn(),
  };
  const pricing = {
    calculateTemporaryImportPricing: mock.fn(async (payload: unknown) => payload),
  };
  const state: unknown[] = [];
  const storage = new Map<string, string>();
  let cursor = 0;
  const exports: { UsaRadarOrigin?: () => Element } = {};
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
            return [state[index], (value: unknown) => (state[index] = value)];
          },
          useRef: (initial: unknown) => {
            const index = cursor++;
            if (!(index in state)) state[index] = { current: initial };
            return state[index];
          },
          useCallback: (callback: unknown) => callback,
        };
      if (name === 'next/navigation') return { useRouter: () => router };
      if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx, Fragment: 'fragment' };
      if (name === '@/components/shared')
        return Object.fromEntries(
          [
            'ActionButton',
            'EmptyState',
            'ErrorState',
            'LoadingState',
            'SearchInput',
            'StatusBadge',
          ].map((key) => [key, key]),
        );
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
  return { services, pricing, router, storage, nodes, call, select };
}

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

test('does not calculate cost when the backend requires a shipping weight', async () => {
  const h = setup({
    status: 'NEEDS_INPUT',
    reason: 'MISSING_WEIGHT',
    input: { type: 'WEIGHT', field: 'shippingWeightLbs' },
    redirector: { redirector: 'RED_DELAWARE', shippingMode: 'EXPRESS' },
  });
  await h.select();
  await h.call('UsaProductCard', 'onCalculate');
  await h.call('UsaRedirectorPanel', 'onChange', 'RED_DELAWARE');
  assert.equal(h.nodes('UsaShippingWeightPanel').length, 1);
  assert.equal(h.nodes('UsaRedirectorPanel')[0]!.props.ready, false);
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
