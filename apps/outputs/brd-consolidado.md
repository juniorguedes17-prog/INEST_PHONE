# BRD Consolidado - iNest Phone

## 1. Objetivo

Este documento centraliza as regras de negocio da iNest Phone. Todos os modulos devem consultar estas regras e nenhuma funcionalidade pode criar logica equivalente com comportamento diferente.

O BRD nao repete visao de produto, arquitetura funcional, tecnologias, experiencia de usuario ou criterios gerais de qualidade. Esses temas pertencem ao PRD.

## 2. Nomenclatura financeira oficial

Todos os modulos devem utilizar exatamente estes nomes de campos:

- `custo_produto`
- `custo_fixo`
- `frete`
- `taxa_pagamento`
- `outros_custos`
- `lucro_liquido_desejado`
- `desconto`
- `preco_venda`
- `preco_oferta`

E proibido criar campos equivalentes com nomes diferentes.

## 3. Formula oficial de precificacao

A unica formula oficial do sistema e:

```txt
preco_venda =
  custo_produto
  + custo_fixo
  + frete
  + taxa_pagamento
  + outros_custos
  + lucro_liquido_desejado
  - desconto
```

Nenhuma outra formula de preco de venda pode existir.

## 4. Regra oficial do preco de oferta

O preco de oferta deve ser calculado exclusivamente assim:

```txt
preco_oferta = preco_venda + 100
```

O sistema jamais pode utilizar custo, margem, markup ou qualquer outro valor como base para `preco_oferta`.

## 5. Regra oficial de arredondamento

Depois de calcular `preco_venda`, o sistema deve aplicar a regra de arredondamento.

Depois de calcular `preco_oferta`, o sistema deve aplicar a mesma regra.

A regra deve existir em uma unica funcao reutilizavel por todo o sistema.

```txt
Se os dois ultimos digitos estiverem entre 00 e 50:
  arredondar para final 49.

Se os dois ultimos digitos estiverem entre 51 e 99:
  arredondar para final 90.
```

Exemplos:

- R$ 5.421 -> R$ 5.449
- R$ 5.448 -> R$ 5.449
- R$ 5.450 -> R$ 5.449
- R$ 5.451 -> R$ 5.490
- R$ 5.472 -> R$ 5.490
- R$ 5.499 -> R$ 5.490

## 6. Fluxo oficial de precificacao

Todo produto deve seguir obrigatoriamente esta sequencia:

1. Importar custo.
2. Normalizar dados do produto.
3. Validar qualidade.
4. Aplicar regras de exclusao.
5. Calcular `preco_venda`.
6. Aplicar arredondamento de `preco_venda`.
7. Calcular `preco_oferta`.
8. Aplicar arredondamento de `preco_oferta`.
9. Gerar a mensagem comercial.
10. Registrar historico da operacao.

Nenhuma etapa pode ser executada fora dessa ordem.

## 7. Tipos de produto

O sistema trabalha inicialmente com:

- iPhone Lacrado
- iPhone Seminovo
- Apple Certified Pre-Owned
- MacBook
- iPad
- Apple Watch
- AirPods

Cada tipo pode possuir politicas comerciais especificas, desde que respeite a nomenclatura, formula, arredondamento e fluxo oficial.

## 8. Origem do custo

O `custo_produto` pode ser alimentado por:

- CSV
- Excel
- Google Sheets
- WhatsApp Business
- API futura

Cada registro importado deve armazenar fornecedor, modelo, capacidade, cor, `custo_produto`, prazo, cidade, data da cotacao, contato e observacoes.

## 9. Configuracoes financeiras

A configuracao financeira deve permitir parametrizar:

- `custo_fixo`
- `frete`
- `taxa_pagamento`
- `outros_custos`
- `lucro_liquido_desejado`
- `desconto`

As configuracoes podem existir por regra global, produto, categoria ou periodo, conforme necessidade operacional.

## 10. Lucro por produto

Cada modelo pode possuir um `lucro_liquido_desejado` diferente.

