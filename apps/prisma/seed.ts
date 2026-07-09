import { pbkdf2Sync, randomBytes } from 'node:crypto';
import {
  GenericStatus,
  PrismaClient,
  ProductType,
  SalesOriginType,
  UserStatus,
} from '@prisma/client';

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
  const salt = randomBytes(16).toString('hex');
  const hash = pbkdf2Sync(password, salt, 120000, 64, 'sha512').toString('hex');

  return `pbkdf2_sha512$120000$${salt}$${hash}`;
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
  const adminEmail = requiredEnv('SEED_ADMIN_EMAIL');
  const adminPassword = requiredEnv('SEED_ADMIN_PASSWORD');

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      roleId: adminRole.id,
      passwordHash: hashPassword(adminPassword),
      status: UserStatus.ACTIVE,
    },
    create: {
      roleId: adminRole.id,
      name: 'Administrador iNest Phone',
      email: adminEmail,
      passwordHash: hashPassword(adminPassword),
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
  await seedSalesOrigins();
  await seedLocationBase();
  await seedFinancialConfiguration();
  await seedImportFinancialConfiguration();
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
