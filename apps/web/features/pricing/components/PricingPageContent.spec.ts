import assert from 'node:assert/strict';
import { dirname } from 'node:path';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import test, { mock } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

type Props = Record<string, unknown>;
type Element = { type: string | ((props: Props) => Element); props: Props };
const componentDirectory = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(`${componentDirectory}/PricingPageContent.tsx`, 'utf8');
const code = ts.transpileModule(
  `${source}\nexport { TemporaryImportPricingCard as __testCard, ConditionConfirmationModal as __testModal };`,
  { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } },
).outputText;

function setup() {
  const exports: {
    __testCard?: (props: Props) => Element;
    __testModal?: (props: Props) => Element;
  } = {};
  const jsx = (type: Element['type'], props: Props) => ({ type, props });
  runInNewContext(code, {
    exports,
    require: (name: string) => {
      if (name === 'react')
        return {
          useEffect: () => undefined,
          useMemo: (fn: () => unknown) => fn(),
          useState: () => [],
        };
      if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx, Fragment: 'fragment' };
      if (name === '@/components/shared') {
        return Object.fromEntries(
          [
            'ActionButton',
            'EmptyState',
            'ErrorState',
            'KpiCard',
            'LoadingState',
            'Modal',
            'PageHeader',
            'Pagination',
            'StatusBadge',
          ].map((key) => [key, key]),
        );
      }
      if (name.endsWith('/usePricing')) return { usePricing: () => ({}) };
      if (name.endsWith('/useSettings')) return { useSettings: () => ({}) };
      if (name.endsWith('/PricingProductCard')) return { PricingProductCard: 'PricingProductCard' };
      if (name.endsWith('/PricingToolbar')) return { PricingToolbar: 'PricingToolbar' };
      if (name.endsWith('/brazil-radar-facets')) return {};
      if (name.endsWith('/ProductFacetsDrawer'))
        return { ProductFacetsDrawer: 'ProductFacetsDrawer' };
      if (name.endsWith('/product-card-presentation')) {
        return { getProductCardPresentation: () => ({ title: 'Mac Mini', attributes: [] }) };
      }
      throw new Error(`Unexpected dependency: ${name}`);
    },
  });
  return exports;
}

function nodes(tree: Element, type: string) {
  const found: Element[] = [];
  const visit = (value: unknown) => {
    if (Array.isArray(value)) return value.forEach(visit);
    if (!value || typeof value !== 'object' || !('props' in value)) return;
    const element = value as Element;
    if (element.type === type) found.push(element);
    Object.values(element.props).forEach(visit);
  };
  visit(tree);
  return found;
}

const pendingItem = {
  origin: 'PY',
  calculationStatus: 'condition_unresolved',
  calculationError: 'Condicao ausente.',
  financialClassificationReason: 'apple_registry',
  product: {
    name: 'Apple Mac Mini M2',
    supplier: 'Loja PY',
    city: '',
    store: 'Loja PY',
    capacity: '512GB',
    color: '',
  },
  profit: { productDescription: 'Mac Mini M2 8GB 512GB', condition: null },
  importCosts: { totalCost: 3418.93 },
  desiredNetProfit: null,
  salePrice: null,
  margin: null,
  offerDraft: null,
};

test('offers a specific condition action only for condition_unresolved', () => {
  const card = setup().__testCard;
  assert.ok(card);
  const onConfirmCondition = mock.fn();
  const tree = card({
    item: pendingItem,
    generating: false,
    onGenerateOffer: mock.fn(),
    onRegisterProfit: mock.fn(),
    onConfirmManufacturer: mock.fn(),
    onConfirmCondition,
  });
  const action = nodes(tree, 'ActionButton').find(
    (node) => node.props.children === 'Confirmar condicao',
  );

  assert.ok(action);
  (action.props.onClick as () => void)();
  assert.equal(onConfirmCondition.mock.callCount(), 1);
  assert.equal(
    nodes(tree, 'ActionButton').some((node) => node.props.children === 'Gerar Oferta'),
    false,
  );
});

test('condition modal exposes only the existing enum and starts without a default', () => {
  const modal = setup().__testModal;
  assert.ok(modal);
  const tree = modal({
    item: pendingItem,
    value: '',
    error: null,
    saving: false,
    onChange: mock.fn(),
    onClose: mock.fn(),
    onSave: mock.fn(),
  });
  const select = nodes(tree, 'select')[0];
  assert.ok(select);
  assert.equal(select.props.value, '');
  assert.deepEqual(
    nodes(tree, 'option').map((option) => option.props.value),
    ['', 'NOVO', 'SEMINOVO', 'CPO'],
  );
  const submit = nodes(tree, 'ActionButton').find(
    (node) => node.props.children === 'Confirmar e recalcular',
  );
  assert.equal(submit?.props.disabled, true);
});