Exemplos operacionais:

- iPhone 15: R$ 450.
- iPhone 16 Pro Max: R$ 500.
- MacBook Air: R$ 800.
- Apple Watch: R$ 350.

O sistema deve buscar automaticamente o lucro configurado.

Caso nao exista configuracao especifica, utilizar o lucro padrao aplicavel.

## 11. Regras de desconto

O sistema deve permitir:

- Desconto global.
- Desconto por produto.
- Desconto por categoria.
- Desconto temporario.

O desconto entra exclusivamente no campo `desconto` da formula oficial.

O desconto jamais pode reduzir o lucro abaixo do minimo permitido, quando houver regra de minimo configurada.

## 12. Simulacao

A tela de precificacao deve permitir simular os campos configuraveis aplicaveis ao produto.

Campos que podem ser alterados na simulacao, quando autorizados:

- `lucro_liquido_desejado`
- `frete`
- `custo_fixo`
- `taxa_pagamento`
- `outros_custos`
- `desconto`

A simulacao deve exibir imediatamente:

- `preco_venda`
- `preco_oferta`
- lucro
- diferenca entre valores simulados e configurados
- margem apenas como indicador visual derivado, nunca como base de calculo

## 13. Radar de precos

O sistema deve organizar automaticamente todos os fornecedores.

Para cada modelo, o radar deve mostrar:

- Menor preco.
- Maior preco.
- Preco medio.
- Quantidade de fornecedores.
- Historico.
- Variacao.

O Radar de Precos jamais calcula `preco_venda` ou `preco_oferta`.

## 14. Regras de exclusao

Antes de qualquer calculo, o sistema deve eliminar automaticamente produtos com qualquer uma das condicoes:

- Grade B
- Grade C
- Grade D
- Tela nao genuina
- Bateria nao genuina
- Pecas substituidas
- Face ID com defeito
- True Tone ausente
- Mensagem de hardware
- Mensagem de tela
- Mensagem de bateria
- Defeitos estruturais
- Qualquer observacao critica informada pelo fornecedor

Produtos reprovados nao podem ser utilizados na precificacao nem na geracao de ofertas.

## 15. Criterios de aprovacao

Um aparelho so pode ser considerado apto quando atender simultaneamente:

- Grade A+ ou superior.
- Saude da bateria informada.
- Ausencia de alertas internos.
- Ausencia de pecas substituidas.
- Ausencia de defeitos estruturais.
- Ausencia de observacoes criticas.

Caso qualquer criterio nao seja atendido, o produto deve ser classificado como `Pendente de Revisao` ou `Rejeitado`, conforme politica definida.

## 16. Saude da bateria

Para seminovos, e obrigatorio registrar:

- Percentual.
- Data.
- Observacoes.

A saude da bateria deve aparecer nos relatorios internos.

A exibicao ao cliente depende da configuracao do template.

## 17. Prazo de entrega

Cada fornecedor pode possuir prazo diferente.

Exemplos:

- 1-2 dias uteis.
- 3-5 dias uteis.
- 7-10 dias uteis.
- 15 dias uteis.

O prazo deve ser importado junto com o `custo_produto`.

## 18. Controle de estoque

Cada aparelho deve possuir:

- IMEI.
- Fornecedor.
- Origem.
- Status.

Status previstos:

- Reservado.
- Disponivel.
- Vendido.
- Cancelado.

## 19. Regras de importacao

Ao importar listas de fornecedores, o sistema deve:

- Identificar automaticamente o fornecedor pela origem do arquivo.
- Reconhecer diferentes formatos de planilhas e mensagens.
- Normalizar nomes de modelos, cores e capacidades.
- Eliminar registros duplicados.
- Validar campos obrigatorios.
- Sinalizar inconsistencias sem interromper toda a importacao.
- Manter historico de todas as importacoes.

## 20. Normalizacao de produtos

O sistema deve possuir uma tabela mestre editavel de normalizacao.

Exemplos:

