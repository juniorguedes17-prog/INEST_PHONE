import { Inject, Injectable } from '@nestjs/common';
import { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import { DashboardQueryDto } from '../dto/dashboard.dto';
import {
  DashboardOfferRecord,
  DashboardPriceHistoryRecord,
  DashboardProductRecord,
  DashboardSaleRecord,
} from '../interfaces/dashboard-prisma.interface';
import { DashboardRepository } from '../repository/dashboard.repository';
import { isToday, monthKey, toNumber } from '../validators/dashboard.validators';

interface CacheEntry {
  expiresAt: number;
  value: DashboardOverview;
}

export interface DashboardOverview {
  kpis: unknown;
  financial: unknown;
  commercial: unknown;
  radar: unknown;
  importation: unknown;
  offers: unknown;
  suppliers: unknown;
}

@Injectable()
export class DashboardService {
  private readonly cache = new Map<string, CacheEntry>();

  constructor(@Inject(DashboardRepository) private readonly dashboardRepository: DashboardRepository) {}

  async overview(query: DashboardQueryDto, user: AuthenticatedUser): Promise<DashboardOverview> {
    const cacheKey = JSON.stringify(query);
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value;
    }

    const snapshot = await this.dashboardRepository.snapshot(query);
    const value = this.buildDashboard(snapshot);

    this.cache.set(cacheKey, { value, expiresAt: Date.now() + 30_000 });
    await this.dashboardRepository.createAccessAudit({ userId: user.id, filters: query });
    return value;
  }

  async kpis(query: DashboardQueryDto, user: AuthenticatedUser) {
    return (await this.overview(query, user)).kpis;
  }

  async financial(query: DashboardQueryDto, user: AuthenticatedUser) {
    return (await this.overview(query, user)).financial;
  }

  async radar(query: DashboardQueryDto, user: AuthenticatedUser) {
    return (await this.overview(query, user)).radar;
  }

  async importation(query: DashboardQueryDto, user: AuthenticatedUser) {
    return (await this.overview(query, user)).importation;
  }

  async offers(query: DashboardQueryDto, user: AuthenticatedUser) {
    return (await this.overview(query, user)).offers;
  }

  async products(query: DashboardQueryDto, user: AuthenticatedUser) {
    return (await this.overview(query, user)).commercial;
  }

  async suppliers(query: DashboardQueryDto, user: AuthenticatedUser) {
    return (await this.overview(query, user)).suppliers;
  }

  private buildDashboard(
    snapshot: Awaited<ReturnType<DashboardRepository['snapshot']>>,
  ): DashboardOverview {
    const sales = snapshot.sales;
    const quotes = snapshot.quotes;
    const offers = snapshot.offers;
    const products = snapshot.products;
    const suppliers = snapshot.suppliers;
    const monthRevenue = sales.reduce((total, sale) => total + toNumber(sale.netRevenue), 0);
    const monthProfit = sales.reduce((total, sale) => total + toNumber(sale.netProfit), 0);
    const salesCount = sales.length;
    const ticketAverage = salesCount ? monthRevenue / salesCount : 0;
    const activeProducts = products.filter((product) => product.status === 'ACTIVE').length;
    const activeSuppliers = suppliers.filter((supplier) => supplier.status === 'ACTIVE').length;
    const radarUpdatedToday = quotes.filter((quote) => isToday(quote.quoteDate)).length;
    const hiddenQuotes = quotes.filter((quote) => quote.notes?.includes('[RADAR_HIDDEN]')).length;
    const productsWithQuotes = new Set(quotes.map((quote) => quote.productId));
    const productsWithoutQuotes = products.filter(
      (product) => !productsWithQuotes.has(product.id),
    ).length;
    const importSearches = snapshot.importLogs.filter(
      (log) => this.getContextEvent(log.context) === 'import_radar.search',
    ).length;
    const importCalculations = snapshot.importLogs.filter(
      (log) => this.getContextEvent(log.context) === 'import_radar.calculated',
    ).length;
    const offersShared = snapshot.offerLogs.filter(
      (log) => this.getContextEvent(log.context) === 'offers.shared_whatsapp',
    ).length;

    return {
      kpis: {
        monthRevenue,
        monthProfit,
        salesCount,
        ticketAverage,
        productsTotal: products.length,
        activeProducts,
        activeSuppliers,
        offersGenerated: offers.length,
        radarUpdatedToday,
      },
      financial: {
        monthlyRevenue: this.groupSalesByMonth(sales, 'netRevenue'),
        monthlyProfit: this.groupSalesByMonth(sales, 'netProfit'),
        revenueEvolution: this.groupSalesByMonth(sales, 'grossRevenue'),
        profitEvolution: this.groupSalesByMonth(sales, 'netProfit'),
      },
      commercial: {
        mostConsultedProducts: this.rankProductsFromQuotes(quotes),
        bestSellingProducts: this.rankProductsFromSales(sales, 'quantity'),
        mostProfitableProducts: this.rankProductsFromSales(sales, 'profit'),
        lowestCostProducts: this.lowestCostProducts(quotes),
        highestMarginProducts: this.rankProductsFromSales(sales, 'margin'),
      },
      radar: {
        suppliersCount: suppliers.length,
        quotesCount: quotes.length,
        lowestPrice: quotes.length
          ? Math.min(...quotes.map((quote) => toNumber(quote.costProduct)))
          : 0,
        hiddenProducts: hiddenQuotes,
        productsWithoutQuotes,
        updatesToday: radarUpdatedToday,
      },
      importation: {
        searches: importSearches,
        simulatedProducts: importCalculations,
        estimatedSavings: 0,
        importedProducts: 0,
        lastDollarQuote: this.lastDollarQuote(snapshot.importLogs),
      },
      offers: {
        generated: offers.length,
        shared: offersShared,
        mostOfferedProducts: this.rankProductsFromOffers(offers),
        lastOffer: offers[0] ?? null,
      },
      suppliers: {
        active: activeSuppliers,
        total: suppliers.length,
      },
    };
  }

  private groupSalesByMonth(
    sales: DashboardSaleRecord[],
    field: 'grossRevenue' | 'netRevenue' | 'netProfit',
  ) {
    const grouped = new Map<string, number>();
    sales.forEach((sale) => {
      const key = monthKey(sale.saleDate);
      grouped.set(key, (grouped.get(key) ?? 0) + toNumber(sale[field]));
    });
    return Array.from(grouped.entries()).map(([label, value]) => ({ label, value }));
  }

  private rankProductsFromQuotes(quotes: DashboardPriceHistoryRecord[]) {
    const grouped = new Map<string, { label: string; value: number }>();
    quotes.forEach((quote) => {
      const label = this.productName(quote.product);
      grouped.set(label, { label, value: (grouped.get(label)?.value ?? 0) + 1 });
    });
    return this.top(Array.from(grouped.values()));
  }

  private rankProductsFromSales(
    sales: DashboardSaleRecord[],
    mode: 'quantity' | 'profit' | 'margin',
  ) {
    const grouped = new Map<string, { label: string; value: number }>();
    sales.forEach((sale) => {
      sale.items?.forEach((item) => {
        const label = this.productName(item.product);
        const current = grouped.get(label)?.value ?? 0;
        const value =
          mode === 'quantity'
            ? item.quantity
            : mode === 'profit'
              ? toNumber(item.netProfit)
              : toNumber(item.salePrice)
                ? toNumber(item.netProfit) / toNumber(item.salePrice)
                : 0;
        grouped.set(label, { label, value: current + value });
      });
    });
    return this.top(Array.from(grouped.values()));
  }

  private rankProductsFromOffers(offers: DashboardOfferRecord[]) {
    const grouped = new Map<string, { label: string; value: number }>();
    offers.forEach((offer) => {
      offer.items?.forEach((item) => {
        const label = item.productId;
        grouped.set(label, { label, value: (grouped.get(label)?.value ?? 0) + 1 });
      });
    });
    return this.top(Array.from(grouped.values()));
  }

  private lowestCostProducts(quotes: DashboardPriceHistoryRecord[]) {
    return this.top(
      quotes.map((quote) => ({
        label: this.productName(quote.product),
        value: toNumber(quote.costProduct),
      })),
      false,
    );
  }

  private lastDollarQuote(logs: Array<{ context?: unknown }>) {
    for (const log of logs) {
      const context = this.asRecord(log.context);
      if (typeof context.dollarQuote === 'number') {
        return context.dollarQuote;
      }
    }
    return 0;
  }

  private getContextEvent(context: unknown) {
    const record = this.asRecord(context);
    return typeof record.event === 'string' ? record.event : '';
  }

  private asRecord(value: unknown): Record<string, unknown> {
    return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
  }

  private productName(product?: DashboardProductRecord | null) {
    return (
      [
        product?.category?.name,
        product?.model?.name,
        product?.storage?.displayName,
        product?.color?.name,
      ]
        .filter(Boolean)
        .join(' ') || 'Produto nao identificado'
    );
  }

  private top(items: Array<{ label: string; value: number }>, desc = true) {
    return items.sort((a, b) => (desc ? b.value - a.value : a.value - b.value)).slice(0, 5);
  }
}
