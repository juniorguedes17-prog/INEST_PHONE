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
    name: 'Template Oficial - Produtos Lacrados',
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
    name: 'Template Oficial - Seminovos',
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
];

export const legacyTemplateNames = ['Produto Novo', 'Produto Seminovo', 'Importacao'];
