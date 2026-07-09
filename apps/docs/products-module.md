# Modulo Produtos

## Objetivo

O modulo Produtos implementa o catalogo mestre da iNest Phone.

Ele centraliza as informacoes de produtos, categorias, modelos, cores e capacidades para consumo futuro por Radar de Precos, Precificacao, Radar de Importacao, Ofertas, Dashboard e Financeiro.

## Backend

Modulo:

- `apps/api/src/modules/products`

Endpoints principais:

- `GET /api/v1/products`
- `GET /api/v1/products/references`
- `GET /api/v1/products/:id`
- `POST /api/v1/products`
- `PATCH /api/v1/products/:id`
- `DELETE /api/v1/products/:id`
- `PATCH /api/v1/products/:id/activate`
- `PATCH /api/v1/products/:id/deactivate`

Endpoints de catalogos auxiliares:

- `POST /api/v1/products/categories`
- `PATCH /api/v1/products/categories/:id`
- `POST /api/v1/products/models`
- `PATCH /api/v1/products/models/:id`
- `POST /api/v1/products/colors`
- `PATCH /api/v1/products/colors/:id`
- `POST /api/v1/products/storages`
- `PATCH /api/v1/products/storages/:id`

Todos os endpoints sao protegidos por JWT.

## Persistencia

Entidades utilizadas:

- `Product`
- `ProductCategory`
- `ProductModel`
- `ProductColor`
- `ProductStorage`
- `AuditLog`

Soft delete:

- `DELETE /products/:id` atualiza `deletedAt` e marca o produto como `INACTIVE`.

## Auditoria

O modulo registra:

- criacao;
- edicao;
- exclusao logica;
- ativacao;
- desativacao.

## Frontend

Feature:

- `apps/web/features/products`

Componentes reutilizados:

- `FilterSidebar`
- `ProductCard`
- `ListHeader`
- `PageHeader`
- `EmptyState`
- `LoadingState`
- `ErrorState`
- `ActionButton`
- `Modal`
- `StatusBadge`

## Observacao de Modelagem

O schema atual de `Product` nao possui campos fisicos para:

- nome livre;
- marca;
- SKU interno;
- codigo interno;
- ano;
- processador;
- tamanho da tela.

Por preservacao da arquitetura congelada, esses campos nao foram adicionados nesta etapa. O nome exibido e derivado de categoria, modelo, capacidade e cor.
