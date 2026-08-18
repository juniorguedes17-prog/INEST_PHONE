'use client';

import { FormEvent, useState } from 'react';
import {
  ActionButton,
  ErrorState,
  Input,
  LoadingState,
  Modal,
  SettingsCard,
  StatusBadge,
} from '@/components/shared';
import { useAccessUsers } from '../hooks/useAccessUsers';
import { AccessUser } from '../types/users';

const emptyForm = { name: '', email: '', password: '' };
const minimumPasswordLength = 8;

export function UsersAccessSettingsCard() {
  const { users, loading, creating, updatingUserId, error, success, create, update, deactivate, activate } =
    useAccessUsers();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<AccessUser | null>(null);
  const [editingUser, setEditingUser] = useState<AccessUser | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [editForm, setEditForm] = useState(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [editFormError, setEditFormError] = useState<string | null>(null);

  function closeCreateModal() {
    if (creating) {
      return;
    }

    setIsCreateOpen(false);
    setForm(emptyForm);
    setFormError(null);
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!form.name.trim() || !form.email.trim() || !form.password) {
      setFormError('Preencha nome, e-mail e senha.');
      return;
    }

    if (form.password.length < minimumPasswordLength) {
      setFormError(`A senha deve possuir pelo menos ${minimumPasswordLength} caracteres.`);
      return;
    }

    setFormError(null);
    const created = await create(form);

    if (created) {
      closeCreateModal();
    }
  }

  function openEditModal(user: AccessUser) {
    setEditingUser(user);
    setEditForm({ name: user.name, email: user.email, password: '' });
    setEditFormError(null);
  }

  function closeEditModal() {
    if (editingUser && updatingUserId === editingUser.id) {
      return;
    }

    setEditingUser(null);
    setEditForm(emptyForm);
    setEditFormError(null);
  }

  async function handleEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!editingUser) {
      return;
    }

    if (!editForm.name.trim() || !editForm.email.trim()) {
      setEditFormError('Preencha nome e e-mail.');
      return;
    }

    if (editForm.password && editForm.password.length < minimumPasswordLength) {
      setEditFormError(`A senha deve possuir pelo menos ${minimumPasswordLength} caracteres.`);
      return;
    }

    setEditFormError(null);
    const updated = await update(editingUser.id, {
      name: editForm.name,
      email: editForm.email,
      ...(editForm.password ? { password: editForm.password } : {}),
    });

    if (updated) {
      closeEditModal();
    }
  }

  async function confirmDeactivation() {
    if (!selectedUser) {
      return;
    }

    const deactivated = await deactivate(selectedUser.id);

    if (deactivated) {
      setSelectedUser(null);
    }
  }

  return (
    <>
      <SettingsCard
        eyebrow="Usuario"
        title="Usuarios com acesso"
        description="Administradores com acesso geral ao sistema."
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-inest-muted">Perfil aplicado: Administrador</p>
          <ActionButton onClick={() => setIsCreateOpen(true)}>+ Adicionar usuario</ActionButton>
        </div>

        {success ? <StatusBadge className="mt-4" tone="green">{success}</StatusBadge> : null}
        {error ? <div className="mt-4"><ErrorState title="Atencao" description={error} /></div> : null}

        <div className="mt-4 grid gap-3">
          {loading ? <LoadingState /> : null}
          {!loading && users.length === 0 ? (
            <p className="rounded-lg border border-dashed border-inest-line bg-inest-soft p-4 text-sm text-inest-muted">
              Nenhum usuario administrador encontrado.
            </p>
          ) : null}
          {users.map((user) => {
            const isActive = user.status === 'ACTIVE';
            const isUpdating = updatingUserId === user.id;

            return (
              <article
                key={user.id}
                className="grid gap-3 rounded-lg border border-inest-line bg-inest-surface p-4 md:grid-cols-[minmax(0,1fr)_auto_auto] md:items-center"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <strong className="truncate text-sm font-black text-inest-text">{user.name}</strong>
                    {user.isCurrentUser ? <StatusBadge tone="blue">Voce</StatusBadge> : null}
                  </div>
                  <p className="mt-1 truncate text-sm text-inest-muted">{user.email}</p>
                  <p className="mt-1 text-xs font-bold text-inest-muted">{user.role}</p>
                </div>
                <StatusBadge tone={isActive ? 'green' : 'gray'}>
                  {isActive ? 'ATIVO' : 'INATIVO'}
                </StatusBadge>
                <div className="flex flex-wrap gap-2 md:justify-end">
                  <ActionButton
                    variant="secondary"
                    onClick={() => openEditModal(user)}
                    disabled={isUpdating}
                  >
                    Editar
                  </ActionButton>
                  {isActive ? (
                    <ActionButton
                      variant="danger"
                      onClick={() => setSelectedUser(user)}
                      disabled={user.isCurrentUser || isUpdating}
                      title={user.isCurrentUser ? 'Voce nao pode desativar a propria conta.' : undefined}
                    >
                      {isUpdating ? 'Desativando...' : 'Desativar'}
                    </ActionButton>
                  ) : (
                    <ActionButton
                      variant="secondary"
                      onClick={() => void activate(user.id)}
                      disabled={isUpdating}
                    >
                      {isUpdating ? 'Reativando...' : 'Reativar'}
                    </ActionButton>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </SettingsCard>

      <Modal
        open={isCreateOpen}
        title="Adicionar usuario"
        onClose={closeCreateModal}
        footer={
          <>
            <ActionButton variant="secondary" onClick={closeCreateModal} disabled={creating}>
              Cancelar
            </ActionButton>
            <ActionButton type="submit" form="create-administrator-form" disabled={creating}>
              {creating ? 'Adicionando...' : 'Adicionar usuario'}
            </ActionButton>
          </>
        }
      >
        <form id="create-administrator-form" className="grid gap-4" onSubmit={handleCreate}>
          <Input
            label="Nome"
            value={form.name}
            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            autoComplete="name"
          />
          <Input
            label="E-mail"
            type="email"
            value={form.email}
            onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
            autoComplete="email"
          />
          <Input
            label="Senha"
            type="password"
            value={form.password}
            onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
            autoComplete="new-password"
            minLength={minimumPasswordLength}
          />
          <div className="rounded-lg border border-inest-line bg-inest-soft p-3 text-sm text-inest-muted">
            Perfil: <strong className="text-inest-text">Administrador</strong>
          </div>
          {formError ? <p className="text-sm font-bold text-red-600">{formError}</p> : null}
        </form>
      </Modal>

      <Modal
        open={Boolean(editingUser)}
        title="Editar usuario"
        onClose={closeEditModal}
        footer={
          <>
            <ActionButton variant="secondary" onClick={closeEditModal} disabled={Boolean(updatingUserId)}>
              Cancelar
            </ActionButton>
            <ActionButton
              type="submit"
              form="edit-administrator-form"
              disabled={Boolean(updatingUserId)}
            >
              {updatingUserId ? 'Salvando...' : 'Salvar alteracoes'}
            </ActionButton>
          </>
        }
      >
        <form id="edit-administrator-form" className="grid gap-4" onSubmit={handleEdit}>
          <Input
            label="Nome"
            value={editForm.name}
            onChange={(event) => setEditForm((current) => ({ ...current, name: event.target.value }))}
            autoComplete="name"
          />
          <Input
            label="E-mail"
            type="email"
            value={editForm.email}
            onChange={(event) => setEditForm((current) => ({ ...current, email: event.target.value }))}
            autoComplete="email"
          />
          <Input
            label="Nova senha"
            type="password"
            value={editForm.password}
            onChange={(event) => setEditForm((current) => ({ ...current, password: event.target.value }))}
            autoComplete="new-password"
            minLength={minimumPasswordLength}
          />
          <p className="text-sm text-inest-muted">Deixe a senha em branco para mante-la inalterada.</p>
          {editFormError ? <p className="text-sm font-bold text-red-600">{editFormError}</p> : null}
        </form>
      </Modal>

      <Modal
        open={Boolean(selectedUser)}
        title="Desativar acesso"
        onClose={() => (updatingUserId ? undefined : setSelectedUser(null))}
        footer={
          <>
            <ActionButton
              variant="secondary"
              onClick={() => setSelectedUser(null)}
              disabled={Boolean(updatingUserId)}
            >
              Cancelar
            </ActionButton>
            <ActionButton
              variant="danger"
              onClick={() => void confirmDeactivation()}
              disabled={Boolean(updatingUserId)}
            >
              {updatingUserId ? 'Desativando...' : 'Desativar acesso'}
            </ActionButton>
          </>
        }
      >
        <p className="leading-7 text-inest-muted">
          Desativar acesso de <strong className="text-inest-text">{selectedUser?.name}</strong>? Este
          usuario nao podera mais acessar o sistema.
        </p>
      </Modal>
    </>
  );
}
