export interface NavigationItem {
  label: string;
  href: string;
  icon: string;
  eyebrow?: string;
}

export const navigationItems: NavigationItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: 'D', eyebrow: 'Operacao comercial' },
  { label: 'Radar de Precos', href: '/price-radar', icon: 'R', eyebrow: 'Fornecedores' },
  { label: 'Radar de Importacao', href: '/import-radar', icon: 'I', eyebrow: 'Importacao' },
  { label: 'Precificacao', href: '/pricing', icon: '%', eyebrow: 'Catalogo' },
  { label: 'Ofertas', href: '/offers', icon: 'O', eyebrow: 'Comercial' },
  { label: 'Produtos', href: '/products', icon: 'P', eyebrow: 'Catalogo' },
  { label: 'Clientes', href: '/customers', icon: 'C', eyebrow: 'Relacionamento' },
  { label: 'Fornecedores', href: '/suppliers', icon: 'F', eyebrow: 'Cadastro' },
  { label: 'Financeiro', href: '/finance', icon: '$', eyebrow: 'Gestao' },
  { label: 'Dashboard BI', href: '/bi', icon: 'BI', eyebrow: 'Inteligencia' },
  { label: 'Integracoes', href: '/integrations', icon: 'IN', eyebrow: 'Arquitetura' },
  { label: 'Configuracoes', href: '/settings', icon: '*', eyebrow: 'Sistema' },
];

export function getNavigationItem(pathname: string) {
  const fallback = navigationItems[0] as NavigationItem;

  return (
    navigationItems.find(
      (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
    ) ?? fallback
  );
}
