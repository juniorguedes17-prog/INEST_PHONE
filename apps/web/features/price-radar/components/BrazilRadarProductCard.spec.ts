import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

type Props = Record<string, unknown>;
type Element = { type: string | ((props: Props) => Element); props: Props };

const cardSource = readFileSync(`${__dirname}/BrazilRadarProductCard.tsx`, 'utf8');
const cardCode = ts.transpileModule(cardSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText;

test('Brazil Radar card keeps supplier, pricing, selection, and quote data without Visualizar', () => {
  const exports: { BrazilRadarProductCard?: (props: Props) => Element } = {};
  const jsx = (type: Element['type'], props: Props) => ({ type, props });

  runInNewContext(cardCode, {
    exports,
    require: (name: string) => {
      if (name === 'react') return { memo: (component: Element['type']) => component };
      if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx, Fragment: 'fragment' };
      if (name === '@/components/shared')
        return { ActionButton: 'ActionButton', InfoTag: 'InfoTag', StatusBadge: 'StatusBadge' };
      if (name === '@/utils/product-card-presentation')
        return { getProductCardPresentation: () => ({ title: 'Produto teste', attributes: [] }) };
      throw new Error(`Unexpected dependency: ${name}`);
    },
  });

  const quote = {
    id: 'quote-1',
    productId: 'product-1',
    supplierId: 'supplier-1',
    productName: 'Produto teste',
    productDescription: null,
    category: 'Categoria',
    model: 'Modelo',
    color: 'Preto',
    capacity: '128GB',
    productType: 'PHONE',
    quality: 'Novo',
    supplier: { id: 'supplier-1', name: 'Fornecedor teste' },
    city: 'São Paulo',
    deliveryTime: '3 dias',
    contact: '',
    notes: '',
    costProduct: 100,
    quoteDate: '2026-09-07',
    updatedAt: '2026-09-07T12:00:00.000Z',
    status: 'valid',
    valid: true,
    inconsistencies: [],
  };
  const product = {
    id: 'product-1',
    name: 'Produto teste',
    category: 'Categoria',
    model: 'Modelo',
    color: 'Preto',
    capacity: '128GB',
    lowestCost: 100,
    supplierCount: 1,
    updatedAt: '2026-09-07T12:00:00.000Z',
    referenceQuote: quote,
  };
  let selected: { id: string; value: boolean } | null = null;
  let supplierQuote: unknown;
  let pricingQuote: unknown;

  const tree = exports.BrazilRadarProductCard!({
    product,
    selected: false,
    onSelect: (id: string, value: boolean) => {
      selected = { id, value };
    },
    onSupplier: (value: unknown) => {
      supplierQuote = value;
    },
    onSendToPricing: (value: unknown) => {
      pricingQuote = value;
    },
  });

  const nodes: Element[] = [];
  const collect = (value: unknown) => {
    if (!value || typeof value !== 'object' || !('props' in value)) return;
    const node = value as Element;
    nodes.push(node);
    const children = node.props.children;
    if (Array.isArray(children)) children.forEach(collect);
    else collect(children);
  };
  collect(tree);

  const actionButtons = nodes.filter((node) => node.type === 'ActionButton');
  assert.equal(
    actionButtons.some((node) => node.props.children === 'Visualizar'),
    false,
  );
  const supplierButton = actionButtons.find((node) => node.props.children === 'Fornecedor');
  const pricingButton = actionButtons.find(
    (node) => node.props.children === 'Enviar para Precificação',
  );
  assert.ok(supplierButton);
  assert.ok(pricingButton);
  (supplierButton.props.onClick as () => void)();
  (pricingButton.props.onClick as () => void)();
  assert.equal(supplierQuote, quote);
  assert.equal(pricingQuote, quote);

  const checkbox = nodes.find((node) => node.type === 'input' && node.props.type === 'checkbox');
  assert.ok(checkbox);
  (checkbox.props.onChange as (event: { target: { checked: boolean } }) => void)({
    target: { checked: true },
  });
  assert.deepEqual(selected, { id: 'product-1', value: true });
});

test('PriceRadarPageContent no longer contains the removed quote viewer flow', () => {
  const pageSource = readFileSync(`${__dirname}/PriceRadarPageContent.tsx`, 'utf8');

  assert.doesNotMatch(pageSource, /QuoteFormModal|quoteModalOpen|editingQuote|initialForm/);
  assert.doesNotMatch(pageSource, /listProducts|listSuppliers|radar\.save/);
});
