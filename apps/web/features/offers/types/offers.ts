import { PricingItem } from '@/features/pricing/types/pricing';

export interface CommercialTemplate {
  id: string;
  name: string;
  productType: string;
  content: string;
  variables?: string[];
  status: string;
}

export interface OfferItem {
  id: string;
  template?: CommercialTemplate;
  message: string;
  status: string;
  salePrice: number;
  offerPrice: number;
  whatsappUrl: string;
  productId?: string | null;
  createdAt: string;
}

export interface GenerateOfferPayload {
  productId: string;
  templateId?: string;
}

export interface OffersState {
  pricingItems: PricingItem[];
  templates: CommercialTemplate[];
  offers: OfferItem[];
}
