'use client';

import Link from 'next/link';
import CourseCover from '@/components/shared/CourseCover';
import type { CourseCard as CourseCardType } from '@/types/course';
import styles from './CourseCard.module.css';

interface CourseCardProps {
  course: CourseCardType;
}

const LEVEL_STEPS: Record<string, number> = {
  Principiante: 1,
  Intermedio: 2,
  Avanzado: 3,
};

function formatPrice(precio: number | null | undefined, moneda?: string): string | null {
  if (precio == null || Number(precio) === 0) return null;
  const valor = Number(precio);
  const entero = Number.isInteger(valor) ? valor.toString() : valor.toFixed(2);
  return `$${entero} ${moneda || 'MXN'}`;
}

export default function CourseCard({ course }: CourseCardProps) {
  // Solo se marca el precio cuando hay que pagar: en el catálogo del alumno casi
  // todo es gratuito y un badge "Gratis" en cada tarjeta es ruido.
  const priceLabel = course.esGratis ? null : formatPrice(course.precio, course.moneda);
  const steps = LEVEL_STEPS[course.level] ?? 0;
  const title = course.title.trim().replace(/\.$/, '');

  return (
    <Link href={`/curso/${course.id}`} className={styles.card}>
      <div className={styles.imageContainer}>
        <CourseCover
          src={course.image}
          title={course.title}
          caption={course.category}
          variant="grid"
          tone={course.marca === 'ram' ? 'ram' : 'nextgen'}
        />
        <div className={styles.badges}>
          {course.bloqueadoPorLicencia && (
            <span className={`${styles.badge} ${styles.badgeLocked}`}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} aria-hidden="true">
                <rect x="5" y="11" width="14" height="10" rx="2" />
                <path d="M8 11V7a4 4 0 018 0v4" />
              </svg>
              Requiere licencia
            </span>
          )}
          {course.enrolled && (
            <span className={styles.badge}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} aria-hidden="true" className={styles.badgeCheck}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 12.5l4.5 4.5L19 7.5" />
              </svg>
              Inscrito
            </span>
          )}
          {priceLabel && <span className={styles.badge}>{priceLabel}</span>}
        </div>
      </div>

      <div className={styles.content}>
        {course.tag && <span className={styles.tag}>{course.tag}</span>}

        <h3 className={styles.title}>{title}</h3>

        {course.category && <p className={styles.meta}>{course.category}</p>}

        <div className={styles.footer}>
          {steps > 0 ? (
            <span className={styles.level}>
              <span className={styles.meter} aria-hidden="true">
                {[1, 2, 3].map((i) => (
                  <i key={i} className={i <= steps ? styles.meterOn : undefined} />
                ))}
              </span>
              {course.level}
            </span>
          ) : (
            <span />
          )}

          {course.rating > 0 && (course.reviews ?? 0) > 0 && (
            <span
              className={styles.rating}
              aria-label={`Calificación ${course.rating.toFixed(1)} de 5, ${course.reviews} reseñas`}
            >
              <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M12 17.3l-6.2 3.7 1.7-7L2 9.2l7.2-.6L12 2l2.8 6.6 7.2.6-5.5 4.8 1.7 7z" />
              </svg>
              {course.rating.toFixed(1)} <span className={styles.ratingCount}>({course.reviews})</span>
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
