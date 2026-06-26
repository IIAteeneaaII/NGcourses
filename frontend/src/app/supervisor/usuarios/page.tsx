'use client';

import { useCallback, useEffect, useState } from 'react';
import { supervisorApi } from '@/lib/api/client';
import { logError } from '@/lib/logger';
import styles from './page.module.css';

interface SupervisorUser {
  id: string;
  email: string;
  full_name: string | null;
  telefono: string | null;
  is_active: boolean;
  rol_org: string;
  progreso_promedio: number;
  cursos_inscritos: number;
}

export default function SupervisorUsuariosPage() {
  const [users, setUsers] = useState<SupervisorUser[]>([]);
  const [loading, setLoading] = useState(true);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await supervisorApi.usuarios() as SupervisorUser[];
      setUsers(data);
    } catch (e) {
      logError('supervisor.usuarios', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const handleQuitar = async (user_id: string) => {
    if (!confirm('¿Quitar este usuario de la organización?')) return;
    try {
      await supervisorApi.quitarUsuario(user_id);
      loadUsers();
    } catch (e) {
      logError('supervisor.quitarUsuario', e);
      alert((e as { detail?: string })?.detail || 'No se pudo quitar al usuario.');
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Usuarios</h1>
          <p className={styles.subtitle}>Usuarios de tu organización</p>
        </div>
      </div>

      <section className={styles.card}>
        <div className={styles.tableContainer}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Email</th>
                <th>Estado</th>
                <th>Progreso</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className={styles.emptyState}>Cargando...</td></tr>
              ) : users.length > 0 ? (
                users.map((u) => (
                  <tr key={u.id}>
                    <td>{u.full_name || '—'}</td>
                    <td>{u.email}</td>
                    <td>
                      <span className={`${styles.statusText} ${u.is_active ? styles.active : styles.inactive}`}>
                        {u.is_active ? 'Activo' : 'Suspendido'}
                      </span>
                    </td>
                    <td>{Math.round(u.progreso_promedio)}%</td>
                    <td>
                      {u.rol_org === 'admin_org' ? (
                        <span className={styles.statusText}>Supervisor</span>
                      ) : (
                        <button className={styles.deleteButton} onClick={() => handleQuitar(u.id)}>
                          Quitar
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan={5} className={styles.emptyState}>Sin usuarios en tu organización</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
