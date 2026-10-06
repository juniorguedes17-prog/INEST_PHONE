import type { ContractFillFlow } from "./contract-fill-flow";
import type { ContractStatus } from "./contract-status";

export type PersonType = "PF" | "PJ";

export type ProductCondition = "NOVO" | "SEMINOVO";

export type MonetaryAmount = number;

export interface ContractClient {
  fullName: string;
  personType: PersonType;
  documentNumber: string;
  email: string;
  addressStreet: string;
  addressNumber: string;
  addressNeighborhood: string;
  addressComplement?: string;
  postalCode: string;
  city: string;
  state: string;
  phone: string;
}

export interface PersistedContractClient {
  fullName: string | null;
  personType: PersonType | null;
  documentNumber: string | null;
  email: string | null;
  addressStreet: string | null;
  addressNumber: string | null;
  addressNeighborhood: string | null;
  addressComplement: string | null;
  postalCode: string | null;
  city: string | null;
  state: string | null;
  phone: string | null;
}

export interface ContractProduct {
  model: string;
  capacity: string;
  condition: ProductCondition;
  color: string;
}

export interface PersistedContractProduct {
  model: string | null;
  capacity: string | null;
  condition: ProductCondition | null;
  color: string | null;
}

interface TradeInNegotiation {
  totalAmount: MonetaryAmount;
  entryAmount: MonetaryAmount;
  commitmentDepositAmount: MonetaryAmount;
  /** Must be an integer number of days. */
  deliveryDays: number;
}

export type ContractNegotiation = TradeInNegotiation &
  (
    | { tradeInIncluded: true; tradeInValue: MonetaryAmount }
    | { tradeInIncluded: false; tradeInValue?: never }
  );

export interface PersistedContractNegotiation {
  totalAmount: MonetaryAmount | null;
  entryAmount: MonetaryAmount | null;
  commitmentDepositAmount: MonetaryAmount | null;
  tradeInIncluded: boolean | null;
  tradeInValue: MonetaryAmount | null;
  deliveryDays: number | null;
}

export interface DerivedClientFields {
  addressLine: string;
  cityStateDisplay: string;
}

export interface DerivedProductFields {
  warrantyTerm: string;
}

export interface DerivedNegotiationFields {
  totalAmountInWords: string;
  entryAmountInWords: string;
  commitmentDepositAmountInWords: string;
  tradeInValueInWords?: string;
  balanceAmount: MonetaryAmount;
  balanceAmountInWords: string;
  deliveryDaysInWords: string;
}

export interface DerivedSystemFields {
  /** Generated when the final contract is generated. */
  contractDate: Date;
}

export interface ContractDerivedFields {
  client: DerivedClientFields;
  product: DerivedProductFields;
  negotiation: DerivedNegotiationFields;
  system: DerivedSystemFields;
}

export interface ContractFixedContent {
  readonly buyerDesignation: "COMPRADOR(A)";
  readonly buyerNationality: "brasileiro(a)";
  readonly buyerDocumentLabel: "CPF/CNPJ";
  readonly accessoryText: "iNestBox";
  readonly paymentOptions: string;
}

export interface Contract {
  client: ContractClient;
  product: ContractProduct;
  negotiation: ContractNegotiation;
  derived: ContractDerivedFields;
  template: ContractFixedContent;
}

export interface PersistedContract {
  id: string;
  status: ContractStatus;
  fillFlow: ContractFillFlow;
  client: PersistedContractClient;
  product: PersistedContractProduct;
  negotiation: PersistedContractNegotiation;
  createdAt: Date;
}
