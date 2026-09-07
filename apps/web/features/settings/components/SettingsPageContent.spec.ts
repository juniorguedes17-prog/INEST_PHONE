import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { formatQuoteInput, parseQuoteInput } from '../lib/quote-input';

type Props = Record<string, unknown>;
type Element = { type: string | ((props: Props) => Element); props: Props };

const source = readFileSync(`${__dirname}/SettingsPageContent.tsx`, 'utf8');
const componentCode = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText;

// This exercises the real JSX callback and controlled UsdInput, without adding a React DOM runner.
test('settings keep editing behavior and omit the obsolete offer settings card', () => {
  assert.ok(
    source.includes(
      'className="grid grid-cols-1 gap-3 px-0 py-4 lg:px-4 lg:grid-cols-[1.4fr_1.2fr_160px_110px_96px]"',
    ),
  );
  assert.ok(
    source.includes(
      'className="hidden gap-3 bg-inest-soft px-4 py-3 text-sm font-black text-inest-muted lg:grid lg:grid-cols-[1.4fr_1.2fr_160px_110px_96px]"',
    ),
  );
  const settingsRef = { current: settings(520) };
  let saved: Record<string, unknown> | null = null;
  const states: unknown[] = [];
  const effects: Array<readonly unknown[] | undefined> = [];
  let stateCursor = 0;
  let effectCursor = 0;
  const exports: { SettingsPageContent?: () => Element } = {};
  const jsx = (type: Element['type'], props: Props) => ({ type, props });

  runInNewContext(componentCode, {
    exports,
    window: { addEventListener() {}, removeEventListener() {} },
    Event,
    CustomEvent,
    require: (name: string) => {
      if (name === 'react') {
        return {
          useState(initial: unknown) {
            const index = stateCursor++;
            if (!(index in states)) states[index] = initial;
            return [
              states[index],
              (next: unknown) => {
                states[index] =
                  typeof next === 'function'
                    ? (next as (value: unknown) => unknown)(states[index])
                    : next;
              },
            ];
          },
          useEffect(callback: () => void, dependencies?: readonly unknown[]) {
            const index = effectCursor++;
            const previous = effects[index];
            effects[index] = dependencies;
            if (
              !previous ||
              !dependencies ||
              dependencies.some((value, key) => value !== previous[key])
            )
              callback();
          },
        };
      }
      if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx, Fragment: 'fragment' };
      if (name === '@/components/shared') {
        return Object.fromEntries(
          [
            'ActionButton',
            'CurrencyInput',
            'ErrorState',
            'LoadingState',
            'PageHeader',
            'PercentageInput',
            'SettingsCard',
            'StatusBadge',
          ].map((key) => [key, key]),
        );
      }
      if (name.endsWith('/hooks/useSettings'))
        return {
          useSettings: () => ({
            settings: settingsRef.current,
            setSettings: (next: unknown) => {
              settingsRef.current =
                typeof next === 'function'
                  ? (next as (value: typeof settingsRef.current) => typeof settingsRef.current)(
                      settingsRef.current,
                    )
                  : (next as typeof settingsRef.current);
            },
            loading: false,
            saving: false,
            error: null,
            success: null,
            save: (next: typeof settingsRef.current) => {
              saved = next;
              settingsRef.current = next;
              return Promise.resolve();
            },
            resetDefaults: () => Promise.resolve(),
            resetNonAppleElectronicsDefaults: () => Promise.resolve(),
          }),
        };
      if (name.endsWith('/lib/quote-input')) return { formatQuoteInput, parseQuoteInput };
      if (name.endsWith('/lib/theme-preference'))
        return {
          applyThemePreference() {},
          normalizeThemePreference: (value: unknown) => value,
          THEME_CHANGE_EVENT: 'theme',
        };
      if (name.endsWith('/OfferTemplatesSettingsCard'))
        return { OfferTemplatesSettingsCard: 'OfferTemplatesSettingsCard' };
      if (name.endsWith('/UsersAccessSettingsCard'))
        return { UsersAccessSettingsCard: 'UsersAccessSettingsCard' };
      throw new Error(`Unexpected dependency: ${name}`);
    },
  });

  const render = () => {
    stateCursor = 0;
    effectCursor = 0;
    return exports.SettingsPageContent!();
  };
  const find = (element: unknown, predicate: (node: Element) => boolean): Element | undefined => {
    if (!element || typeof element !== 'object' || !('props' in element)) return undefined;
    const node = element as Element;
    if (predicate(node)) return node;
    const children = node.props.children;
    return Array.isArray(children)
      ? children.map((child) => find(child, predicate)).find(Boolean)
      : find(children, predicate);
  };
  const usaInput = () => {
    const component = find(
      render(),
      (node) =>
        typeof node.type === 'function' &&
        node.type.name === 'UsdInput' &&
        node.props.label === 'Cotação USD/BRL',
    );
    assert.ok(component);
    const resolved = (component.type as (props: Props) => Element)(component.props);
    const input = find(resolved, (node) => node.type === 'input');
    assert.ok(input);
    return input;
  };

  render(); // hydration effect loads 520 into the draft
  assert.equal(usaInput().props.value, '520');
  for (const draft of ['5', '5,', '5,3', '5,35']) {
    (usaInput().props.onChange as (event: { target: { value: string } }) => void)({
      target: { value: draft },
    });
    assert.equal(usaInput().props.value, draft);
  }
  const saveButton = find(
    render(),
    (node) => node.type === 'ActionButton' && node.props.children === 'Salvar Red Delaware',
  );
  assert.ok(saveButton);
  (saveButton.props.onClick as () => void)();
  assert.ok(saved);
  assert.equal(
    (saved as unknown as { usaImport: { usdBrlQuote: number } }).usaImport.usdBrlQuote,
    5.35,
  );
  render(); // confirmed settings hydration
  assert.equal(usaInput().props.value, '5,35');

  const offersTab = find(
    render(),
    (node) => node.type === 'button' && node.props.id === 'settings-tab-offers',
  );
  assert.ok(offersTab);
  (offersTab.props.onClick as () => void)();

  const offersView = render();
  assert.equal(
    find(
      offersView,
      (node) => node.type === 'SettingsCard' && node.props.title === 'Configurações de oferta',
    ),
    undefined,
  );
  assert.ok(find(offersView, (node) => node.type === 'OfferTemplatesSettingsCard'));
  assert.ok(
    find(
      offersView,
      (node) => node.type === 'SettingsCard' && node.props.title === 'Mensagem de parcelamento',
    ),
  );
});

