# Frontend Design System — iNest Phone

## Objetivo

Este documento define o Design System oficial do frontend da plataforma iNest Phone.

A partir da Etapa 4, todos os módulos devem reutilizar o mesmo Layout Base, os mesmos componentes compartilhados e os mesmos tokens visuais.

Nenhum módulo de negócio deve criar layout próprio quando já existir componente compartilhado equivalente.

## Layout Base

A aplicação utiliza um shell principal composto por:

- Header;
- Sidebar;
- área de conteúdo;
- drawer lateral para navegação mobile.

Componente oficial:

- `components/layout/AppShell`

Comportamento:

- Desktop: sidebar fixa.
- Tablet: sidebar recolhível.
- Mobile: sidebar em drawer lateral.

## Navegação

A navegação oficial fica centralizada em:

- `components/layout/navigation.ts`

Rotas preparadas:

- `/dashboard`
- `/price-radar`
- `/import-radar`
- `/pricing`
- `/offers`
- `/products`
- `/customers`
- `/suppliers`
- `/finance`
- `/bi`
- `/settings`

## Componentes Compartilhados

Todos os componentes compartilhados ficam em:

- `components/shared`

Componentes criados:

- `ActionButton`
- `ConfirmationDialog`
- `CurrencyInput`
- `DataTable`
- `Drawer`
- `EmptyState`
- `ErrorState`
- `FilterSidebar`
- `InfoTag`
- `KpiCard`
- `ListHeader`
- `LoadingState`
- `Modal`
- `PageHeader`
- `PercentageInput`
- `ProductCard`
- `SearchInput`
- `SettingsCard`
- `StatusBadge`

## Tokens Visuais

As cores oficiais estão configuradas no Tailwind:

- `inest.blue`
- `inest.purple`
- `inest.green`
- `inest.bg`
- `inest.surface`
- `inest.soft`
- `inest.line`
- `inest.muted`
- `inest.text`
- `inest.dark`

Sombras:

- `shadow-panel`
- `shadow-soft`

Tipografia:

- `font-sans`: Inter, Montserrat, Arial.
- `font-display`: Montserrat, Inter, Arial.

## Temas

A estrutura de tema está preparada com CSS variables.

Tema ativo inicial:

- Light Theme.

Tema preparado:

- Dark Theme via `data-theme="dark"`.

## Estados Globais

Estados padronizados:

- Loading: `LoadingState`
- Empty: `EmptyState`
- Error: `ErrorState`
- Success: utilizar `StatusBadge` com `tone="green"` ou feedback contextual do módulo.

## Formulários

Diretrizes:

- Inputs devem possuir label ou `aria-label`.
- Campos monetários devem reutilizar `CurrencyInput`.
- Campos percentuais devem reutilizar `PercentageInput`.
- Busca deve reutilizar `SearchInput`.
- Botões devem reutilizar `ActionButton`.

## Cards e Listagens

Diretrizes:

- KPIs devem reutilizar `KpiCard`.
- Cards de configuração devem reutilizar `SettingsCard`.
- Cards de produto devem reutilizar `ProductCard`.
- Cabeçalhos de listas devem reutilizar `ListHeader`.
- Tabelas administrativas devem reutilizar `DataTable`.

## Responsividade

Padrões:

- Evitar largura fixa para conteúdo principal.
- Usar `min-w-0` em colunas flexíveis.
- Cards devem utilizar `width: 100%` e `max-width: 100%`.
- Sidebar de filtros deve usar scroll independente quando aplicável.
- Mobile deve priorizar coluna única e drawer lateral.

## Acessibilidade

Diretrizes:

- Todo botão iconográfico deve possuir `aria-label`.
- Foco visível é obrigatório.
- Navegação principal possui `aria-label`.
- Modais e drawers usam `role="dialog"` e `aria-modal`.
- Contraste deve seguir o padrão definido nos tokens do tema.

## Estrutura de Features

Cada feature deve seguir:

```text
features/
  nome-da-feature/
    components/
    hooks/
    services/
    types/
    utils/
```

Features preparadas:

- `auth`
- `dashboard`
- `products`
- `suppliers`
- `pricing`
- `price-radar`
- `import-radar`
- `offers`
- `settings`
- `customers`
- `finance`
- `bi`

## Convenção de Uso

Antes de criar um componente novo, verificar se já existe equivalente em `components/shared`.

Se o componente for reutilizável por mais de um módulo, ele deve ser criado em `components/shared`.

Se o componente for exclusivo de uma feature, ele deve ficar em `features/<feature>/components`.

Nenhum módulo deve duplicar visual de sidebar, header, cards, botões, inputs ou estados globais.
