'use client';

import { ActionButton } from './ActionButton';
import { Modal } from './Modal';

interface ConfirmationDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmationDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  onConfirm,
  onCancel,
}: ConfirmationDialogProps) {
  return (
    <Modal
      open={open}
      title={title}
      onClose={onCancel}
      footer={
        <>
          <ActionButton variant="secondary" onClick={onCancel}>
            {cancelLabel}
          </ActionButton>
          <ActionButton variant="danger" onClick={onConfirm}>
            {confirmLabel}
          </ActionButton>
        </>
      }
    >
      <p className="leading-7 text-inest-muted">{description}</p>
    </Modal>
  );
}
