import { Card, StatusBadge } from '@/components/shared';
import { Customer } from '../types/customers';
export function CustomerCard({ customer }: { customer: Customer }) {
  return <Card className="grid gap-3 p-4 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto] sm:items-center">
    <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="truncate text-base font-black text-inest-text">{customer.name || 'Cliente sem nome'}</h3>{customer.origin ? <StatusBadge tone="blue">{customer.origin}</StatusBadge> : null}</div><p className="mt-1 truncate text-sm text-inest-muted">{customer.email || customer.phone || 'Contato nao informado'}</p></div>
    <div className="min-w-0 text-sm text-inest-muted"><p className="truncate font-bold text-inest-text">{[customer.city, customer.state].filter(Boolean).join(' / ') || 'Local nao informado'}</p><p className="mt-1">{customer.salesCount} vendas · {formatNumber(customer.productsSold)} produtos</p></div>
    <div className="sm:text-right"><strong className="block text-base font-black text-inest-text">{formatCurrency(customer.totalRevenue)}</strong><span className="text-xs text-inest-muted">Ultima venda: {formatDate(customer.lastSale)}</span></div>
  </Card>;
}
const formatNumber = (value: number) => new Intl.NumberFormat('pt-BR').format(value);
const formatCurrency = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
const formatDate = (value: string | null) => value ? new Intl.DateTimeFormat('pt-BR').format(new Date(value)) : 'Sem registro';
