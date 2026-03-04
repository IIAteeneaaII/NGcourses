'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from './page.module.css';

interface UserProfile {
  name: string;
  email: string;
  role: string;
  department: string;
  phone: string;
  registrationDate: string;
  initials: string;
}

interface UserStats {
  coursesCreated: number;
  activeInstructors: number;
  activeStudents: number;
}

interface RecentCourse {
  id: string;
  number: string;
  title: string;
  status: string;
  studentsEnrolled?: number;
}

const MOCK_PROFILE: UserProfile = {
  name: 'Laura Sanchez',
  email: 'lsanchez@pascual.com',
  role: 'Instructor de Cursos',
  department: 'Capacitacion Empresarial',
  phone: '+52 55 8765 4321',
  registrationDate: '5 de Marzo, 2024',
  initials: 'LS',
};

const MOCK_STATS: UserStats = {
  coursesCreated: 8,
  activeInstructors: 4,
  activeStudents: 245,
};

const MOCK_COURSES: RecentCourse[] = [
  {
    id: '1',
    number: '01',
    title: 'Facturacion Electronica Avanzada',
    status: 'Publicado',
    studentsEnrolled: 45,
  },
  {
    id: '2',
    number: '02',
    title: 'Gestion de Recursos Humanos',
    status: 'Publicado',
    studentsEnrolled: 38,
  },
  {
    id: '3',
    number: '03',
    title: 'Solicitud de Creditos Empresariales',
    status: 'Borrador',
  },
];

export default function PerfilInstructorPage() {
  const router = useRouter();
  const [profile] = useState<UserProfile>(MOCK_PROFILE);
  const [stats] = useState<UserStats>(MOCK_STATS);
  const [courses] = useState<RecentCourse[]>(MOCK_COURSES);

  const handleEditProfile = () => {
    alert('Funcionalidad de edicion de perfil en desarrollo');
  };

  return (
    <div className={styles.pageContainer}>
      <button
        className={styles.backButton}
        onClick={() => router.push('/instructor')}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
        Volver al dashboard
      </button>

      <div className={styles.profileContainer}>
        {/* Profile Header */}
        <div className={styles.profileHeader}>
          <div className={styles.avatarLarge}>{profile.initials}</div>
          <div className={styles.profileInfo}>
            <h1 className={styles.profileName}>{profile.name}</h1>
            <p className={styles.profileEmail}>{profile.email}</p>
            <button
              className={styles.editProfileButton}
              onClick={handleEditProfile}
            >
              Editar Perfil
            </button>
          </div>
        </div>

        <div className={styles.profileSections}>
          {/* Estadisticas */}
          <div className={styles.profileSection}>
            <h3 className={styles.sectionTitle}>Estadisticas</h3>
            <div className={styles.statsGrid}>
              <div className={styles.statCard}>
                <div className={styles.statNumber}>{stats.coursesCreated}</div>
                <div className={styles.statLabel}>Cursos Creados</div>
              </div>
              <div className={styles.statCard}>
                <div className={styles.statNumber}>{stats.activeInstructors}</div>
                <div className={styles.statLabel}>Instructores Activos</div>
              </div>
              <div className={styles.statCard}>
                <div className={styles.statNumber}>{stats.activeStudents}</div>
                <div className={styles.statLabel}>Alumnos Activos</div>
              </div>
            </div>
          </div>

          {/* Informacion Personal */}
          <div className={styles.profileSection}>
            <h3 className={styles.sectionTitle}>Informacion Personal</h3>
            <div className={styles.infoGrid}>
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Nombre Completo</span>
                <div className={styles.infoValue}>{profile.name}</div>
              </div>
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Correo Electronico</span>
                <div className={styles.infoValue}>{profile.email}</div>
              </div>
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Rol</span>
                <div className={styles.infoValue}>{profile.role}</div>
              </div>
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Departamento</span>
                <div className={styles.infoValue}>{profile.department}</div>
              </div>
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Telefono</span>
                <div className={styles.infoValue}>{profile.phone}</div>
              </div>
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Fecha de Registro</span>
                <div className={styles.infoValue}>{profile.registrationDate}</div>
              </div>
            </div>
          </div>

          {/* Cursos Recientes */}
          <div className={styles.profileSection}>
            <h3 className={styles.sectionTitle}>Cursos Creados Recientemente</h3>
            <div className={styles.courseList}>
              {courses.map((course) => (
                <div key={course.id} className={styles.courseItem}>
                  <div className={styles.courseItemInfo}>
                    <div className={styles.courseIcon}>{course.number}</div>
                    <div className={styles.courseDetails}>
                      <div className={styles.courseItemTitle}>{course.title}</div>
                      <div className={styles.courseStatus}>
                        {course.status}
                        {course.studentsEnrolled &&
                          ` - ${course.studentsEnrolled} estudiantes inscritos`}
                      </div>
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
