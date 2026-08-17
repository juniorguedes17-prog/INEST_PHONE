import { OfferDraft } from '../types/pricing';

export interface OfferDraftBatchTarget {
  id: string;
}

export interface OfferDraftBatchResult {
  drafts: OfferDraft[];
  successfulIds: string[];
  failedIds: string[];
  errors: string[];
}

export async function prepareOfferDraftBatch<T extends OfferDraftBatchTarget>(
  targets: T[],
  prepare: (target: T) => Promise<OfferDraft>,
): Promise<OfferDraftBatchResult> {
  const drafts: OfferDraft[] = [];
  const successfulIds: string[] = [];
  const failedIds: string[] = [];
  const errors: string[] = [];
  const processedIds = new Set<string>();

  for (const target of targets) {
    if (processedIds.has(target.id)) continue;
    processedIds.add(target.id);

    try {
      drafts.push(await prepare(target));
      successfulIds.push(target.id);
    } catch (error) {
      failedIds.push(target.id);
      errors.push(error instanceof Error ? error.message : 'Nao foi possivel preparar a oferta.');
    }
  }

  return { drafts, successfulIds, failedIds, errors };
}
