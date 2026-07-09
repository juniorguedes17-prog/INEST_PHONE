# Modulo Precificacao

O modulo Precificacao calcula precos dinamicamente, sem persistir o resultado final.

## Origem dos dados

- Produtos: catalogo mestre.
- Radar de Precos: menor cotacao valida por produto.
- Configuracoes: custo fixo, frete, taxa e lucro padrao.
- Google Sheets: arquitetura preparada por configuracoes `pricing.model_profit.{modelo}`.

## Formula

```text
preco_venda = custo_produto + custo_fixo + frete + taxa_pagamento + lucro_liquido_desejado
preco_oferta = preco_venda + incremento_configuravel
```

O incremento de oferta utiliza a configuracao `pricing.offer_increment` e assume R$ 100,00 quando
nao houver valor configurado.

## Endpoints

- `GET /pricing`
- `GET /pricing/:productId`
- `POST /pricing/recalculate`
- `PATCH /pricing/profits`
- `POST /pricing/generate-offer`

## Validacoes

Produtos sem cotacao valida, produtos inativos, fornecedores inativos e cotacoes marcadas como
ocultadas pelo Radar nao entram no catalogo de precificacao.

## Observacao

O schema Prisma possui a entidade `Pricing`, mas esta etapa nao grava precos calculados nela para
respeitar a regra de calculo dinamico.
