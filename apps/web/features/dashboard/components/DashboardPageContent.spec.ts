import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

type Props = Record<string, unknown>;
type Element = { type: string | ((props: Props) => Element); props: Props };

const source = readFileSync(`${__dirname}/DashboardPageContent.tsx`, 'utf8');
const componentCode = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText;

test('Dashboard filters chart visibility locally and applies month/year without syncing', () => {
  const states: unknown[] = [];
  let stateCursor = 0;
  let filters = {
    startDate: '',
    endDate: '',
    category: '',
    productId: '',
    supplierId: '',
    userId: '',
  };
  let filterUpdates = 0;
  let syncCalls = 0;
  const exports: { DashboardPageContent?: () => Element } = {};
  const jsx = (type: Element['type'], props: Props) => ({ type, props });

  runInNewContext(componentCode, {
    exports,
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
          useMemo(factory: () => unknown) {
            return factory();
          },
        };
      }
      if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx, Fragment: 'fragment' };
      if (name === '@/components/shared')
        return Object.fromEntries(
          ['EmptyState', 'ErrorState', 'KpiCard', 'LoadingState', 'PageHeader', 'PageSection'].map(
            (key) => [key, key],
          ),
        );
      if (name.endsWith('/hooks/useDashboard')) {
        return {
          useDashboard: () => ({
            data: dashboardData,
            filters,
            setFilters: (next: typeof filters | ((current: typeof filters) => typeof filters)) => {
              filterUpdates += 1;
              filters = typeof next === 'function' ? next(filters) : next;
            },
            loading: false,
            syncing: false,
            error: null,
            sync: async () => {
              syncCalls += 1;
            },
          }),
        };
      }
      if (name.endsWith('/DashboardToolbar')) return { DashboardToolbar: 'DashboardToolbar' };
      if (name.endsWith('/DashboardCharts'))
        return {
          CityBarChart: 'CityBarChart',
          DashboardChartCard: 'DashboardChartCard',
          MonthlyBarChart: 'MonthlyBarChart',
          MonthlyLineChart: 'MonthlyLineChart',
          OriginDonutChart: 'OriginDonutChart',
        };
      throw new Error(`Unexpected dependency: ${name}`);
    },
  });

  const render = () => {
    stateCursor = 0;
    return exports.DashboardPageContent!();
  };
  const nodes = (tree: unknown) => {
    const result: Element[] = [];
    const collect = (value: unknown) => {
      if (!value || typeof value !== 'object' || !('props' in value)) return;
      const node = value as Element;
      result.push(node);
      const children = node.props.children;
      if (Array.isArray(children)) children.forEach(collect);
      else collect(children);
    };
    collect(tree);
    return result;
  };
  const chartCounts = () => {
    const rendered = nodes(render());
    return {
      units: rendered.filter((node) => node.type === 'MonthlyBarChart').length,
      revenueAndProfit: rendered.filter((node) => node.type === 'MonthlyLineChart').length,
      city: rendered.filter((node) => node.type === 'CityBarChart').length,
      origin: rendered.filter((node) => node.type === 'OriginDonutChart').length,
      cards: rendered.filter((node) => node.type === 'KpiCard').length,
    };
  };
  const select = (label: string) => {
    const node = nodes(render()).find(
      (candidate) => candidate.type === 'select' && candidate.props['aria-label'] === label,
    );
    assert.ok(node);
    return node;
  };

  assert.deepEqual(chartCounts(), { units: 1, revenueAndProfit: 2, city: 1, origin: 1, cards: 8 });

  for (const [value, expected] of [
    ['units', { units: 1, revenueAndProfit: 0, city: 0, origin: 0 }],
    ['revenue', { units: 0, revenueAndProfit: 1, city: 0, origin: 0 }],
    ['profit', { units: 0, revenueAndProfit: 1, city: 0, origin: 0 }],
    ['city', { units: 0, revenueAndProfit: 0, city: 1, origin: 0 }],
    ['origin', { units: 0, revenueAndProfit: 0, city: 0, origin: 1 }],
  ] as const) {
    (select('Tipo de gráfico').props.onChange as (event: { target: { value: string } }) => void)({
      target: { value },
    });
    assert.deepEqual(chartCounts(), { ...expected, cards: 8 });
  }
  assert.equal(filterUpdates, 0);
  assert.equal(syncCalls, 0);

  (select('Ano do período').props.onChange as (event: { target: { value: string } }) => void)({
    target: { value: '2026' },
  });
  (select('Mês do período').props.onChange as (event: { target: { value: string } }) => void)({
    target: { value: '02' },
  });
  assert.equal(filters.startDate, '2026-02-01');
  assert.equal(filters.endDate, '2026-02-28');
  assert.equal(filterUpdates, 1);
  assert.equal(syncCalls, 0);
  assert.equal(chartCounts().origin, 1);
});

const dashboardData = {
  sheet: {
    totalCustomers: 2,
    totalSales: 2,
    totalRevenue: 1000,
    totalProfit: 200,
    averageTicket: 500,
    productsSold: 2,
    lastSale: '2026-02-10T00:00:00.000Z',
    lastSync: '2026-02-10T12:00:00.000Z',
  },
  sheetCharts: {
    monthlyUnits: [{ label: '2026-02', value: 2 }],
    monthlyRevenue: [{ label: '2026-02', value: 1000 }],
    monthlyProfit: [{ label: '2026-02', value: 200 }],
    revenueByCity: [{ label: 'Campinas', value: 1000 }],
    customersByOrigin: [{ label: 'Instagram', value: 2 }],
  },
  sheetChartPeriods: ['2026-02', '2026-01'],
};
