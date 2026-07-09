import { Suspense } from 'react';
import { OffersPageContent } from '@/features/offers/components/OffersPageContent';

export default function OffersPage() {
  return (
    <Suspense fallback={null}>
      <OffersPageContent />
    </Suspense>
  );
}
