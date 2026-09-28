export type SupplierConditionProvenance =
  | 'EXPLICIT_PRODUCT'
  | 'SECTION_CONTEXT'
  | 'POLICY_DEFAULT'
  | 'INFERRED_GRADE';

export interface ParsedSupplierListItem {
  productName: string;
  normalizedName: string;
  category: string | null;
  model: string | null;
  capacity: string | null;
  color: string | null;
  condition: string | null;
  conditionProvenance?: SupplierConditionProvenance | null;
  qualityGrade: string | null;
  price: number;
  availability: string | null;
  rawLine: string;
}

export interface EvolutionMessage {
  event: string;
  messageId: string;
  remoteJid: string;
  senderJid: string;
  fromMe: boolean;
  text: string | null;
  receivedAt: Date;
}
