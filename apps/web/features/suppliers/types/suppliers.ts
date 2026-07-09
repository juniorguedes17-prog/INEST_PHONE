export interface SupplierItem {
  id: string;
  name: string;
  contact?: string | null;
  phone?: string | null;
  source?: string | null;
  status: string;
  whatsappLink?: string | null;
  integrationReadiness?: {
    priceRadar: boolean;
    importRadar: boolean;
    whatsappBusiness: boolean;
    comprasParaguai: boolean;
  };
}

export interface SupplierFormPayload {
  name: string;
  contact?: string;
  phone?: string;
  source?: string;
  status?: string;
  email?: string;
  whatsappLink?: string;
}

export interface SupplierFilters {
  search: string;
  source: string;
  status: string;
}