- `16PM`, `iPhone16 Pro Max`, `IPH16PM` -> `iPhone 16 Pro Max`
- `Nat`, `Natural Titanium`, `Titanium Natural` -> `Natural`

## 21. Templates comerciais

Templates comerciais pertencem exclusivamente ao BRD e devem ser armazenados como dados configuraveis no sistema.

Os textos nao podem ficar codificados diretamente nas telas ou nos servicos.

Todos os templates devem usar variaveis dinamicas para permitir alteracoes sem modificar codigo-fonte.

Variaveis iniciais:

- `{{modelo}}`
- `{{cor}}`
- `{{capacidade}}`
- `{{preco}}`
- `{{prazo}}`
- `{{garantia}}`

### Template oficial - produtos lacrados

```txt
🏆 OFERTA DE LACRADO INEST 🏆

⏳ VÁLIDA POR 24 HORAS ⏳

Todos os produtos são importados, o que muda é apenas o prazo.

📦 Novo e Lacrado

🛡️ 1 ano de garantia Apple

✈️ Prazo de entrega: {{prazo}}

📱 {{modelo}}

{{cores}}

📥 Me chama no privado e garanta sua reserva.
```

### Template oficial - seminovos

```txt
🏆 OFERTA DE SEMINOVO ORIGINAL INEST 🏆

⏳ VÁLIDA POR 24 HORAS ⏳

Todos os produtos são importados, o que muda é apenas o prazo.

📦 Seminovo Original

🛡️ 6 meses de garantia pela loja

✈️ Prazo de entrega: {{prazo}}

📱 {{modelo}}

{{cores}}

📥 Me chama no privado e garanta sua reserva.
```

## 22. Geracao automatica de ofertas

A geracao automatica de ofertas so pode ocorrer apos o fluxo oficial de precificacao ser concluido.

Produtos `Pendente de Revisao` ou `Rejeitado` nao podem gerar ofertas automaticas.

Quando houver varios produtos:

- Agrupar automaticamente.
- Nao repetir cabecalho.
- Nao repetir rodape.
- Agrupar por modelo.
- Ordenar por categoria.

## 23. Politica de sigilo

E proibido exibir ao cliente:

- `custo_produto`
- FOB
- lucro
- markup
- margem interna
- `custo_fixo`
- frete interno
- `taxa_pagamento`
- `outros_custos`

Esses dados existem apenas para calculo interno.

## 24. Historico e auditoria

Toda alteracao deve registrar:

- Usuario.
- Data.
- Hora.
- Campo alterado.
- Valor anterior.
- Novo valor.

Tambem devem ser registrados login, logout, importacoes, exportacoes, alteracoes, exclusoes e erros.

## 25. Dashboard

Indicadores devem considerar somente vendas concluidas.

Jamais considerar:

- Cancelamentos.
- Reservas.
- Orcamentos.

## 26. Indicadores

Indicadores financeiros:

- Receita.
- Lucro.
- Margem.
- Ticket Medio.

Indicadores de produtos:

- Mais vendidos.
- Mais lucrativos.
- Maior giro.

Indicadores de clientes:

- Mais recorrentes.
- Maior ticket.
- Maior faturamento.

Indicadores de marketing:

- Origem.
- Meta Ads.
- Google Ads.
- Indicacao.
- Organico.

Indicadores geograficos:

- Cidade.
- Estado.
- Regiao.

## 27. Permissoes

- Administrador: acesso total.
- Gestor: financeiro, produtos e dashboard.
- Operador: radar, precificacao e ofertas, sem acesso a configuracoes.

## 28. Condicao para calculos e ofertas

O sistema so pode gerar calculos e ofertas quando:

- Todos os dados obrigatorios estiverem preenchidos.
- O produto atender aos criterios minimos de qualidade.
- `custo_produto` for valido.
- Prazo de entrega estiver definido.
- Houver regra de `lucro_liquido_desejado` configurada.

Caso contrario, o produto deve ser marcado como `Pendente de Revisao` e ficar indisponivel para ofertas automaticas.