function settings(quote: number) {
  return {
    general: {
      companyName: '',
      tradeName: '',
      cnpj: '',
      email: '',
      mainWhatsapp: '',
      city: '',
      state: '',
    },
    financial: {
      globalFixedCost: 0,
      defaultFreight: 0,
      defaultPaymentFee: 0,
      defaultMargin: 0,
      defaultDiscount: 0,
    },
    pricing: {
      offerIncrement: 0,
      commercialRoundingEnding1: 0,
      commercialRoundingEnding2: 0,
      nonAppleElectronicsPolicy: { version: '1.0.0', profitBands: [], fixedCostBands: [] },
    },
    importation: {
      dollarQuote: 5.2,
      cdeExitPerBox: 0,
      brazilDispatchPerBox: 0,
      correiosLabel: 0,
      invoiceTaxPercent: 0,
      redirectRules: [],
    },
    usaFinancial: {
      dollarQuote: 0,
      airFreight: 0,
      freightDiscountPercent: 0,
      administrativeFee: 0,
      customsBroker: 0,
      insurance: 0,
      label: 0,
      invoiceTaxPercent: 0,
      iof: 0,
      otherExpenses: 0,
    },
    usaImport: {
      usdBrlQuote: quote,
      redDelaware: { firstLbUsd: 1, additionalLbUsd: 1, shippingMode: 'EXPRESS' },
      reiDoImportado: {
        phoneShippingUsd: 0,
        otherProductsShippingUsdPerHalfKg: 0,
        insurancePercent: 0,
        usTaxPercent: 0,
        airFreightDiscountPercent: 0,
      },
    },
    offers: {
      defaultWarranty: '',
      defaultDeadline: '',
      defaultOfferText: '',
      defaultFooter: '',
      whatsappMessage: '',
    },
    installmentRates: {
      infinityPay: { debitRatePercent: 0, installments: [] },
      pagBank: { installments: [] },
      nubank: { installments: [] },
    },
    installmentMessageTemplate: '',
    userPreferences: { theme: 'system', language: 'pt-BR', currencyFormat: '', dateFormat: '' },
  };
}
