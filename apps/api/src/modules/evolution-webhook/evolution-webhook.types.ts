export interface ParsedSupplierListItem {
  productName: string;
  normalizedName: string;
  category: string | null;
  model: string | null;
  capacity: string | null;
  color: string | null;
  condition: string | null;
  price: number;
  availability: string | null;
  rawLine: string;
}

export interface EvolutionMessage {
  event: string;
  messageId: string;
  remoteJid: string;
  fromMe: boolean;
  text: string | null;
  receivedAt: Date;
}
