import { hash } from 'bcryptjs';
import {
  GenericStatus,
  PrismaClient,
  ProductType,
  SalesOriginType,
  UserStatus,
} from '@prisma/client';
import { seedProfitProducts } from './profit-products.seed';

const prisma = new PrismaClient();

const modules = [
  'auth',
  'users',
  'dashboard',
  'price-radar',
  'import-radar',
  'pricing',
  'offers',
  'products',
  'suppliers',
  'customers',
  'inventory',
  'finance',
  'settings',
  'analytics',
  'audit',
];

const actions = ['view', 'create', 'edit', 'delete', 'import', 'export', 'approve', 'configure'];

function requiredEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Variavel de ambiente obrigatoria ausente: ${name}`);
  }

  return value;
}

function hashPassword(password: string) {
  return hash(password, 12);
}

async function seedRoles() {
  const roles = [
    {
      name: 'Administrador',
      description: 'Acesso total ao sistema.',
    },
    {
      name: 'Gestor',
      description: 'Acesso gerencial aos modulos comerciais, financeiros e indicadores.',
    },
    {
      name: 'Operador',
      description: 'Acesso operacional ao radar de precos, precificacao e ofertas.',
    },
  ];

  for (const role of roles) {
    await prisma.role.upsert({
      where: { name: role.name },
      update: {
        description: role.description,
        status: GenericStatus.ACTIVE,
      },
      create: {
        ...role,
        status: GenericStatus.ACTIVE,
      },
    });
  }
}

async function seedPermissions() {
  for (const module of modules) {
    for (const action of actions) {
      await prisma.permission.upsert({
        where: {
          module_action: {
            module,
            action,
          },
        },
        update: {},
        create: {
          module,
          action,
        },
      });
    }
  }
}

async function seedRolePermissions() {
  const admin = await prisma.role.findUniqueOrThrow({ where: { name: 'Administrador' } });
  const manager = await prisma.role.findUniqueOrThrow({ where: { name: 'Gestor' } });
  const operator = await prisma.role.findUniqueOrThrow({ where: { name: 'Operador' } });

  const permissions = await prisma.permission.findMany();

  const managerModules = new Set([
    'dashboard',
    'price-radar',
    'pricing',
    'offers',
    'products',
    'suppliers',
    'customers',
    'inventory',
    'finance',
    'analytics',
    'audit',
  ]);

  const operatorModules = new Set(['price-radar', 'pricing', 'offers', 'products', 'suppliers']);
  const operatorActions = new Set(['view', 'create', 'edit', 'import', 'export']);

  for (const permission of permissions) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: admin.id,
          permissionId: permission.id,
        },
      },
      update: {},
      create: {
        roleId: admin.id,
        permissionId: permission.id,
      },
    });

    if (managerModules.has(permission.module) && permission.action !== 'configure') {
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: manager.id,
            permissionId: permission.id,
          },
        },
        update: {},
        create: {
          roleId: manager.id,
          permissionId: permission.id,
        },
      });
    }

    if (operatorModules.has(permission.module) && operatorActions.has(permission.action)) {
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: operator.id,
            permissionId: permission.id,
          },
        },
        update: {},
        create: {
          roleId: operator.id,
          permissionId: permission.id,
        },
      });
    }
  }
}

async function seedAdminUser() {
  const adminRole = await prisma.role.findUniqueOrThrow({ where: { name: 'Administrador' } });
  const adminEmail = requiredEnv('SEED_ADMIN_EMAIL').trim().toLowerCase();
  const adminPassword = requiredEnv('SEED_ADMIN_PASSWORD');
  const passwordHash = await hashPassword(adminPassword);

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      roleId: adminRole.id,
      passwordHash,
      status: UserStatus.ACTIVE,
      deletedAt: null,
    },
    create: {
      roleId: adminRole.id,
      name: 'Administrador iNest Phone',
      email: adminEmail,
      passwordHash,
      status: UserStatus.ACTIVE,
    },
  });
}

async function seedProductCategories() {
  const categories = [
    ['iPhone Lacrado', 'iphone-lacrado', ProductType.IPHONE_SEALED],
    ['iPhone Seminovo', 'iphone-seminovo', ProductType.IPHONE_USED],
    ['Apple Certified Pre-Owned', 'apple-certified-pre-owned', ProductType.APPLE_CPO],
    ['MacBook', 'macbook', ProductType.MACBOOK],
    ['iPad', 'ipad', ProductType.IPAD],
    ['Apple Watch', 'apple-watch', ProductType.APPLE_WATCH],
    ['AirPods', 'airpods', ProductType.AIRPODS],
    ['Acessorios', 'acessorios', ProductType.ACCESSORY],
  ] as const;

  for (const [name, slug, type] of categories) {
    await prisma.productCategory.upsert({
      where: { name },
      update: {
        slug,
        type,
        status: GenericStatus.ACTIVE,
      },
      create: {
        name,
        slug,
        type,
        status: GenericStatus.ACTIVE,
      },
    });
  }
}

async function seedProductCatalog() {
  const categories = await prisma.productCategory.findMany();
  const categoryBySlug = new Map(categories.map((category) => [category.slug, category]));

  const models = [
    ['iphone-lacrado', 'iPhone 13', 'iphone-13', ProductType.IPHONE_SEALED],
    ['iphone-lacrado', 'iPhone 13 Pro', 'iphone-13-pro', ProductType.IPHONE_SEALED],
    ['iphone-lacrado', 'iPhone 13 Pro Max', 'iphone-13-pro-max', ProductType.IPHONE_SEALED],
    ['iphone-lacrado', 'iPhone 14', 'iphone-14', ProductType.IPHONE_SEALED],
    ['iphone-lacrado', 'iPhone 14 Pro', 'iphone-14-pro', ProductType.IPHONE_SEALED],
    ['iphone-lacrado', 'iPhone 14 Pro Max', 'iphone-14-pro-max', ProductType.IPHONE_SEALED],
    ['iphone-lacrado', 'iPhone 15', 'iphone-15', ProductType.IPHONE_SEALED],
    ['iphone-lacrado', 'iPhone 15 Pro', 'iphone-15-pro', ProductType.IPHONE_SEALED],
    ['iphone-lacrado', 'iPhone 15 Pro Max', 'iphone-15-pro-max', ProductType.IPHONE_SEALED],
    ['iphone-lacrado', 'iPhone 16', 'iphone-16', ProductType.IPHONE_SEALED],
    ['iphone-lacrado', 'iPhone 16 Pro', 'iphone-16-pro', ProductType.IPHONE_SEALED],
    ['iphone-lacrado', 'iPhone 16 Pro Max', 'iphone-16-pro-max', ProductType.IPHONE_SEALED],
    ['macbook', 'MacBook Air', 'macbook-air', ProductType.MACBOOK],
    ['macbook', 'MacBook Pro', 'macbook-pro', ProductType.MACBOOK],
    ['ipad', 'iPad', 'ipad', ProductType.IPAD],
    ['ipad', 'iPad Air', 'ipad-air', ProductType.IPAD],
    ['ipad', 'iPad Pro', 'ipad-pro', ProductType.IPAD],
    ['apple-watch', 'Apple Watch SE', 'apple-watch-se', ProductType.APPLE_WATCH],
    ['apple-watch', 'Apple Watch Series', 'apple-watch-series', ProductType.APPLE_WATCH],
    ['apple-watch', 'Apple Watch Ultra', 'apple-watch-ultra', ProductType.APPLE_WATCH],
    ['airpods', 'AirPods', 'airpods', ProductType.AIRPODS],
    ['airpods', 'AirPods Pro', 'airpods-pro', ProductType.AIRPODS],
    ['airpods', 'AirPods Max', 'airpods-max', ProductType.AIRPODS],
  ] as const;

  for (const [categorySlug, name, normalizedName, productType] of models) {
    const category = categoryBySlug.get(categorySlug);

    if (!category) {
      continue;
    }

    await prisma.productModel.upsert({
      where: { normalizedName },
      update: {
        categoryId: category.id,
        name,
        productType,
      },
      create: {
        categoryId: category.id,
        name,
        normalizedName,
        productType,
      },
    });
  }

  const colors = [
    ['Preto', 'preto'],
    ['Branco', 'branco'],
    ['Azul', 'azul'],
    ['Natural', 'natural'],
    ['Desert', 'desert'],
    ['Titanio', 'titanio'],
    ['Roxo', 'roxo'],
    ['Grafite', 'grafite'],
    ['Prata', 'prata'],
    ['Dourado', 'dourado'],
  ] as const;

  for (const [name, normalizedName] of colors) {
    await prisma.productColor.upsert({
      where: { normalizedName },
      update: { name },
      create: {
        name,
        normalizedName,
      },
    });
  }

  const storages = [
    ['64', 'GB', '64 GB'],
    ['128', 'GB', '128 GB'],
    ['256', 'GB', '256 GB'],
    ['512', 'GB', '512 GB'],
    ['1', 'TB', '1 TB'],
    ['2', 'TB', '2 TB'],
  ] as const;

  for (const [value, unit, displayName] of storages) {
    await prisma.productStorage.upsert({
      where: {
        value_unit: {
          value,
          unit,
        },
      },
      update: { displayName },
      create: {
        value,
        unit,
        displayName,
      },
    });
  }
}

async function seedSalesOrigins() {
  const origins = [
    ['Meta Ads', SalesOriginType.META_ADS],
    ['Google Ads', SalesOriginType.GOOGLE_ADS],
    ['Indicacao', SalesOriginType.REFERRAL],
    ['Organico', SalesOriginType.ORGANIC],
    ['WhatsApp', SalesOriginType.WHATSAPP],
    ['Loja', SalesOriginType.STORE],
    ['Outros', SalesOriginType.OTHER],
  ] as const;

  for (const [name, type] of origins) {
    await prisma.salesOrigin.upsert({
      where: { name },
      update: {
        type,
        status: GenericStatus.ACTIVE,
      },
      create: {
        name,
        type,
        status: GenericStatus.ACTIVE,
      },
    });
  }
}

async function seedLocationBase() {
  const country = await prisma.country.upsert({
    where: { name: 'Brasil' },
    update: {
      code: 'BR',
      defaultCurrency: 'BRL',
      defaultTimezone: 'America/Sao_Paulo',
    },
    create: {
      name: 'Brasil',
      code: 'BR',
      defaultCurrency: 'BRL',
      defaultTimezone: 'America/Sao_Paulo',
    },
  });

  await prisma.state.upsert({
    where: {
      countryId_name: {
        countryId: country.id,
        name: 'Sao Paulo',
      },
    },
    update: {
      code: 'SP',
    },
    create: {
      countryId: country.id,
      name: 'Sao Paulo',
      code: 'SP',
    },
  });
}

async function seedFinancialConfiguration() {
  await prisma.financialConfiguration.upsert({
    where: { name: 'Configuracao Financeira Global' },
    update: {
      scope: 'global',
      fixedCost: '0',
      freight: '0',
      paymentFee: '0',
      otherCosts: '0',
      desiredNetProfit: '0',
      discount: '0',
      status: GenericStatus.ACTIVE,
    },
    create: {
      name: 'Configuracao Financeira Global',
      scope: 'global',
      fixedCost: '0',
      freight: '0',
      paymentFee: '0',
      otherCosts: '0',
      desiredNetProfit: '0',
      discount: '0',
      status: GenericStatus.ACTIVE,
    },
  });
}

async function seedImportFinancialConfiguration() {
  const configuration = await prisma.importFinancialConfiguration.upsert({
    where: { name: 'Configuracao Financeira de Importacao' },
    update: {
      dollarQuote: '5.35',
      cdeExitPerBox: '110',
      brazilDispatchPerBox: '50',
      invoiceTaxPercent: '3',
      correiosLabel: '120',
      status: GenericStatus.ACTIVE,
    },
    create: {
      name: 'Configuracao Financeira de Importacao',
      dollarQuote: '5.35',
      cdeExitPerBox: '110',
      brazilDispatchPerBox: '50',
      invoiceTaxPercent: '3',
      correiosLabel: '120',
      status: GenericStatus.ACTIVE,
    },
  });

  const redirectRules = [
    {
      productType: 'Perfume',
      redirectCost: '25',
      priority: 70,
      matchTerms: ['perfume'],
    },
    {
      productType: 'iPhone 15 ao 17 Pro Max',
      redirectCost: '100',
      priority: 100,
      matchTerms: ['iphone 15', 'iphone 16', 'iphone 17', 'pro max'],
    },
    {
      productType: 'iPhone 14 Pro Max e abaixo / outros celulares',
      redirectCost: '60',
      priority: 90,
      matchTerms: ['iphone 14', 'iphone 13', 'iphone 12', 'celular'],
    },
    {
      productType: 'MacBook / Notebook',
      redirectCost: '200',
      priority: 80,
      matchTerms: ['macbook', 'notebook'],
    },
    {
      productType: 'iPad',
      redirectCost: '100',
      priority: 75,
      matchTerms: ['ipad'],
    },
    {
      productType: 'Apple Watch / Garmin',
      redirectCost: '60',
      priority: 65,
      matchTerms: ['apple watch', 'garmin'],
    },
    {
      productType: 'Outros Smart Watches',
      redirectCost: '30',
      priority: 60,
      matchTerms: ['smart watch', 'smartwatch'],
    },
  ];

  for (const rule of redirectRules) {
    await prisma.importRedirectRule.upsert({
      where: {
        importFinancialConfigurationId_productType: {
          importFinancialConfigurationId: configuration.id,
          productType: rule.productType,
        },
      },
      update: {
        redirectCost: rule.redirectCost,
        priority: rule.priority,
        matchTerms: rule.matchTerms,
        status: GenericStatus.ACTIVE,
      },
      create: {
        importFinancialConfigurationId: configuration.id,
        productType: rule.productType,
        redirectCost: rule.redirectCost,
        priority: rule.priority,
        matchTerms: rule.matchTerms,
        status: GenericStatus.ACTIVE,
      },
    });
  }
}

async function seedSupplierContacts() {
  const contacts = [
    {
      supplierName: 'BrockTech',
      address: 'Shopping Mundo Oriental, LN224, 2o Andar, Sao Paulo/SP',
      whatsappNumbers: ['244943944758', '5511999337000', '96171011066', '96171776655'],
    },
    {
      supplierName: 'Alisson Angelim',
      address: 'Loja Shop Importale, Av. Maria Coelho Aguiar 215, Jardim Sao Luis, Sao Paulo/SP, CEP 05805-000',
      whatsappNumbers: ['5511914979079'],
    },
    {
      supplierName: 'Emilio Shop',
      address: 'Shopping Mundo Oriental, LN793, 7o Andar, Sao Paulo/SP',
      whatsappNumbers: ['96171942371', '96178813241', '9617213200'],
    },
    {
      supplierName: 'Rawan Import',
      address: 'Shopping Mundo Oriental, LN222A, 2o Andar, Sao Paulo/SP',
      whatsappNumbers: ['5511984273294', '5511963483426'],
    },
    {
      supplierName: 'Mohamad Nasser',
      address: 'Shopping Mundo Oriental, LN229, 2o Andar, Sao Paulo/SP',
      whatsappNumbers: ['5511994430333'],
    },
    {
      supplierName: 'Trend Shop',
      address: 'Shopping Mundo Oriental, LN232, 2o Andar, Sao Paulo/SP',
      whatsappNumbers: ['5511958105593'],
    },
    {
      supplierName: 'Fire Cell',
      address: 'Shopping Mundo Oriental, LN235, 2o Andar, Sao Paulo/SP',
      whatsappNumbers: ['5511947041585', '5511942379444'],
    },
    {
      supplierName: 'ProNine Atacado',
      address: 'Campo Grande/MS',
      whatsappNumbers: ['556792217299', '5511918442204'],
    },
    {
      supplierName: 'Cell Zone',
      address: 'Shopping Mundo Oriental, LN235 / LN263, Sao Paulo/SP',
      whatsappNumbers: ['5511947612741', '5511992740938'],
    },
    {
      supplierName: 'Tala Cell',
      address: 'Shopping Mundo Oriental, LN207A, 2o Andar, Sao Paulo/SP',
      whatsappNumbers: ['5511940886603'],
    },
    {
      supplierName: 'HyH',
      address: 'Shopping Mundo Oriental, LN751, 7o Andar, Sao Paulo/SP',
      whatsappNumbers: ['5511954236940'],
    },
    {
      supplierName: 'Mega Center',
      address: 'Shopping Mundo Oriental, LN269, 2o Andar, Sao Paulo/SP',
      whatsappNumbers: ['5511981051194', '96181020316', '5511959598222'],
    },
    {
      supplierName: 'GN Logistica Serv',
      address: 'Taubate/SP',
      whatsappNumbers: ['5511934459955', '5511983797106'],
    },
    {
      supplierName: 'Tio San',
      address: 'Guarulhos/SP',
      whatsappNumbers: ['13153886169'],
    },
    {
      supplierName: 'Fox',
      address: 'Shopping Mundo Oriental, LN200/LN269, Sao Paulo/SP',
      whatsappNumbers: ['595973406570', '595987119077', '96176696858', '5545991075557'],
    },
    {
      supplierName: 'Elite Shop',
      address: 'Shopping Mundo Oriental, LN249A, 2o Andar, Sao Paulo/SP',
      whatsappNumbers: ['5511943020886', '5511960650689'],
    },
    {
      supplierName: 'AZUR IMPEX',
      address: 'Galeria Page, LN24/25, 2o Andar',
      whatsappNumbers: ['595993272728', '595973648393'],
    },
    {
      supplierName: 'AZ Shop',
      address: 'Shopping Mundo Oriental, LN793, 7o Andar, Sao Paulo/SP',
      whatsappNumbers: ['96171213200', '9613871138'],
    },
    {
      supplierName: 'SAM CELL',
      address: 'Shopping Mundo Oriental, LN202E, 2o Andar, Sao Paulo/SP',
      whatsappNumbers: ['595975216445', '5511930152828'],
    },
    {
      supplierName: 'Point Cell',
      address: 'Shopping Mundo Oriental, LN106A, 1o Andar, Sao Paulo/SP',
      whatsappNumbers: ['5511999633929', '5511984798723', '96170386595'],
    },
    {
      supplierName: 'Bakkour',
      address: 'Sao Paulo/SP',
      whatsappNumbers: ['5511964259939'],
    },
    {
      supplierName: 'Captain Cell',
      address: 'Shopping Mundo Oriental, LN216, 2o Andar, Sao Paulo/SP',
      whatsappNumbers: ['5511999568992', '5545991052815', '5511952746286'],
    },
    {
      supplierName: 'Braba Atacado',
      address: 'Shopping Mundo Oriental, LN711, 7o Andar, Sao Paulo/SP',
      whatsappNumbers: ['5511914509898', '5511926128880'],
    },
    {
      supplierName: 'Red Cell',
      address: 'Shopping Mundo Oriental, LN325, 3o Andar, Sao Paulo/SP',
      whatsappNumbers: ['5511953375519'],
    },
    {
      supplierName: 'Casa do iPhone',
      address: 'CDE, Paraguai',
      whatsappNumbers: ['595993506874', '556581267526', '556599370112'],
    },
  ] as const;

  for (const supplier of contacts) {
    for (const whatsappNumber of supplier.whatsappNumbers) {
      const normalizedWhatsappNumber = whatsappNumber.replace(/\D/g, '');

      await prisma.supplierContact.upsert({
        where: { whatsappNumber: normalizedWhatsappNumber },
        update: {
          supplierName: supplier.supplierName,
          address: supplier.address,
          isActive: true,
        },
        create: {
          supplierName: supplier.supplierName,
          whatsappNumber: normalizedWhatsappNumber,
          address: supplier.address,
          isActive: true,
        },
      });
    }
  }
}

async function seedCommercialTemplates() {
  const sealedTemplate = [
    '🏆 OFERTA DE LACRADO INEST 🏆',
    '',
    '⏳ VÁLIDA POR 24 HORAS ⏳',
    '',
    'Todos os produtos são importados, o que muda é apenas o prazo.',
    '',
    '📦 Novo e Lacrado',
    '',
    '🛡️ 1 ano de garantia Apple',
    '',
    '✈️ Prazo de entrega: {{prazo}}',
    '',
    '📱 {{modelo}}',
    '',
    '{{cores}}',
    '',
    '📥 Me chama no privado e garanta sua reserva.',
  ].join('\n');

  const usedTemplate = [
    '🏆 OFERTA DE SEMINOVO ORIGINAL INEST 🏆',
    '',
    '⏳ VÁLIDA POR 24 HORAS ⏳',
    '',
    'Todos os produtos são importados, o que muda é apenas o prazo.',
    '',
    '📦 Seminovo Original',
    '',
    '🛡️ 6 meses de garantia pela loja',
    '',
    '✈️ Prazo de entrega: {{prazo}}',
    '',
    '📱 {{modelo}}',
    '',
    '{{cores}}',
    '',
    '📥 Me chama no privado e garanta sua reserva.',
  ].join('\n');

  const variables = ['modelo', 'cor', 'cores', 'capacidade', 'preco', 'prazo', 'garantia'];

  await prisma.commercialTemplate.upsert({
    where: { name: 'Template Oficial - Produtos Lacrados' },
    update: {
      productType: ProductType.IPHONE_SEALED,
      content: sealedTemplate,
      variables,
      status: GenericStatus.ACTIVE,
    },
    create: {
      name: 'Template Oficial - Produtos Lacrados',
      productType: ProductType.IPHONE_SEALED,
      content: sealedTemplate,
      variables,
      status: GenericStatus.ACTIVE,
    },
  });

  await prisma.commercialTemplate.upsert({
    where: { name: 'Template Oficial - Seminovos' },
    update: {
      productType: ProductType.IPHONE_USED,
      content: usedTemplate,
      variables,
      status: GenericStatus.ACTIVE,
    },
    create: {
      name: 'Template Oficial - Seminovos',
      productType: ProductType.IPHONE_USED,
      content: usedTemplate,
      variables,
      status: GenericStatus.ACTIVE,
    },
  });
}

async function main() {
  await seedRoles();
  await seedPermissions();
  await seedRolePermissions();
  await seedAdminUser();
  await seedProductCategories();
  await seedProductCatalog();
  await seedProfitProducts(prisma);
  await seedSalesOrigins();
  await seedLocationBase();
  await seedFinancialConfiguration();
  await seedImportFinancialConfiguration();
  await seedSupplierContacts();
  await seedCommercialTemplates();
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
