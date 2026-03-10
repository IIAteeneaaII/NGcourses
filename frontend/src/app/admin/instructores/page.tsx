'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { usersApi, cursosApi } from '@/lib/api/client';
import styles from './page.module.css';

interface ApiUser {
  id: string;
  full_name: string | null;
  email: string;
  estado: 'activo' | 'suspendido';
}

interface ApiUsersResp {
  data: ApiUser[];
  count: number;
}

interface ApiCurso {
  id: string;
  titulo: string;
  instructor_id: string;
}

interface ApiCursosResp {
  data: ApiCurso[];
  count: number;
}

interface InstructorCard {
  id: string;
  name: string;
  email: string;
  initials: string;
  status: 'active' | 'inactive';
  courses: { id: string; title: string }[];
}

export default function AdminInstructoresPage() {
  const router = useRouter();
  const [instructors, setInstructors] = useState<InstructorCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const [usersResp, cursosResp] = await Promise.all([
          usersApi.list({ rol: 'instructor', limit: 200 }) as Promise<ApiUsersResp>,
          cursosApi.list({ limit: 500 }) as Promise<ApiCursosResp>,
        ]);

        const mapped: InstructorCard[] = usersResp.data.map((u) => {
          const nombre = u.full_name || u.email.split('@')[0];
          const initials = nombre.split(' ').slice(0, 2).map((w: string) => w[0]?.toUpperCase() ?? '').join('');
          const courses = cursosResp.data
            .filter((c) => c.instructor_id === u.id)
            .map((c) => ({ id: c.id, title: c.titulo }));
          return {
            id: u.id,
            name: nombre,
            email: u.email,
            initials: initials || '?',
            status: u.estado === 'activo' ? 'active' : 'inactive',
            courses,
          };
        });

        setInstructors(mapped);
      } catch {
        setInstructors([]);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const filtered = instructors.filter((i) =>
    i.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    i.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className={styles.pageContainer}>
      <div className={styles.headerBar}>
        <button className={styles.backButton} onClick={() => router.push('/admin')}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Volver a opciones
        </button>
      </div>

      <div className={styles.titleSection}>
        <h1 className={styles.pageTitle}>Instructores</h1>
        <p className={styles.pageSubtitle}>Todos los instructores registrados en la plataforma</p>
      </div>

      <div className={styles.searchContainer}>
        <div className={styles.searchInputWrapper}>
          <svg className={styles.searchIcon} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            type="text"
            className={styles.searchInput}
            placeholder="Buscar instructor por nombre o email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <div style={{ padding: '2rem', textAlign: 'center' }}>Cargando...</div>
      ) : (
        <div className={styles.instructorsGrid}>
          {filtered.length === 0 && (
            <div className={styles.emptyState}>
              <p>No se encontraron instructores.</p>
            </div>
          )}
          {filtered.map((instructor) => (
            <div key={instructor.id} className={styles.instructorCard}>
              <div className={styles.cardTop}>
                <div className={styles.instructorHeader}>
                  <div className={styles.avatar}>{instructor.initials}</div>
                  <div className={styles.instructorInfo}>
                    <h3 className={styles.instructorName}>{instructor.name}</h3>
                    <p className={styles.instructorEmail}>{instructor.email}</p>
                  </div>
                </div>
                <div className={styles.cardActions}>
                  <span className={`${styles.statusBadge} ${instructor.status === 'active' ? styles.statusActive : styles.statusInactive}`}>
                    {instructor.status === 'active' ? 'Activo' : 'Inactivo'}
                  </span>
                  <Link href={`/admin/usuarios/${instructor.id}/editar`} className={styles.editButton}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                    Editar
                  </Link>
                </div>
              </div>

              <div className={styles.statsRow}>
                <span className={styles.statItem}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                  </svg>
                  {instructor.courses.length} cursos
                </span>
              </div>

              <button className={styles.expandButton} onClick={() => setExpandedId((prev) => prev === instructor.id ? null : instructor.id)}>
                <span>{expandedId === instructor.id ? 'Ocultar cursos' : 'Ver cursos'}</span>
                <svg className={`${styles.expandIcon} ${expandedId === instructor.id ? styles.expandIconRotated : ''}`} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>

              {expandedId === instructor.id && (
                <div className={styles.coursesList}>
                  <h4 className={styles.coursesListTitle}>Cursos asignados</h4>
                  {instructor.courses.length === 0 ? (
                    <p className={styles.noCourses}>Sin cursos asignados.</p>
                  ) : (
                    <ul className={styles.coursesUl}>
                      {instructor.courses.map((course) => (
                        <li key={course.id} className={styles.courseItem}>
                          <div className={styles.courseInfo}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                            </svg>
                            <span className={styles.courseTitle}>{course.title}</span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
