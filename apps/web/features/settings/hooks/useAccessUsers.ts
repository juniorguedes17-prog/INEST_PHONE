'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  activateAccessUser,
  createAdministrator,
  deactivateAccessUser,
  listAccessUsers,
} from '../services/users-service';
import { AccessUser, CreateAdministratorInput } from '../types/users';

export function useAccessUsers() {
  const [users, setUsers] = useState<AccessUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      setUsers(await listAccessUsers());
    } catch (usersError) {
      setError(
        usersError instanceof Error
          ? usersError.message
          : 'Nao foi possivel carregar os usuarios.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function create(input: CreateAdministratorInput) {
    setCreating(true);
    setError(null);
    setSuccess(null);

    try {
      const user = await createAdministrator(input);
      setUsers((current) => [...current, user]);
      setSuccess('Usuario adicionado com sucesso.');
      return true;
    } catch (usersError) {
      setError(
        usersError instanceof Error
          ? usersError.message
          : 'Nao foi possivel adicionar o usuario.',
      );
      return false;
    } finally {
      setCreating(false);
    }
  }

  async function deactivate(id: string) {
    setUpdatingUserId(id);
    setError(null);
    setSuccess(null);

    try {
      const user = await deactivateAccessUser(id);
      setUsers((current) => current.map((item) => (item.id === id ? user : item)));
      setSuccess('Acesso desativado.');
      return true;
    } catch (usersError) {
      setError(
        usersError instanceof Error
          ? usersError.message
          : 'Nao foi possivel desativar o acesso.',
      );
      return false;
    } finally {
      setUpdatingUserId(null);
    }
  }

  async function activate(id: string) {
    setUpdatingUserId(id);
    setError(null);
    setSuccess(null);

    try {
      const user = await activateAccessUser(id);
      setUsers((current) => current.map((item) => (item.id === id ? user : item)));
      setSuccess('Acesso reativado.');
      return true;
    } catch (usersError) {
      setError(
        usersError instanceof Error
          ? usersError.message
          : 'Nao foi possivel reativar o acesso.',
      );
      return false;
    } finally {
      setUpdatingUserId(null);
    }
  }

  return {
    users,
    loading,
    creating,
    updatingUserId,
    error,
    success,
    reload,
    create,
    deactivate,
    activate,
  };
}
