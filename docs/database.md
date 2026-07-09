# Banco de Dados - iNest Phone

Este documento descreve a configuracao e operacao inicial do banco de dados oficial da plataforma iNest Phone.

O banco utiliza:

- PostgreSQL;
- Prisma ORM;
- Prisma Client;
- migrations versionadas;
- seed inicial idempotente.

## 1. Arquivos principais

- `prisma/schema.prisma`: schema oficial do banco de dados.
- `prisma/seed.ts`: seed inicial seguro e idempotente.
- `.env.example`: exemplo das variaveis de ambiente.
- `package.json`: scripts de operacao do Prisma.

## 2. Configuracao do ambiente

Crie um arquivo `.env` na raiz do projeto com base no `.env.example`.

Exemplo:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/inest_phone?schema=public"
SEED_ADMIN_EMAIL="admin@inestphone.local"
SEED_ADMIN_PASSWORD="ChangeMe@12345"
```

Regras:

- nao versionar `.env`;
- nao usar senha real no `.env.example`;
- usar credenciais diferentes por ambiente;
- alterar a senha inicial do administrador apos o primeiro acesso.

## 3. Instalar dependencias

Execute:

```bash
npm install
```

## 4. Gerar Prisma Client

Execute:

```bash
npm run prisma:generate
```

Este comando gera o Prisma Client com base no `schema.prisma`.

## 5. Criar migration inicial

Com o PostgreSQL disponivel e `DATABASE_URL` configurada, execute:

```bash
npm run prisma:migrate -- --name init
```

O comando cria a migration inicial e aplica a estrutura no banco configurado.

## 6. Executar seed inicial

Execute:

```bash
npm run prisma:seed
```

O seed cria dados estruturais seguros:

- usuario administrador inicial;
- perfis de acesso;
- permissoes;
- vinculos entre perfis e permissoes;
- categorias de produtos;
- origens de venda;
- configuracao financeira global;
- templates oficiais de oferta;
- base inicial de pais e estado.

O seed e idempotente e pode ser executado mais de uma vez sem duplicar registros estruturais.

## 7. Abrir Prisma Studio

Execute:

```bash
npm run prisma:studio
```

O Prisma Studio permite visualizar e validar os dados do banco durante desenvolvimento e homologacao.

## 8. Principais entidades

As principais models implementadas sao:

- `User`;
- `Role`;
- `Permission`;
- `Customer`;
- `Supplier`;
- `Product`;
- `ProductModel`;
- `ProductCategory`;
- `ProductColor`;
- `ProductStorage`;
- `Inventory`;
- `InventoryMovement`;
- `Sale`;
- `SaleItem`;
- `Offer`;
- `PriceHistory`;
- `Pricing`;
- `FinancialConfiguration`;
- `SalesOrigin`;
- `City`;
- `State`;
- `Country`;
- `AuditLog`.

Tambem existem entidades de apoio:

- `RolePermission`;
- `OfferItem`;
- `CommercialTemplate`;
- `SystemConfiguration`;
- `Dashboard`;
- `DashboardCache`;
- `ImportBatch`.

## 9. Principais relacionamentos

- `User` pertence a `Role`.
- `Role` possui muitas `Permission` por meio de `RolePermission`.
- `Customer` pode estar associado a `City` e `SalesOrigin`.
- `Product` pertence a `ProductCategory`, `ProductModel`, `ProductColor` e `ProductStorage`.
- `Inventory` pertence a `Product` e pode estar associado a `Supplier`.
- `InventoryMovement` pertence a `Inventory`.
- `Sale` pode estar associada a `Customer`, `SalesOrigin` e `Offer`.
- `SaleItem` vincula `Sale`, `Product` e opcionalmente `Inventory`.
- `Offer` utiliza `CommercialTemplate` e pode utilizar uma `Pricing`.
- `PriceHistory` vincula `Supplier`, `Product` e opcionalmente `ImportBatch`.
- `Pricing` aplica a estrutura oficial de precificacao do BRD.
- `AuditLog` registra operacoes relevantes associadas opcionalmente a `User`.

## 10. Campos financeiros oficiais

O banco preserva a nomenclatura oficial definida no BRD:

- `custo_produto`;
- `custo_fixo`;
- `frete`;
- `taxa_pagamento`;
- `outros_custos`;
- `lucro_liquido_desejado`;
- `desconto`;
- `preco_venda`;
- `preco_oferta`.

As formulas e regras comerciais permanecem responsabilidade da camada de servicos da aplicacao.

## 11. Soft delete e auditoria

As entidades operacionais possuem `deleted_at` quando aplicavel.

Consultas da aplicacao devem filtrar registros excluidos logicamente, salvo fluxos administrativos autorizados.

Operacoes criticas devem registrar eventos em `AuditLog`.

## 12. Observacoes operacionais

- O schema usa UUID como chave primaria.
- Os nomes das models seguem o padrao Prisma em ingles.
- As tabelas fisicas usam `snake_case` por meio de `@@map`.
- Campos fisicos usam `snake_case` por meio de `@map`.
- Valores monetarios usam `Decimal` com `NUMERIC(12, 2)`.
- Regras de negocio nao devem ser implementadas diretamente no banco.
