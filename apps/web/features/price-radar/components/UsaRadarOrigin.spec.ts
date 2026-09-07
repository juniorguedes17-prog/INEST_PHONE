import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { setImmediate } from 'node:timers/promises';
import test, { mock } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

type Element = { type: string | ((props: Props) => Element); props: Props };
type Props = Record<string, unknown>;
const product = {
  source: 'US',
  providerName: 'amazon_us',
  sourceProductId: 'amazon:item',
  sourceName: 'Produto externo',
  retailer: 'Amazon',
  priceUsd: 500,
};
const ready = { status: 'READY_FOR_COST', shippingWeightLbs: null };
const missing = { status: 'NEEDS_INPUT', reason: 'MISSING_WEIGHT', input: { type: 'WEIGHT' } };
const componentCode = ts.transpileModule(readFileSync(`${__dirname}/UsaRadarOrigin.tsx`, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText;

// Exercise the actual component callbacks with local hook state and mocked HTTP services.
// No DOM runner, provider network calls, or persistence are needed for this handoff regression.
function setup(response: object) {
  const services = {
    searchUsaWithDiagnostics: mock.fn(
      async (): Promise<{
        products: (typeof product)[];
        providers: { provider: string; status: string; returnedCount: number }[];
      }> => ({
        products: [product],
        providers: [{ provider: 'amazon_us', status: 'OK', returnedCount: 1 }],
      }),
    ),
    resolveUsaEnrichment: mock.fn(async () => ({ decision: { status: 'READY', reason: null } })),
    preflightUsaCost: mock.fn(async (...args: unknown[]) => (void args, response)),
    resolveUsaShippingWeight: mock.fn(
      async (...args: unknown[]) => (
        void args,
        {
          status: 'WEIGHT_FOUND',
          shippingWeightLbs: 0.65,
        }
      ),
    ),
    registerUsaShippingWeight: mock.fn(async (...args: unknown[]) => (void args, {})),
    executeUsaPricedOffer: mock.fn(
      async (...args: unknown[]) => (
        void args,
        {
          status: 'BLOCKED',
          reason: 'missing_profit',
        }
      ),
    ),
  };
  const state: unknown[] = [];
  let cursor = 0;
  const exports: { UsaRadarOrigin?: () => Element } = {};
  const jsx = (type: Element['type'], props: Props) => ({ type, props });
  runInNewContext(componentCode, {
    exports,
    Error,
    require: (name: string) => {
      if (name === 'react')
        return {
          useState: (initial: unknown) => {
            const index = cursor++;
            if (!(index in state)) state[index] = initial;
            return [
              state[index],
              (value: unknown) => {
                state[index] = value;
              },
            ];
          },
          useRef: (initial: unknown) => {
            const index = cursor++;
            if (!(index in state)) state[index] = { current: initial };
            return state[index];
          },
          useCallback: (callback: unknown) => callback,
        };
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
      if (Array.isArray(value)) {
        value.forEach(visit);
        return;
      }
      if (!value || typeof value !== 'object' || !('props' in value)) return;
      const element = value as Element;
      if ((typeof element.type === 'string' ? element.type : element.type.name) === name)
        found.push(element);
      visit(element.props.children);
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
    await call('SearchInput', 'onChange', { target: { value: 'produto' } });
    await call('form', 'onSubmit', { preventDefault() {} });
    await call('UsaProductCard', 'onSelect', product);
    assert.equal(services.resolveUsaShippingWeight.mock.callCount(), 0);
    assert.equal(services.preflightUsaCost.mock.callCount(), 0);
    assert.equal(nodes('UsaRedirectorPanel').length, 1);
    assert.equal(nodes('UsaShippingWeightPanel').length, 0);
  };
  return { services, nodes, call, select };
}

test('Rei CELULAR: READY_FOR_COST without weight enables execution for an external product', async () => {
  const h = setup(ready);
  await h.select();
  await h.call('UsaRedirectorPanel', 'onChange', 'REI_DO_IMPORTADO');
  assert.equal(h.nodes('UsaRedirectorPanel')[0]!.props.ready, true);
  assert.equal(h.services.resolveUsaShippingWeight.mock.callCount(), 0);
  await h.call('UsaRedirectorPanel', 'onSubmit');
  assert.equal(h.services.executeUsaPricedOffer.mock.callCount(), 1);
  const [source, redirector] = h.services.executeUsaPricedOffer.mock.calls[0]!.arguments;
  assert.equal(source, product);
  assert.equal((redirector as Props).redirector, 'REI_DO_IMPORTADO');
});

test('real empty search shows the empty state rather than a provider warning', async () => {
  const h = setup(ready);
  h.services.searchUsaWithDiagnostics.mock.mockImplementation(async () => ({
    products: [],
    providers: [{ provider: 'apple_us', status: 'EMPTY', returnedCount: 0 }],
  }));
  await h.call('SearchInput', 'onChange', { target: { value: 'CAMERA' } });
  await h.call('form', 'onSubmit', { preventDefault() {} });
  assert.equal(h.nodes('EmptyState').length, 1);
  assert.equal(h.nodes('ErrorState').length, 0);
});

for (const hasProducts of [true, false]) {
  test(`partial search has a warning, not absolute empty (${hasProducts})`, async () => {
    const h = setup(ready);
    h.services.searchUsaWithDiagnostics.mock.mockImplementation(async () => ({
      products: hasProducts ? [product] : [],
      providers: [{ provider: 'amazon_us', status: 'UNAVAILABLE', returnedCount: 0 }],
    }));
    await h.call('SearchInput', 'onChange', { target: { value: 'CAMERA' } });
    await h.call('form', 'onSubmit', { preventDefault() {} });
    assert.equal(h.nodes('EmptyState').length, 0);
    assert.equal(h.nodes('ErrorState').length, 0);
    assert.ok(
      h
        .nodes('p')
        .some((node) => String(node.props.children).includes('Algumas fontes não responderam')),
    );
    assert.equal(h.nodes('UsaProductCard').length, hasProducts ? 1 : 0);
    if (hasProducts) await h.call('UsaProductCard', 'onSelect', product);
  });
}

test('total failure shows a safe technical message with retry, not raw HTTP details', async () => {
  const h = setup(ready);
  h.services.searchUsaWithDiagnostics.mock.mockImplementation(async () => {
    throw new Error('HTTP 503 stack');
  });
  await h.call('SearchInput', 'onChange', { target: { value: 'CAMERA' } });
  await h.call('form', 'onSubmit', { preventDefault() {} });
  assert.equal(
    h.nodes('ErrorState')[0]?.props.description,
    'Não foi possível consultar as fontes agora.',
  );
  assert.equal(h.nodes('EmptyState').length, 0);
});

for (const [label, redirector] of [
  ['Rei OTHER', 'REI_DO_IMPORTADO'],
  ['Red', 'RED_DELAWARE'],
]) {
  test(`${label}: backend MISSING_WEIGHT opens P8B; WRITE → READ → preflight for the same product`, async () => {
    const h = setup(missing);
    await h.select();
    await h.call('UsaRedirectorPanel', 'onChange', redirector);
    assert.equal(h.nodes('UsaRedirectorPanel')[0]!.props.ready, false);
    assert.equal(
      (h.nodes('UsaShippingWeightPanel')[0]!.props.resolution as Props).status,
      'MISSING_WEIGHT',
    );
    await h.call('UsaRedirectorPanel', 'onSubmit');
    assert.equal(h.services.executeUsaPricedOffer.mock.callCount(), 0);
    const order: string[] = [];
    h.services.registerUsaShippingWeight.mock.mockImplementation(async () => {
      order.push('WRITE');
      return {};
    });
    h.services.resolveUsaShippingWeight.mock.mockImplementation(async () => {
      order.push('READ');
      return { status: 'WEIGHT_FOUND', shippingWeightLbs: 0.65 };
    });
    h.services.preflightUsaCost.mock.mockImplementation(async () => {
      order.push('PREFLIGHT');
      return { ...ready, shippingWeightLbs: 0.65 };
    });
    await h.call('UsaShippingWeightPanel', 'onInputChange', '0.650');
    await h.call('UsaShippingWeightPanel', 'onSubmit', { preventDefault() {} });
    assert.deepEqual(order, ['WRITE', 'READ', 'PREFLIGHT']);
    assert.equal(h.nodes('UsaRedirectorPanel')[0]!.props.ready, true);
    assert.equal(h.services.registerUsaShippingWeight.mock.calls[0]!.arguments[0], product);
    assert.equal(h.services.resolveUsaShippingWeight.mock.calls[0]!.arguments[0], product);
    assert.equal(h.services.preflightUsaCost.mock.calls[1]!.arguments[0], product);
  });
}

for (const reason of ['KEY_INSUFFICIENT', 'KEY_AMBIGUOUS']) {
  test(`${reason}: no weight form or execution`, async () => {
    const h = setup({ status: 'BLOCKED', reason });
    await h.select();
    await h.call('UsaRedirectorPanel', 'onChange', 'RED_DELAWARE');
    assert.equal(h.nodes('UsaShippingWeightPanel').length, 0);
    assert.equal(h.nodes('BlockedState')[0]!.props.reason, reason);
    await h.call('UsaRedirectorPanel', 'onSubmit');
    assert.equal(h.services.executeUsaPricedOffer.mock.callCount(), 0);
    assert.equal(h.services.registerUsaShippingWeight.mock.callCount(), 0);
  });
}

test('changing redirector invalidates READY and consumes a fresh backend decision', async () => {
  const h = setup(ready);
  await h.select();
  await h.call('UsaRedirectorPanel', 'onChange', 'REI_DO_IMPORTADO');
  h.services.preflightUsaCost.mock.mockImplementation(async () => missing);
  await h.call('UsaRedirectorPanel', 'onChange', 'RED_DELAWARE');
  assert.equal(h.nodes('UsaRedirectorPanel')[0]!.props.ready, false);
  assert.equal(h.services.preflightUsaCost.mock.callCount(), 2);
  const selection = h.services.preflightUsaCost.mock.calls[1]!.arguments[1] as Props;
  assert.equal(selection.redirector, 'RED_DELAWARE');
  assert.equal(selection.shippingMode, 'EXPRESS');
});

test('preflight technical error does not enable execution or ask for weight', async () => {
  const h = setup(ready);
  h.services.preflightUsaCost.mock.mockImplementation(async () => {
    throw new Error('HTTP 500');
  });
  await h.select();
  await h.call('UsaRedirectorPanel', 'onChange', 'REI_DO_IMPORTADO');
  assert.equal(h.nodes('UsaRedirectorPanel')[0]!.props.ready, false);
  assert.equal(h.nodes('UsaShippingWeightPanel').length, 0);
  assert.equal(h.nodes('ErrorState')[0]!.props.description, 'HTTP 500');
});

test('an old preflight response cannot affect a newly selected product', async () => {
  const h = setup(ready);
  await h.select();
  let complete!: (value: object) => void;
  h.services.preflightUsaCost.mock.mockImplementation(
    () =>
      new Promise((resolve) => {
        complete = resolve;
      }),
  );
  await h.call('UsaRedirectorPanel', 'onChange', 'RED_DELAWARE');
  await h.call('UsaProductCard', 'onSelect', { ...product, sourceProductId: 'another:item' });
  complete(missing);
  await setImmediate();
  assert.equal(h.nodes('UsaRedirectorPanel')[0]!.props.value, '');
  assert.equal(h.nodes('UsaRedirectorPanel')[0]!.props.ready, false);
  assert.equal(h.nodes('UsaShippingWeightPanel').length, 0);
});

test('HTTP handoff uses the existing preflight route with the original product and redirector only', async () => {
  const fetch = mock.fn(
    async (...args: unknown[]) => (void args, new Response(JSON.stringify(ready))),
  );
  const exports: { preflightUsaCost?: (source: unknown, redirector: unknown) => Promise<unknown> } =
    {};
  const source = readFileSync(
    `${__dirname}/../../import-radar/services/import-radar-service.ts`,
    'utf8',
  );
  runInNewContext(
    ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText,
    {
      exports,
      require: (name: string) => {
        if (name === '@/lib/env') return { env: { apiUrl: 'https://api.test/api/v1' } };
        if (name === '@/services/authenticated-fetch') return { authenticatedFetch: fetch };
        throw new Error(`Unexpected dependency: ${name}`);
      },
    },
  );
  await exports.preflightUsaCost!(product, { redirector: 'REI_DO_IMPORTADO' });
  const [url, init] = fetch.mock.calls[0]!.arguments;
  assert.equal(url, 'https://api.test/api/v1/import-radar/usa-cost-preflight');
  assert.equal((init as RequestInit).method, 'POST');
  assert.deepEqual(JSON.parse((init as RequestInit).body as string), {
    sourceProduct: product,
    redirector: { redirector: 'REI_DO_IMPORTADO' },
    composition: { kind: 'SINGLE_ITEM' },
  });
});
