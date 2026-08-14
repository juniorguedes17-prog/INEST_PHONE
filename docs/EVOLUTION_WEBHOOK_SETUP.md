# Evolution API - webhook seguro do Radar Brasil

## Endpoint

Depois do deploy da API iNest, configure a Evolution para enviar somente mensagens novas para:

`POST https://telefone-inest-api.onrender.com/api/v1/webhooks/evolution/<EVOLUTION_WEBHOOK_SECRET>`

O segredo deve ter pelo menos 32 caracteres aleatorios e nunca deve ser enviado ao repositorio.

## Variaveis da API iNest no Render

```env
EVOLUTION_WEBHOOK_ENABLED=true
EVOLUTION_WEBHOOK_SECRET=<segredo-aleatorio-com-32-ou-mais-caracteres>
EVOLUTION_API_URL=https://inest-evolution-api.onrender.com
EVOLUTION_API_KEY=<chave-da-evolution>
EVOLUTION_INSTANCE_NAME=inest-radar-brasil
```

## Variaveis da Evolution no Render

Configure somente apos a API iNest com o endpoint acima estar em producao:

```env
WEBHOOK_GLOBAL_ENABLED=true
WEBHOOK_GLOBAL_URL=https://telefone-inest-api.onrender.com/api/v1/webhooks/evolution/<EVOLUTION_WEBHOOK_SECRET>
WEBHOOK_EVENTS_MESSAGES_UPSERT=true
WEBHOOK_EVENTS_QRCODE_UPDATED=false
WEBHOOK_EVENTS_CONNECTION_UPDATE=false
```

Mantenha os demais eventos desativados. O endpoint aceita somente mensagens diretas (`@s.whatsapp.net`), ignora grupos, mensagens enviadas pela propria instancia e remetentes que nao estejam ativos em `supplier_contacts`.

## Comportamento de seguranca

- O segredo da URL e comparado em tempo constante.
- A mesma mensagem externa so e processada uma vez.
- Uma lista sem item e preco nao substitui a lista atual valida.
- A troca da lista atual e transacional: ou todos os itens novos entram, ou a lista anterior permanece.
- Apenas o conteudo da lista atual e mantido por fornecedor; recibos armazenam somente metadados tecnicos para idempotencia.

## Escopo inicial de formato

Esta primeira entrega processa texto da mensagem e captions. PDF textual, XLSX, imagem e PDF escaneado continuarao em estado controlado ate que seus processadores e o armazenamento de arquivos sejam ativados. Para manter anexos de forma duravel sera necessario configurar armazenamento de objetos antes dessa etapa.
