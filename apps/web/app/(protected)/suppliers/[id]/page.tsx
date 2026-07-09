import { SupplierDetailContent } from '@/features/suppliers/components/SupplierDetailContent';

interface SupplierDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function SupplierDetailPage({ params }: SupplierDetailPageProps) {
  const { id } = await params;
  return <SupplierDetailContent id={id} />;
}
