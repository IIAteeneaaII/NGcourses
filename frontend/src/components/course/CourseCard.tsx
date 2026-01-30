import Link from 'next/link';
import Image from 'next/image';
import type { CourseCard as CourseCardType } from '@/types/course';
import styles from './CourseCard.module.css';

interface CourseCardProps {
  course: CourseCardType;
}

export default function CourseCard({ course }: CourseCardProps) {
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
        <Image
          src={course.image}
          alt={course.title}
          fill
          className={styles.image}
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
        />
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
