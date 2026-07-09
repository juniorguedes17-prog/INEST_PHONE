import { ActionButton, EmptyState, PageHeader } from '@/components/shared';

interface ModulePlaceholderProps {
  eyebrow: string;
  title: string;
  description: string;
}

export function ModulePlaceholder({ eyebrow, title, description }: ModulePlaceholderProps) {
  return (
    <div className="grid gap-6">
      <PageHeader eyebrow={eyebrow} title={title} description={description} />
      <EmptyState
        title="Módulo preparado"
        description="A estrutura visual está pronta para receber a implementação funcional em etapa específica."
        action={<ActionButton variant="secondary">Aguardando próxima etapa</ActionButton>}
      />
    </div>
  );
}
