'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { authApi, cursosApi } from '@/lib/api/client';
import styles from './page.module.css';

interface ApiUser {
  id: string;
  full_name: string | null;
  email: string;
  telefono: string | null;
  rol: string;
}

interface ApiCurso {
  id: string;
  titulo: string;
  estado: string;
}

interface ApiCursosResp {
  data: ApiCurso[];
  count: number;
}

export default function PerfilInstructorPage() {
  const router = useRouter();
  const [user, setUser] = useState<ApiUser | null>(null);
  const [cursos, setCursos] = useState<ApiCurso[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [userRaw, cursosResp] = await Promise.all([
          authApi.me() as Promise<ApiUser>,
          cursosApi.list({ limit: 5 }) as Promise<ApiCursosResp>,
        ]);
        setUser(userRaw);
        setCursos(cursosResp.data);
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

  const nombre = user?.full_name || user?.email?.split('@')[0] || 'Instructor';
  const initials = nombre.split(' ').slice(0, 2).map((w: string) => w[0]?.toUpperCase() ?? '').join('') || 'I';

  return (
    <div className={styles.pageContainer}>
      <button className={styles.backButton} onClick={() => router.push('/instructor')}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
        Volver al dashboard
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
                <div className={styles.statNumber}>{cursos.length}</div>
                <div className={styles.statLabel}>Cursos Creados</div>
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
                <div className={styles.infoValue}>{user?.rol ?? 'instructor'}</div>
              </div>
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Telefono</span>
                <div className={styles.infoValue}>{user?.telefono || '—'}</div>
              </div>
            </div>
          </div>

          <div className={styles.profileSection}>
            <h3 className={styles.sectionTitle}>Cursos Recientes</h3>
            <div className={styles.courseList}>
              {cursos.map((curso, idx) => (
                <div key={curso.id} className={styles.courseItem}>
                  <div className={styles.courseItemInfo}>
                    <div className={styles.courseIcon}>{String(idx + 1).padStart(2, '0')}</div>
                    <div className={styles.courseDetails}>
                      <div className={styles.courseItemTitle}>{curso.titulo}</div>
                      <div className={styles.courseStatus}>{curso.estado}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
