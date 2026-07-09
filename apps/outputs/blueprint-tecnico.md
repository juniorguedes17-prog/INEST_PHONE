# Blueprint Tecnico - Preparacao da Fase 3

## Objetivo

Este documento prepara a execucao tecnica da Fase 3 sem duplicar regras de produto, regras de negocio ou decisoes arquiteturais oficiais.

Fontes oficiais:

- PRD: [prd-consolidado.md](./prd-consolidado.md)
- BRD: [brd-consolidado.md](./brd-consolidado.md)
- SAD: [sad-consolidado.md](./sad-consolidado.md)
- ERD inicial: [erd.md](./erd.md)

## Responsabilidade deste documento

O blueprint tecnico deve orientar estrutura de pastas, contratos, testes e estrategia incremental a partir do SAD.

Ele nao deve conter formulas de calculo, templates comerciais, politicas comerciais, regras de aprovacao ou decisoes arquiteturais oficiais. Regras de negocio pertencem ao BRD. Decisoes tecnicas estruturais pertencem ao SAD.

## Arquitetura sugerida

- Frontend: Next.js, React, TypeScript, Tailwind CSS, shadcn/ui, React Query, React Hook Form e Zod.
- Backend: NestJS, TypeScript, Prisma ORM, JWT, Swagger e testes automatizados.
- Banco: PostgreSQL.
- Infra: Docker para ambiente local, GitHub para versionamento, Vercel para frontend e Railway para backend/banco.

## Principios de arquitetura

- Arquitetura modular.
- Baixo acoplamento entre modulos.
- Alta coesao por dominio.
- Regras de negocio centralizadas em servicos de dominio.
- Contratos de dados compartilhados.
- DTOs validados.
- Repositories para acesso a dados.
- Testes automatizados nas regras criticas definidas no BRD.

## Estrutura recomendada

```txt
apps/
  web/
    src/app
    src/components
    src/features
    src/lib
    src/styles
  api/
    src/modules
    src/common
    src/config
    src/database
packages/
  contracts/
  ui/
  config/
docs/
  prd-consolidado.md
  brd-consolidado.md
  erd.md
  architecture.md
  api.md
  deploy.md
```

## Modulos do MVP 1

- AuthModule
- DashboardModule
- PriceRadarModule
- ImportModule
- SupplierModule
- ProductModule
- PricingModule
- OfferModule
- FinancialConfigurationModule
- AuditModule

## Modulos do MVP 2

- GoogleSheetsIntegrationModule
- WhatsAppBusinessIntegrationModule
- CrmModule
- InventoryModule
- FinanceModule
- AdvancedDashboardModule
- BusinessIntelligenceModule
- AutomationModule
- ExternalIntegrationsModule

## Contratos e nomenclatura

Os campos financeiros devem seguir exatamente a nomenclatura definida no BRD:

- `custo_produto`
- `custo_fixo`
- `frete`
- `taxa_pagamento`
- `outros_custos`
- `lucro_liquido_desejado`
- `desconto`
- `preco_venda`
- `preco_oferta`

Qualquer DTO, entidade, formulario, evento ou resposta de API deve usar estes nomes.

## APIs iniciais do MVP 1

- `POST /auth/login`
- `POST /auth/refresh`
- `GET /dashboard/summary`
- `POST /imports/csv`
- `POST /imports/excel`
- `GET /imports/:id`
- `GET /prices`
- `GET /prices/radar-summary`
- `GET /suppliers`
- `POST /suppliers`
- `GET /products`
- `POST /products`
- `POST /pricing/simulations`
- `GET /financial-config`
- `PATCH /financial-config`
- `GET /offers/templates`
- `POST /offers/generate`

## Preparacao para testes

Os testes do MVP 1 devem cobrir:

- Autenticacao.
- Importacao CSV e Excel.
- Normalizacao de dados.
- Validacao de qualidade.
- Fluxo oficial de precificacao definido no BRD.
- Regra oficial de arredondamento definida no BRD.
- Geracao de oferta a partir de template.
- Auditoria de operacoes criticas.

## Roadmap incremental

1. Estruturar monorepo e ambiente local.
2. Implementar autenticacao e base visual.
3. Implementar importacao CSV e Excel.
4. Implementar fornecedores e produtos.
5. Implementar radar de precos.
6. Implementar configuracoes financeiras.
7. Implementar precificacao com servicos de dominio.
8. Implementar gerador de ofertas com templates persistidos.
9. Implementar auditoria e historico.
10. Preparar MVP 2 com integracoes e modulos avancados.
