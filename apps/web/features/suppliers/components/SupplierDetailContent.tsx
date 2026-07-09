'use client';

import { useEffect, useState } from 'react';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  SettingsCard,
  StatusBadge,
} from '@/components/shared';
import { getSupplier } from '../services/suppliers-service';
import { SupplierItem } from '../types/suppliers';

interface SupplierDetailContentProps {
  id: string;
}

export function SupplierDetailContent({ id }: SupplierDetailContentProps) {
  const [supplier, setSupplier] = useState<SupplierItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadSupplier() {
      setLoading(true);
      try {
        setSupplier(await getSupplier(id));
      } catch (supplierError) {
        setError(
          supplierError instanceof Error ? supplierError.message : 'Fornecedor nao encontrado.',
        );
      } finally {
        setLoading(false);
      }
    }

    void loadSupplier();
  }, [id]);

  if (loading) {
    return <LoadingState />;
  }

  if (error || !supplier) {
    return <ErrorState title="Fornecedor indisponivel" description={error ?? 'Nao encontrado.'} />;
  }

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow={supplier.source ?? 'Fornecedor'}
        title={supplier.name}
        description="Perfil centralizado do fornecedor para futuras consultas operacionais."
        actions={
          <StatusBadge tone={supplier.status === 'ACTIVE' ? 'green' : 'gray'}>
            {supplier.status}
          </StatusBadge>
        }
      />

      <div className="grid gap-6 xl:grid-cols-2">
        <SettingsCard title="Informacoes gerais" eyebrow="Cadastro">
          <dl className="grid gap-3 text-sm">
            <Detail label="Contato" value={supplier.contact ?? 'Nao informado'} />
            <Detail label="Telefone" value={supplier.phone ?? 'Nao informado'} />
            <Detail label="WhatsApp" value={supplier.whatsappLink ?? 'Nao cadastrado'} />
            <Detail label="Tipo" value={supplier.source ?? 'Nao informado'} />
          </dl>
        </SettingsCard>
        <SettingsCard title="Integracoes futuras" eyebrow="Preparado">
          <div className="flex flex-wrap gap-2">
            <StatusBadge tone="blue">Radar de Precos</StatusBadge>
            <StatusBadge tone="blue">Radar de Importacao</StatusBadge>
            <StatusBadge tone="blue">WhatsApp Business</StatusBadge>
            <StatusBadge tone="blue">Compras Paraguai</StatusBadge>
          </div>
        </SettingsCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <EmptyState
          title="Produtos vinculados"
          description="Estrutura preparada para etapa futura."
        />
        <EmptyState
          title="Historico de precos"
          description="Estrutura preparada para etapa futura."
        />
        <EmptyState
          title="Historico de importacoes"
          description="Estrutura preparada para etapa futura."
        />
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl bg-inest-soft px-4 py-3">
      <dt className="font-bold text-inest-muted">{label}</dt>
      <dd className="text-right font-black text-inest-text">{value}</dd>
    </div>
  );
}
