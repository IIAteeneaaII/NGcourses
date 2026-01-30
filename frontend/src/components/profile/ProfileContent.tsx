'use client';

import Link from 'next/link';
import type { UserProfile, UserStatistics, CourseInProgress } from '@/types/course';
import styles from './ProfileContent.module.css';

interface ProfileContentProps {
  profile: UserProfile;
  statistics: UserStatistics;
  coursesInProgress: CourseInProgress[];
}

export default function ProfileContent({ profile, statistics, coursesInProgress }: ProfileContentProps) {
  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.headerContent}>
          <div className={styles.logo}>Cursos Online</div>
          <Link href="/cursos" className={styles.backButton}>
            ← Volver al Dashboard
          </Link>
        </div>
      </header>

      <main className={styles.main}>
        <h1 className={styles.pageTitle}>Mi Perfil</h1>

        <div className={styles.profileCard}>
          <div className={styles.profileHeader}>
            <div className={styles.avatar}>{profile.initials}</div>
            <div className={styles.profileInfo}>
              <h2 className={styles.profileName}>{profile.name}</h2>
              <p className={styles.profileEmail}>{profile.email}</p>
              <button className={styles.editButton}>Editar Perfil</button>
            </div>
          </div>
        </div>

        <div className={styles.statsCard}>
          <h3 className={styles.cardTitle}>Estadísticas</h3>
          <div className={styles.statsGrid}>
            <div className={styles.statItem}>
              <span className={styles.statValue}>{statistics.coursesEnrolled}</span>
              <span className={styles.statLabel}>Cursos Inscritos</span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statValue}>{statistics.coursesCompleted}</span>
              <span className={styles.statLabel}>Cursos Completados</span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statValue}>{statistics.totalTime}</span>
              <span className={styles.statLabel}>Tiempo Total</span>
            </div>
          </div>
        </div>

        <div className={styles.infoCard}>
          <h3 className={styles.cardTitle}>Información Personal</h3>
          <div className={styles.infoGrid}>
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>Nombre Completo</span>
              <span className={styles.infoValue}>{profile.name}</span>
            </div>
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>Correo Electrónico</span>
              <span className={styles.infoValueLink}>{profile.email}</span>
            </div>
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>Teléfono</span>
              <span className={styles.infoValue}>{profile.phone}</span>
            </div>
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>Departamento</span>
              <span className={styles.infoValue}>{profile.department}</span>
            </div>
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>Puesto</span>
              <span className={styles.infoValue}>{profile.position}</span>
            </div>
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>Fecha de Registro</span>
              <span className={styles.infoValue}>{profile.registrationDate}</span>
            </div>
          </div>
        </div>

        <div className={styles.coursesCard}>
          <h3 className={styles.cardTitle}>Cursos en Progreso</h3>
          <div className={styles.coursesList}>
            {coursesInProgress.map((course) => (
              <div key={course.id} className={styles.courseItem}>
                <div className={styles.courseNumber}>
                  {String(course.order).padStart(2, '0')}
                </div>
                <div className={styles.courseInfo}>
                  <span className={styles.courseTitle}>{course.title}</span>
                  <span className={styles.courseProgress}>{course.progress}% completado</span>
                </div>
                <div className={styles.progressBarContainer}>
                  <div
                    className={styles.progressBar}
                    style={{ width: `${course.progress}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
