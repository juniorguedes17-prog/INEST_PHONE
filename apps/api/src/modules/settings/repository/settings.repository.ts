import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  FinancialConfigurationRecord,
  ImportFinancialConfigurationRecord,
  SettingsPrismaClient,
  SystemConfigurationRecord,
} from '../interfaces/settings-prisma.interface';
import {
  FINANCIAL_CONFIGURATION_NAME,
  IMPORT_CONFIGURATION_NAME,
  SETTINGS_SCOPE,
} from '../settings.defaults';
import {
  FinancialSettingsDto,
  ImportRedirectRuleDto,
  ImportSettingsDto,
} from '../dto/settings.dto';

@Injectable()
export class SettingsRepository {
  constructor(@Inject(PrismaService) private readonly prismaService: PrismaService) {}

  findSystemConfigurations(): Promise<SystemConfigurationRecord[]> {
    return this.prisma.systemConfiguration.findMany({
      where: {
        scope: SETTINGS_SCOPE,
      },
    });
  }

  async upsertSystemConfiguration(key: string, value: string, type = 'texto') {
    return this.prisma.systemConfiguration.upsert({
      where: {
        key_scope: {
          key,
          scope: SETTINGS_SCOPE,
        },
      },
      update: {
        value,
        type,
      },
      create: {
        key,
        value,
        type,
        scope: SETTINGS_SCOPE,
      },
    });
  }

  deleteSystemConfigurations() {
    return this.prisma.systemConfiguration.deleteMany({
      where: {
        scope: SETTINGS_SCOPE,
      },
    });
  }

  findFinancialConfiguration(): Promise<FinancialConfigurationRecord | null> {
    return this.prisma.financialConfiguration.findFirst({
      where: {
        name: FINANCIAL_CONFIGURATION_NAME,
        deletedAt: null,
      },
    });
  }

  upsertFinancialConfiguration(settings: FinancialSettingsDto, userId?: string) {
    return this.prisma.financialConfiguration.upsert({
      where: {
        name: FINANCIAL_CONFIGURATION_NAME,
      },
      update: {
        fixedCost: settings.globalFixedCost,
        freight: settings.defaultFreight,
        paymentFee: settings.defaultPaymentFee,
        desiredNetProfit: settings.defaultMargin,
        discount: settings.defaultDiscount,
        updatedBy: userId,
      },
      create: {
        name: FINANCIAL_CONFIGURATION_NAME,
        scope: SETTINGS_SCOPE,
        fixedCost: settings.globalFixedCost,
        freight: settings.defaultFreight,
        paymentFee: settings.defaultPaymentFee,
        desiredNetProfit: settings.defaultMargin,
        discount: settings.defaultDiscount,
        createdBy: userId,
        updatedBy: userId,
      },
    });
  }

  findImportConfiguration(): Promise<ImportFinancialConfigurationRecord | null> {
    return this.prisma.importFinancialConfiguration.findFirst({
      where: {
        name: IMPORT_CONFIGURATION_NAME,
        deletedAt: null,
      },
      include: {
        redirectRules: {
          where: {
            deletedAt: null,
          },
          orderBy: {
            priority: 'asc',
          },
        },
      },
    });
  }

  async upsertImportConfiguration(settings: ImportSettingsDto) {
    const configuration = await this.prisma.importFinancialConfiguration.upsert({
      where: {
        name: IMPORT_CONFIGURATION_NAME,
      },
      update: {
        dollarQuote: settings.dollarQuote,
        cdeExitPerBox: settings.cdeExitPerBox,
        brazilDispatchPerBox: settings.brazilDispatchPerBox,
        invoiceTaxPercent: settings.invoiceTaxPercent,
        correiosLabel: settings.correiosLabel,
      },
      create: {
        name: IMPORT_CONFIGURATION_NAME,
        dollarQuote: settings.dollarQuote,
        cdeExitPerBox: settings.cdeExitPerBox,
        brazilDispatchPerBox: settings.brazilDispatchPerBox,
        invoiceTaxPercent: settings.invoiceTaxPercent,
        correiosLabel: settings.correiosLabel,
      },
    });

    await this.replaceRedirectRules(configuration.id, settings.redirectRules);
    return this.findImportConfiguration();
  }

  async replaceRedirectRules(configurationId: string, rules: ImportRedirectRuleDto[]) {
    await this.prisma.importRedirectRule.deleteMany({
      where: {
        importFinancialConfigurationId: configurationId,
      },
    });

    if (!rules.length) {
      return;
    }

    await this.prisma.importRedirectRule.createMany({
      data: rules.map((rule) => ({
        importFinancialConfigurationId: configurationId,
        productType: rule.productType,
        matchTerms: rule.matchTerms,
        redirectCost: rule.redirectCost,
        priority: rule.priority,
      })),
    });
  }

  createAuditLog(data: {
    userId?: string | null;
    oldValue?: unknown;
    newValue?: unknown;
    context?: Record<string, unknown>;
  }) {
    return this.prisma.auditLog?.create({
      data: {
        userId: data.userId ?? null,
        operationType: 'CONFIG_CHANGE',
        entity: 'settings',
        entityId: SETTINGS_SCOPE,
        oldValue: data.oldValue,
        newValue: data.newValue,
        context: data.context,
      },
    });
  }

  private get prisma(): SettingsPrismaClient {
    return this.prismaService as unknown as SettingsPrismaClient;
  }
}
