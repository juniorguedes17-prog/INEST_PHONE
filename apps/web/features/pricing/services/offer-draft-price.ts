import { OfferDraft } from '../types/pricing';

export function applyOfferDraftPrice(
  draft: OfferDraft,
  includeOfferIncrement: boolean,
  offerIncrement?: number,
): OfferDraft {
  if (includeOfferIncrement && offerIncrement === undefined) {
    return draft;
  }

  return {
    ...draft,
    payload: {
      ...draft.payload,
      offerPrice: includeOfferIncrement
        ? draft.payload.salePrice + offerIncrement!
        : draft.payload.salePrice,
    },
  };
}
