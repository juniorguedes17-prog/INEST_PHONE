export interface DashboardPoint {
  label: string;
  value: number;
}

export interface DashboardData {
  kpis: {
    monthRevenue: number;
    monthProfit: number;
    salesCount: number;
    ticketAverage: number;
    productsTotal: number;
    activeProducts: number;
    activeSuppliers: number;
    offersGenerated: number;
    radarUpdatedToday: number;
  };
  financial: {
    monthlyRevenue: DashboardPoint[];
    monthlyProfit: DashboardPoint[];
    revenueEvolution: DashboardPoint[];
    profitEvolution: DashboardPoint[];
  };
  commercial: {
    mostConsultedProducts: DashboardPoint[];
    bestSellingProducts: DashboardPoint[];
    mostProfitableProducts: DashboardPoint[];
    lowestCostProducts: DashboardPoint[];
    highestMarginProducts: DashboardPoint[];
  };
  radar: {
    suppliersCount: number;
    quotesCount: number;
    lowestPrice: number;
    hiddenProducts: number;
    productsWithoutQuotes: number;
    updatesToday: number;
  };
  importation: {
    searches: number;
    simulatedProducts: number;
    estimatedSavings: number;
    importedProducts: number;
    lastDollarQuote: number;
  };
  offers: {
    generated: number;
    shared: number;
    mostOfferedProducts: DashboardPoint[];
    lastOffer: unknown;
  };
  suppliers: {
    active: number;
    total: number;
  };
}

export interface DashboardFilters {
  startDate: string;
  endDate: string;
  category: string;
  productId: string;
  supplierId: string;
  userId: string;
}
