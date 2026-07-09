# Modulo Gerador de Ofertas

O Gerador de Ofertas monta mensagens comerciais usando dados oficiais de Produtos,
Precificacao e Configuracoes. O modulo nao recalcula precos.

## Templates

Templates iniciais:

- Produto Novo
- Produto Seminovo
- Importacao

Os templates sao persistidos em `CommercialTemplate` por upsert quando o modulo e utilizado.

## Variaveis

Variaveis suportadas:

- `{{produto}}`
- `{{modelo}}`
- `{{cor}}`
- `{{capacidade}}`
- `{{preco}}`
- `{{preco_oferta}}`
- `{{prazo}}`
- `{{garantia}}`

## Endpoints

- `GET /offers`
- `GET /offers/templates`
- `GET /offers/:id`
- `POST /offers/generate`
- `POST /offers/:id/duplicate`
- `POST /offers/:id/copy`
- `POST /offers/:id/share`
- `DELETE /offers/:id`

## WhatsApp

O compartilhamento gera `https://wa.me/?text=...` com a mensagem pronta. A API oficial do
WhatsApp Business fica preparada para etapa futura.

## Auditoria

Geracao, duplicacao, copia, compartilhamento e exclusao logica sao registrados em auditoria.
