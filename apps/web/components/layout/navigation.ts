import { FeatureKey, isFeatureEnabled } from '@/lib/features';

export interface NavigationItem {
  label: string;
  href: string;
  icon: string;
  eyebrow?: string;
  feature?: FeatureKey;
}

export const navigationItems: NavigationItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: 'D', eyebrow: 'Operacao comercial' },
  { label: 'Radar de Precos', href: '/price-radar', icon: 'R', eyebrow: 'Fornecedores' },
  {
    label: 'Radar de Importacao',
    href: '/import-radar',
    icon: 'I',
    eyebrow: 'Importacao',
    feature: 'importRadar',
  },
  { label: 'Precificacao', href: '/pricing', icon: '%', eyebrow: 'Catalogo' },
  { label: 'Ofertas', href: '/offers', icon: 'O', eyebrow: 'Comercial' },
  { label: 'Produtos', href: '/products', icon: 'P', eyebrow: 'Catalogo' },
  { label: 'Clientes', href: '/customers', icon: 'C', eyebrow: 'Relacionamento' },
  { label: 'Fornecedores', href: '/suppliers', icon: 'F', eyebrow: 'Cadastro', feature: 'suppliers' },
  { label: 'Financeiro', href: '/finance', icon: '$', eyebrow: 'Gestao', feature: 'financial' },
  { label: 'Dashboard BI', href: '/bi', icon: 'BI', eyebrow: 'Inteligencia', feature: 'dashboardBI' },
  { label: 'Integracoes', href: '/integrations', icon: 'IN', eyebrow: 'Arquitetura', feature: 'integrations' },
  { label: 'Configuracoes', href: '/settings', icon: '*', eyebrow: 'Sistema' },
];

export const visibleNavigationItems = navigationItems.filter((item) =>
  isFeatureEnabled(item.feature),
);

export function getNavigationItem(pathname: string) {
  const fallback = navigationItems[0] as NavigationItem;

  return (
    navigationItems.find(
      (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
    ) ?? fallback
  );
}
