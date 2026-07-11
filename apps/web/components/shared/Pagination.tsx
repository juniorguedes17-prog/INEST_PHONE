import { ActionButton } from './ActionButton';

interface PaginationProps {
  page: number;
  totalPages: number;
  totalItems?: number;
  onPageChange?: (page: number) => void;
}

export function Pagination({ page, totalPages, totalItems, onPageChange }: PaginationProps) {
  if (totalPages <= 1) {
    return null;
  }

  return (
    <nav
      className="flex flex-col gap-3 border-t border-inest-line pt-4 sm:flex-row sm:items-center sm:justify-between"
      aria-label="Paginacao"
    >
      <p className="text-sm text-inest-muted">
        Pagina <strong className="text-inest-text">{page}</strong> de {totalPages}
        {typeof totalItems === 'number' ? ` - ${totalItems} registros` : ''}
      </p>
      <div className="flex gap-2">
        <ActionButton
          variant="secondary"
          disabled={page <= 1}
          onClick={() => onPageChange?.(page - 1)}
        >
          Anterior
        </ActionButton>
        <ActionButton
          variant="secondary"
          disabled={page >= totalPages}
          onClick={() => onPageChange?.(page + 1)}
        >
          Proxima
        </ActionButton>
      </div>
    </nav>
  );
}
