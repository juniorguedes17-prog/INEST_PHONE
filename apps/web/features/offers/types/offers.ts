import { PricingItem } from '@/features/pricing/types/pricing';

export interface CommercialTemplate {
  id: string;
  name: string;
  productType: string;
  content: string;
  variables?: string[];
  status: string;
}

export interface OfferProductSummary {
  id: string;
  name: string;
  model: string | null;
  color: string | null;
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
  externalIdentity?: {
    origin: 'US' | null;
    provider: string | null;
    sourceProductId: string | null;
    sourceName: string | null;
    sourceUrl: string | null;
    retailer: string | null;
  } | null;
  product?: OfferProductSummary | null;
  createdAt: string;
}

export interface CanonicalGenerateOfferPayload {
  productId: string;
  templateId?: string;
}

export interface ExternalGenerateOfferPayload {
  productId?: null;
  templateId?: string;
  externalIdentity: {
    origin: 'US';
    provider: string;
    sourceProductId: string;
    sourceName?: string;
    sourceUrl?: string;
    retailer?: string;
  };
  salePrice: number;
  offerPrice: number;
  productType?: string;
  color?: string;
  capacity?: string;
}

export type GenerateOfferPayload = CanonicalGenerateOfferPayload | ExternalGenerateOfferPayload;

export interface OffersState {
  pricingItems: PricingItem[];
  templates: CommercialTemplate[];
  offers: OfferItem[];
}
