import { FeatureKey, isFeatureEnabled } from '@/lib/features';

export type SidebarIconName =
  | 'dashboard'
  | 'radar'
  | 'import'
  | 'pricing'
  | 'offers'
  | 'products'
  | 'customers'
  | 'suppliers'
  | 'finance'
  | 'bi'
  | 'integrations'
  | 'settings';

export interface NavigationItem {
  label: string;
  href: string;
  icon: SidebarIconName;
  eyebrow?: string;
  feature?: FeatureKey;
}

export const navigationItems: NavigationItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: 'dashboard', eyebrow: 'Operação comercial' },
  { label: 'Radar de Preços', href: '/price-radar', icon: 'radar', eyebrow: 'Fornecedores' },
  {
    label: 'Radar de Importação',
    href: '/import-radar',
    icon: 'import',
    eyebrow: 'Importação',
    feature: 'importRadar',
  },
  { label: 'Precificação', href: '/pricing', icon: 'pricing', eyebrow: 'Catálogo' },
  { label: 'Ofertas', href: '/offers', icon: 'offers', eyebrow: 'Comercial' },
  { label: 'Produtos', href: '/products', icon: 'products', eyebrow: 'Catálogo' },
  { label: 'Clientes', href: '/customers', icon: 'customers', eyebrow: 'Relacionamento' },
  {
    label: 'Fornecedores',
    href: '/suppliers',
    icon: 'suppliers',
    eyebrow: 'Cadastro',
    feature: 'suppliers',
  },
  {
    label: 'Financeiro',
    href: '/finance',
    icon: 'finance',
    eyebrow: 'Gestão',
    feature: 'financial',
  },
  {
    label: 'Dashboard BI',
    href: '/bi',
    icon: 'bi',
    eyebrow: 'Inteligência',
    feature: 'dashboardBI',
  },
  {
    label: 'Integrações',
    href: '/integrations',
    icon: 'integrations',
    eyebrow: 'Arquitetura',
    feature: 'integrations',
  },
  { label: 'Configurações', href: '/settings', icon: 'settings', eyebrow: 'Sistema' },
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
