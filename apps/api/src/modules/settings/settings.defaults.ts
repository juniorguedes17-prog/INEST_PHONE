import { UpdateSettingsDto } from './dto/settings.dto';

export const SETTINGS_SCOPE = 'global';
export const FINANCIAL_CONFIGURATION_NAME = 'Configuracao Financeira Global';
export const IMPORT_CONFIGURATION_NAME = 'Configuracao Financeira de Importacao';

export const defaultSettings: Required<UpdateSettingsDto> = {
  general: {
    companyName: 'iNest Phone',
    tradeName: 'iNest Phone',
    cnpj: '00.000.000/0000-00',
    email: 'contato@inestphone.local',
    mainWhatsapp: '+55 11 99999-9999',
    city: 'Sao Paulo',
    state: 'SP',
  },
  financial: {
    globalFixedCost: 0,
    defaultFreight: 0,
    defaultPaymentFee: 0,
    defaultMargin: 0,
    defaultDiscount: 0,
  },
  importation: {
    dollarQuote: 5.35,
    cdeExitPerBox: 110,
    brazilDispatchPerBox: 50,
    correiosLabel: 120,
    invoiceTaxPercent: 3,
    redirectRules: [
      { productType: 'Perfume', matchTerms: ['perfume'], redirectCost: 25, priority: 10 },
      {
        productType: 'iPhone 15 ao 17 Pro Max',
        matchTerms: ['iphone 15', 'iphone 16', 'iphone 17', 'pro max'],
        redirectCost: 100,
        priority: 20,
      },
      {
        productType: 'iPhone 14 Pro Max e abaixo / outros celulares',
        matchTerms: ['iphone 14', 'iphone 13', 'iphone 12', 'celular'],
        redirectCost: 60,
        priority: 30,
      },
      {
        productType: 'MacBook / Notebook',
        matchTerms: ['macbook', 'notebook'],
        redirectCost: 200,
        priority: 40,
      },
      { productType: 'iPad', matchTerms: ['ipad'], redirectCost: 100, priority: 50 },
      {
        productType: 'Apple Watch / Garmin',
        matchTerms: ['apple watch', 'garmin'],
        redirectCost: 60,
        priority: 60,
      },
      {
        productType: 'Outros Smart Watches',
        matchTerms: ['smart watch'],
        redirectCost: 30,
        priority: 70,
      },
    ],
  },
  offers: {
    defaultWarranty: 'Garantia padrao iNest Phone',
    defaultDeadline: 'Prazo a confirmar',
    defaultOfferText: 'Oferta valida por 24 horas.',
    defaultFooter: 'Me chama no privado e garanta sua reserva.',
    whatsappMessage: 'Ola! Tenho interesse neste produto da iNest Phone.',
  },
  userPreferences: {
    theme: 'light',
    language: 'pt-BR',
    currencyFormat: 'BRL',
    dateFormat: 'dd/MM/yyyy',
  },
};
