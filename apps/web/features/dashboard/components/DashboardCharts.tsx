import { memo, ReactNode } from 'react';
import { Card } from '@/components/shared';
import { DashboardPoint } from '../types/dashboard';

interface ChartCardProps {
  title: string;
  description: string;
  children: ReactNode;
}

interface ChartProps {
  data: DashboardPoint[];
  title: string;
  valueFormatter?: (value: number) => string;
}

const CHART_COLORS = ['#5F7CFF', '#0EA371', '#7B2CFF', '#F59E0B', '#0E7490', '#DC5A5A', '#64748B'];
const WIDTH = 720;
const HEIGHT = 260;
const PLOT = { left: 56, right: 18, top: 18, bottom: 42 };

function ChartCard({ title, description, children }: ChartCardProps) {
  return (
    <Card className="min-w-0 p-4 sm:p-5">
      <div className="mb-4">
        <h3 className="text-card-title">{title}</h3>
        <p className="mt-1 text-sm text-inest-muted">{description}</p>
      </div>
      {children}
    </Card>
  );
}

function EmptyChart() {
  return (
    <div className="grid min-h-56 place-items-center rounded-lg border border-dashed border-inest-line bg-inest-soft/40 px-4 text-center text-sm font-semibold text-inest-muted">
      Sem dados sincronizados para este grafico.
    </div>
  );
}

function ChartGrid({ max, formatter }: { max: number; formatter: (value: number) => string }) {
  return Array.from({ length: 5 }, (_, index) => {
    const ratio = index / 4;
    const y = PLOT.top + ratio * (HEIGHT - PLOT.top - PLOT.bottom);
    const value = max * (1 - ratio);
    return (
      <g key={index}>
        <line x1={PLOT.left} x2={WIDTH - PLOT.right} y1={y} y2={y} stroke="#DCE3EF" />
        <text x={PLOT.left - 8} y={y + 4} textAnchor="end" fontSize="11" fill="#667085">
          {formatter(value)}
        </text>
      </g>
    );
  });
}

function AccessibleValues({
  data,
  formatter,
}: {
  data: DashboardPoint[];
  formatter: (value: number) => string;
}) {
  return (
    <ul className="sr-only">
      {data.map((point) => (
        <li key={point.label}>
          {formatMonth(point.label)}: {formatter(point.value)}
        </li>
      ))}
    </ul>
  );
}

