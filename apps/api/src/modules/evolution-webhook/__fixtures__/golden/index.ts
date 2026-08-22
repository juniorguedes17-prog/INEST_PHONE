import { attributeCases } from './attributes.cases';
import { categoryCases } from './category.cases';
import { conditionCases } from './condition.cases';
import { contextCases } from './context.cases';
import { qualifierCases } from './qualifiers.cases';
import { resolutionCases } from './resolution.cases';

export {
  attributeCases,
  categoryCases,
  conditionCases,
  contextCases,
  qualifierCases,
  resolutionCases,
};
export type {
  GoldenCase,
  GoldenIdentityExpectation,
  GoldenParsedItemExpectation,
  GoldenResolutionExpectation,
} from './golden.types';

export const goldenCases = [
  ...conditionCases,
  ...contextCases,
  ...categoryCases,
  ...attributeCases,
  ...qualifierCases,
  ...resolutionCases,
] as const;
