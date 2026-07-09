# Radar de Importacao

## Objetivo

O Radar de Importacao permite pesquisar produtos de importacao, converter o preco em dolar para real e calcular o custo estimado total com base nas configuracoes financeiras de importacao.

Nesta fase, a busca no Compras Paraguai utiliza dados mockados e arquitetura preparada para futura integracao por API ou scraping, sem alterar os modulos existentes de Radar de Precos, Precificacao ou Ofertas.

## Configuracao Financeira de Importacao

A configuracao financeira de importacao fica disponivel na area de Configuracoes e possui os seguintes campos editaveis:

| Campo                                     | Valor padrao |
| ----------------------------------------- | -----------: |
| Cotacao do dolar                          |         5.35 |
| Saida de CDE por caixa                    |    R$ 110,00 |
| Despacho no Brasil via Correios por caixa |     R$ 50,00 |
| Nota Fiscal                               |           3% |
| Etiqueta Correios                         |    R$ 120,00 |

Tambem existe uma tabela editavel de redirecionamento por tipo de produto:

| Tipo de produto                               |     Custo |
| --------------------------------------------- | --------: |
| Perfume                                       |  R$ 25,00 |
| iPhone 15 ao 17 Pro Max                       | R$ 100,00 |
| iPhone 14 Pro Max e abaixo / outros celulares |  R$ 60,00 |
| MacBook / Notebook                            | R$ 200,00 |
| iPad                                          | R$ 100,00 |
| Apple Watch / Garmin                          |  R$ 60,00 |
| Outros Smart Watches                          |  R$ 30,00 |

## Formula de Calculo

O calculo oficial da funcionalidade e:

```text
Custo Final =
Preco do Produto em Real
+ Saida de CDE
+ Redirecionamento por Tipo
+ Despacho no Brasil
+ Nota Fiscal
+ Etiqueta Correios
```

A conversao do produto utiliza:

```text
Preco em Real = Preco em Dolar x Cotacao do Dolar
```

A nota fiscal utiliza:

```text
Nota Fiscal = Preco do Produto em Real x Percentual de Nota Fiscal
```

## Identificacao Automatica do Tipo

O sistema identifica automaticamente o tipo do produto pelo nome, usando os termos configurados em cada regra de redirecionamento.

Quando nenhum tipo e identificado, a interface permite selecao manual do tipo de produto antes do calculo final.

## Modelos de Dados

A funcionalidade adiciona as seguintes entidades ao Prisma:

| Model                          | Finalidade                                                         |
| ------------------------------ | ------------------------------------------------------------------ |
| `ImportFinancialConfiguration` | Armazena os parametros financeiros globais de importacao.          |
| `ImportRedirectRule`           | Armazena regras editaveis de redirecionamento por tipo de produto. |
| `ImportSearchHistory`          | Prepara o historico de buscas feitas na origem Compras Paraguai.   |
| `ImportCalculation`            | Armazena calculos de importacao e o detalhamento de custos.        |

## Contratos de API Preparados

Quando o backend NestJS for implementado, os endpoints recomendados para esta funcionalidade sao:

| Metodo  | Endpoint                               | Objetivo                                                        |
| ------- | -------------------------------------- | --------------------------------------------------------------- |
| `GET`   | `/api/v1/import-radar/configuration`   | Consultar configuracao financeira e regras de redirecionamento. |
| `PATCH` | `/api/v1/import-radar/configuration`   | Atualizar configuracao financeira e regras editaveis.           |
| `GET`   | `/api/v1/import-radar/products?query=` | Buscar produtos na origem mockada ou futura integracao.         |
| `POST`  | `/api/v1/import-radar/calculate`       | Calcular custo final e retornar breakdown.                      |
| `GET`   | `/api/v1/import-radar/search-history`  | Consultar historico de buscas.                                  |

## Integracao Futura

A integracao real com `https://www.comprasparaguai.com.br` devera substituir o provider mockado sem alterar a interface da pagina.

A recomendacao arquitetural e manter um contrato unico de busca, permitindo trocar a origem dos dados por API oficial, scraping controlado ou fornecedor externo sem impactar o frontend.

## Validacoes

A funcionalidade deve manter:

- valores monetarios com precisao decimal;
- configuracoes editaveis e persistidas;
- calculo com breakdown claro;
- estado vazio quando nao houver resultados;
- estado de loading durante buscas;
- fallback manual quando o tipo de produto nao for identificado;
- ausencia de dados sensiveis reais no seed.
