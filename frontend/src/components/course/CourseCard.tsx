'use client';

import Link from 'next/link';
import CourseCover from '@/components/shared/CourseCover';
import type { CourseCard as CourseCardType } from '@/types/course';
import styles from './CourseCard.module.css';

interface CourseCardProps {
  course: CourseCardType;
}

function formatPrice(precio: number | null | undefined, moneda?: string): string {
  if (precio == null || Number(precio) === 0) return 'Gratis';
  const valor = Number(precio);
  const entero = Number.isInteger(valor) ? valor.toString() : valor.toFixed(2);
  return `$${entero} ${moneda || 'MXN'}`;
}

export default function CourseCard({ course }: CourseCardProps) {
  const priceLabel = formatPrice(course.precio, course.moneda);
  const isFree = priceLabel === 'Gratis';
  const getTagClass = (tag: string) => {
    switch (tag) {
      case 'Nuevo':
        return styles.tagNuevo;
      case 'Popular':
        return styles.tagPopular;
      case 'Destacado':
        return styles.tagDestacado;
      default:
        return '';
    }
  };

  const renderStars = (rating: number) => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <span key={i} className={i <= rating ? styles.star : styles.starEmpty}>
          ★
        </span>
      );
    }
    return stars;
  };

  return (
    <Link href={`/curso/${course.id}`} className={styles.card}>
      <div className={styles.imageContainer}>
        <CourseCover src={course.image} title={course.title} caption={course.level} />
        {course.bloqueadoPorLicencia && (
          <span className={styles.lockedBadge}>
            Requiere licencia
          </span>
        )}
        <span className={`${styles.priceBadge} ${isFree ? styles.priceFree : styles.pricePaid}`}>
          {priceLabel}
        </span>
      </div>

      <div className={styles.content}>
        <h3 className={styles.title}>{course.title}</h3>

        {course.tag && (
          <span className={`${styles.tag} ${getTagClass(course.tag)}`}>
            {course.tag}
          </span>
        )}

        <p className={styles.instructor}>{course.instructor}</p>

        <p className={styles.level}>
          <span className={styles.levelLabel}>Nivel:</span> {course.level}
        </p>

        <div className={styles.rating}>{renderStars(course.rating)}</div>
      </div>
    </Link>
  );
}
