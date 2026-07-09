export const offerVariables = [
  'produto',
  'modelo',
  'cor',
  'capacidade',
  'preco',
  'preco_oferta',
  'prazo',
  'garantia',
];

export const officialTemplates = [
  {
    name: 'Produto Novo',
    productType: 'IPHONE_SEALED',
    content: `🏆 OFERTA DE LACRADO INEST 🏆

⏳ VÁLIDA POR 24 HORAS ⏳

Todos os produtos são importados, o que muda é apenas o prazo.

📦 Novo e Lacrado

🛡️ {{garantia}}

✈️ Prazo de entrega: {{prazo}}

📱 {{produto}}

{{cor}} {{capacidade}}

💰 {{preco_oferta}}

📥 Me chama no privado e garanta sua reserva.`,
  },
  {
    name: 'Produto Seminovo',
    productType: 'IPHONE_USED',
    content: `🏆 OFERTA DE SEMINOVO ORIGINAL INEST 🏆

⏳ VÁLIDA POR 24 HORAS ⏳

Todos os produtos são importados, o que muda é apenas o prazo.

📦 Seminovo Original

🛡️ {{garantia}}

✈️ Prazo de entrega: {{prazo}}

📱 {{produto}}

{{cor}} {{capacidade}}

💰 {{preco_oferta}}

📥 Me chama no privado e garanta sua reserva.`,
  },
  {
    name: 'Importacao',
    productType: 'ACCESSORY',
    content: `OFERTA DE IMPORTACAO INEST

Produto: {{produto}}
Prazo: {{prazo}}
Garantia: {{garantia}}
Valor: {{preco_oferta}}

Me chama no privado e garanta sua reserva.`,
  },
];
