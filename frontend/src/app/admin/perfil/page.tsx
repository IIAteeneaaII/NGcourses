'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { authApi, cursosApi, usersApi } from '@/lib/api/client';
import styles from './page.module.css';

interface ApiUser {
  id: string;
  full_name: string | null;
  email: string;
  telefono: string | null;
  rol: string;
}

interface ApiCursosResp {
  count: number;
  data: unknown[];
}

interface ApiUsersResp {
  count: number;
  data: unknown[];
}

export default function PerfilAdminPage() {
  const router = useRouter();
  const [user, setUser] = useState<ApiUser | null>(null);
  const [stats, setStats] = useState({ coursesCreated: 0, activeStudents: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [userRaw, cursosResp, usersResp] = await Promise.all([
          authApi.me() as Promise<ApiUser>,
          cursosApi.list({ limit: 1 }) as Promise<ApiCursosResp>,
          usersApi.list({ limit: 1 }) as Promise<ApiUsersResp>,
        ]);
        setUser(userRaw);
        setStats({
          coursesCreated: cursosResp.count ?? 0,
          activeStudents: usersResp.count ?? 0,
        });
      } catch {
        // fallo silencioso
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <span>Cargando...</span>
      </div>
    );
  }

  const nombre = user?.full_name || user?.email?.split('@')[0] || 'Admin';
  const initials = nombre.split(' ').slice(0, 2).map((w: string) => w[0]?.toUpperCase() ?? '').join('') || 'A';

  return (
    <div className={styles.pageContainer}>
      <button className={styles.backButton} onClick={() => router.push('/admin')}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
        Volver a opciones
      </button>

      <div className={styles.profileContainer}>
        <div className={styles.profileHeader}>
          <div className={styles.avatarLarge}>{initials}</div>
          <div className={styles.profileInfo}>
            <h1 className={styles.profileName}>{nombre}</h1>
            <p className={styles.profileEmail}>{user?.email ?? ''}</p>
          </div>
        </div>

        <div className={styles.profileSections}>
          <div className={styles.profileSection}>
            <h3 className={styles.sectionTitle}>Estadisticas</h3>
            <div className={styles.statsGrid}>
              <div className={styles.statCard}>
                <div className={styles.statNumber}>{stats.coursesCreated}</div>
                <div className={styles.statLabel}>Cursos en plataforma</div>
              </div>
              <div className={styles.statCard}>
                <div className={styles.statNumber}>{stats.activeStudents}</div>
                <div className={styles.statLabel}>Usuarios registrados</div>
              </div>
            </div>
          </div>

          <div className={styles.profileSection}>
            <h3 className={styles.sectionTitle}>Informacion Personal</h3>
            <div className={styles.infoGrid}>
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Nombre Completo</span>
                <div className={styles.infoValue}>{nombre}</div>
              </div>
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Correo Electronico</span>
                <div className={styles.infoValue}>{user?.email ?? ''}</div>
              </div>
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Rol</span>
                <div className={styles.infoValue}>{user?.rol ?? 'administrador'}</div>
              </div>
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Telefono</span>
                <div className={styles.infoValue}>{user?.telefono || '—'}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