export const MonthlyBarChart = memo(function MonthlyBarChart({
  data,
  title,
  valueFormatter = formatNumber,
}: ChartProps) {
  if (!data.length) return <EmptyChart />;
  const max = Math.max(...data.map((point) => point.value), 1);
  const plotWidth = WIDTH - PLOT.left - PLOT.right;
  const plotHeight = HEIGHT - PLOT.top - PLOT.bottom;
  const slot = plotWidth / data.length;
  const barWidth = Math.max(4, Math.min(38, slot * 0.58));
  const labelStep = Math.max(1, Math.ceil(data.length / 8));

  return (
    <div className="min-w-0">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="h-auto w-full"
        role="img"
        aria-label={title}
      >
        <title>{title}</title>
        <ChartGrid max={max} formatter={compactNumber} />
        {data.map((point, index) => {
          const height = (point.value / max) * plotHeight;
          const x = PLOT.left + slot * index + (slot - barWidth) / 2;
          const y = PLOT.top + plotHeight - height;
          return (
            <g key={point.label}>
              <rect x={x} y={y} width={barWidth} height={height} rx="4" fill="#5F7CFF">
                <title>
                  {formatMonth(point.label)}: {valueFormatter(point.value)}
                </title>
              </rect>
              {index % labelStep === 0 || index === data.length - 1 ? (
                <text
                  x={x + barWidth / 2}
                  y={HEIGHT - 17}
                  textAnchor="middle"
                  fontSize="11"
                  fill="#667085"
                >
                  {formatMonth(point.label)}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
      <AccessibleValues data={data} formatter={valueFormatter} />
    </div>
  );
});

export const MonthlyLineChart = memo(function MonthlyLineChart({
  data,
  title,
  valueFormatter = formatCurrency,
}: ChartProps) {
  if (!data.length) return <EmptyChart />;
  const max = Math.max(...data.map((point) => point.value), 1);
  const plotWidth = WIDTH - PLOT.left - PLOT.right;
  const plotHeight = HEIGHT - PLOT.top - PLOT.bottom;
  const x = (index: number) =>
    PLOT.left + (data.length === 1 ? plotWidth / 2 : (index / (data.length - 1)) * plotWidth);
  const y = (value: number) => PLOT.top + plotHeight - (value / max) * plotHeight;
  const points = data.map((point, index) => `${x(index)},${y(point.value)}`).join(' ');
  const labelStep = Math.max(1, Math.ceil(data.length / 8));

  return (
    <div className="min-w-0">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="h-auto w-full"
        role="img"
        aria-label={title}
      >
        <title>{title}</title>
        <ChartGrid max={max} formatter={compactCurrency} />
        <polyline
          points={points}
          fill="none"
          stroke="#0EA371"
          strokeWidth="4"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {data.map((point, index) => (
          <g key={point.label}>
            <circle
              cx={x(index)}
              cy={y(point.value)}
              r="5"
              fill="#FFFFFF"
              stroke="#0EA371"
              strokeWidth="3"
            >
              <title>
                {formatMonth(point.label)}: {valueFormatter(point.value)}
              </title>
            </circle>
            {index % labelStep === 0 || index === data.length - 1 ? (
              <text x={x(index)} y={HEIGHT - 17} textAnchor="middle" fontSize="11" fill="#667085">
                {formatMonth(point.label)}
              </text>
            ) : null}
          </g>
        ))}
      </svg>
      <AccessibleValues data={data} formatter={valueFormatter} />
    </div>
  );
});

export const CityBarChart = memo(function CityBarChart({ data }: { data: DashboardPoint[] }) {
  if (!data.length) return <EmptyChart />;
  const max = Math.max(...data.map((point) => point.value), 1);
  return (
    <div className="grid gap-3" role="img" aria-label="Valor vendido por cidade">
      {data.map((point) => (
        <div
          key={point.label}
          className="grid grid-cols-[minmax(0,7rem)_1fr] items-center gap-3 sm:grid-cols-[minmax(0,9rem)_1fr]"
        >
          <span className="truncate text-xs font-bold text-inest-muted" title={point.label}>
            {point.label}
          </span>
          <div className="min-w-0">
            <div className="h-2.5 overflow-hidden rounded-full bg-inest-soft">
              <div
                className="h-full rounded-full bg-inest-purple"
                style={{ width: `${Math.max(2, (point.value / max) * 100)}%` }}
              />
            </div>
            <span className="mt-1 block text-right text-xs font-black text-inest-text">
              {formatCurrency(point.value)}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
});

export const OriginDonutChart = memo(function OriginDonutChart({
  data,
}: {
  data: DashboardPoint[];
}) {
  if (!data.length) return <EmptyChart />;
  const total = data.reduce((sum, point) => sum + point.value, 0);
  const radius = 58;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className="grid items-center gap-5 sm:grid-cols-[12rem_1fr]">
      <svg
        viewBox="0 0 180 180"
        className="mx-auto h-44 w-44"
        role="img"
        aria-label="Origem dos clientes"
      >
        <title>Origem dos clientes</title>
        <circle cx="90" cy="90" r={radius} fill="none" stroke="#EDF1F7" strokeWidth="28" />
        {data.map((point, index) => {
          const length = total ? (point.value / total) * circumference : 0;
          const segment = (
            <circle
              key={point.label}
              cx="90"
              cy="90"
              r={radius}
              fill="none"
              stroke={CHART_COLORS[index % CHART_COLORS.length]}
              strokeWidth="28"
              strokeDasharray={`${length} ${circumference - length}`}
              strokeDashoffset={-offset}
              transform="rotate(-90 90 90)"
            >
              <title>
                {point.label}: {formatNumber(point.value)}
              </title>
            </circle>
          );
          offset += length;
          return segment;
        })}
        <text x="90" y="86" textAnchor="middle" fontSize="26" fontWeight="900" fill="#101828">
          {formatNumber(total)}
        </text>
        <text x="90" y="106" textAnchor="middle" fontSize="11" fontWeight="700" fill="#667085">
          clientes
        </text>
      </svg>
      <div className="grid gap-2">
        {data.map((point, index) => (
          <div
            key={point.label}
            className="flex min-w-0 items-center justify-between gap-3 text-xs"
          >
            <span className="flex min-w-0 items-center gap-2 font-bold text-inest-muted">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
              />
              <span className="truncate" title={point.label}>
                {point.label}
              </span>
            </span>
            <strong className="shrink-0 text-inest-text">{formatNumber(point.value)}</strong>
          </div>
        ))}
      </div>
    </div>
  );
});

export function DashboardChartCard(props: ChartCardProps) {
  return <ChartCard {...props} />;
}

const formatNumber = (value: number) =>
  new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(value);
const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
const compactNumber = (value: number) =>
  new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
const compactCurrency = (value: number) => `R$ ${compactNumber(value)}`;
const formatMonth = (value: string) => {
  const [year, month] = value.split('-').map(Number);
  if (!year || !month) return value;
  return new Intl.DateTimeFormat('pt-BR', { month: 'short', year: '2-digit' })
    .format(new Date(Date.UTC(year, month - 1, 1)))
    .replace('.', '');
};
