# Modulo Fornecedores

## Objetivo

O modulo Fornecedores centraliza o cadastro de fornecedores da iNest Phone.

Ele prepara a base para consumo futuro pelo Radar de Precos, Radar de Importacao, Precificacao, Compras, Dashboard e Auditoria.

## Backend

Modulo:

- `apps/api/src/modules/suppliers`

Endpoints:

- `GET /api/v1/suppliers`
- `GET /api/v1/suppliers/:id`
- `POST /api/v1/suppliers`
- `PATCH /api/v1/suppliers/:id`
- `DELETE /api/v1/suppliers/:id`
- `PATCH /api/v1/suppliers/:id/activate`
- `PATCH /api/v1/suppliers/:id/deactivate`

Todos os endpoints sao protegidos por JWT.

## Persistencia

Entidade utilizada:

- `Supplier`
- `AuditLog`

Soft delete:

- `DELETE /suppliers/:id` atualiza `deletedAt` e marca o fornecedor como `INACTIVE`.

## Auditoria

O modulo registra:

- criacao;
- edicao;
- exclusao logica;
- ativacao;
- desativacao.

## Frontend

Feature:

- `apps/web/features/suppliers`

Rotas:

- `/suppliers`
- `/suppliers/:id`

Componentes reutilizados:

- `FilterSidebar`
- `SettingsCard`
- `ListHeader`
- `PageHeader`
- `EmptyState`
- `LoadingState`
- `ErrorState`
- `Modal`
- `StatusBadge`
- `ActionButton`

## Preparacao para Integracoes

O endpoint de fornecedores retorna `whatsappLink` derivado do telefone quando possivel.

Tambem retorna `integrationReadiness`, indicando preparacao para:

- Radar de Precos;
- Radar de Importacao;
- WhatsApp Business;
- Compras Paraguai.

## Observacao de Modelagem

O schema atual de `Supplier` nao possui campos fisicos para:

- razao social;
- tipo separado de origem;
- pais;
- estado;
- cidade;
- WhatsApp separado do telefone;
- link direto do WhatsApp persistido;
- e-mail;
- site;
- forma de pagamento;
- prazo medio de entrega;
- observacoes internas.

Por preservacao da arquitetura congelada, esses campos nao foram adicionados nesta etapa. O campo `source` foi utilizado como origem/tipo do fornecedor, e o link do WhatsApp e derivado do telefone.
