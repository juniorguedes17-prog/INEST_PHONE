# Modulo Radar de Importacao

O Radar de Importacao pesquisa produtos internacionais por meio de providers desacoplados e
calcula o custo estimado com base nos Custos Operacionais de Importacao cadastrados em
Configuracoes.

## Providers

- `ImportProvider`: contrato para novos providers.
- `MockImportProvider`: provider ativo para simulacao.
- `ComprasParaguaiProvider`: estrutura preparada para integracao futura, atualmente delegando ao mock.

## Endpoints

- `GET /import-radar/search`
- `GET /import-radar/products/:id`
- `POST /import-radar/calculate`
- `GET /import-radar/history`
- `PATCH /import-radar/dollar-quote`

## Calculo

```text
total =
produto_convertido
+ saida_cde
+ redirecionamento
+ despacho_brasil
+ nota_fiscal
+ etiqueta_correios
```

Todas as variaveis sao consumidas de `settings.importation`.

## Identificacao de Tipo

A identificacao usa a tabela de redirecionamento configurada pelo administrador. O modulo nao
mantem regras fixas de redirecionamento em codigo.

## Historico

Pesquisas, selecoes e calculos sao registrados via Auditoria (`entity = import_radar`) para
permitir consumo futuro por Dashboard e BI sem alterar o schema nesta etapa.
