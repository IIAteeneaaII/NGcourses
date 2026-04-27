'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import type { CourseInfo } from '@/types/course';
import PayPalCheckout from './PayPalCheckout';
import styles from './CourseInfoContent.module.css';

interface CourseInfoContentProps {
  course: CourseInfo;
  isEnrolled?: boolean;
  onInscribirse?: () => void;
  onPaymentSuccess?: () => void;
  enrollLoading?: boolean;
  backHref?: string;
  bloqueadoPorLicencia?: boolean;
}

function formatPrice(precio: number | null | undefined, moneda?: string): { label: string; isFree: boolean } {
  if (precio == null || Number(precio) === 0) return { label: 'Gratis', isFree: true };
  const valor = Number(precio);
  const entero = Number.isInteger(valor) ? valor.toString() : valor.toFixed(2);
  return { label: `$${entero} ${moneda || 'MXN'}`, isFree: false };
}

export default function CourseInfoContent({ course, isEnrolled, onInscribirse, onPaymentSuccess, enrollLoading, backHref = '/cursos', bloqueadoPorLicencia }: CourseInfoContentProps) {
  const [imgSrc, setImgSrc] = useState(course.image);
  const price = formatPrice(course.precio, course.moneda);
  const requierePago = !price.isFree;

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.headerContent}>
          <div className={styles.logo}>Cursos Online</div>
          <Link href={backHref} className={styles.navLink}>
            Cursos
          </Link>
        </div>
      </header>

      <main className={styles.main}>
        <div className={styles.backButtonContainer}>
          <Link href={backHref} className={styles.backButton}>
            ← Volver
          </Link>
        </div>

        <div className={styles.courseCard}>
          <h1 className={styles.courseTitle}>{course.title}</h1>

          <div className={styles.courseHeader}>
            <Image
              src={imgSrc}
              alt={course.title}
              width={280}
              height={180}
              unoptimized
              className={styles.courseImage}
              onError={() => setImgSrc('/placeholder-course.jpg')}
            />

            <div className={styles.courseInfo}>
              <h2 className={styles.courseInfoTitle}>Información del curso</h2>

              <div className={styles.courseInfoItem}>
                <span className={styles.courseInfoLabel}>Instructor:</span>
                <span className={styles.courseInfoValue}>{course.instructor} | {course.rating}/5</span>
              </div>

              <div className={styles.courseInfoItem}>
                <span className={styles.courseInfoLabel}>Nivel:</span>
                <span className={styles.courseInfoValue}>{course.level}</span>
              </div>

              <div className={styles.courseInfoItem}>
                <span className={styles.courseInfoLabel}>Duración:</span>
                <span className={styles.courseInfoValue}>{course.duration}</span>
              </div>

              <div className={styles.courseInfoItem}>
                <span className={styles.courseInfoLabel}>Lecciones:</span>
                <span className={styles.courseInfoValue}>{course.lessonsCount}</span>
              </div>

              <div className={styles.priceBlock}>
                <span className={styles.priceLabel}>Precio</span>
                <span className={`${styles.priceValue} ${price.isFree ? styles.priceFree : ''}`}>
                  {price.label}
                </span>
              </div>
            </div>
          </div>

          <div className={styles.sectionsGrid}>
            <div className={styles.section}>
              <h3 className={styles.sectionTitle}>Descripción</h3>
              <p className={styles.sectionText}>{course.description}</p>
            </div>

            <div className={styles.section}>
              <h3 className={styles.sectionTitle}>Lo que aprenderás</h3>
              <ul className={styles.sectionList}>
                {course.learningOutcomes.map((outcome, index) => (
                  <li key={index}>{outcome}</li>
                ))}
              </ul>
            </div>

            <div className={styles.section}>
              <h3 className={styles.sectionTitle}>Requisitos</h3>
              <p className={styles.sectionText}>{course.requirements}</p>
            </div>

            <div className={styles.section}>
              <h3 className={styles.sectionTitle}>Temario</h3>
              <ul className={styles.temarioList}>
                {course.syllabus.map((item, index) => (
                  <li key={index} className={styles.temarioItem}>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className={styles.actionsContainer}>
            {isEnrolled ? (
              <Link href={`/curso/${course.id}/videos`} className={styles.startButton}>
                Continuar curso
              </Link>
            ) : requierePago ? (
              // Precio > 0: PayPal tiene prioridad sobre el bloqueo de licencia, ya que
              // RF10 permite que cualquier alumno compre el curso individualmente.
              <PayPalCheckout
                cursoId={course.id}
                monedaCurso={course.moneda}
                onSuccess={() => {
                  if (onPaymentSuccess) onPaymentSuccess();
                }}
              />
            ) : bloqueadoPorLicencia ? (
              <div className={styles.lockedBlock} role="status" aria-live="polite">
                <h3 className={styles.lockedTitle}>Curso no disponible</h3>
                <p className={styles.lockedMessage}>
                  Tu organización no ha adquirido este curso. Contacta a tu administrador para más información.
                </p>
              </div>
            ) : (
              onInscribirse && (
                <button
                  className={styles.startButton}
                  onClick={onInscribirse}
                  disabled={enrollLoading}
                >
                  {enrollLoading ? 'Inscribiendo...' : 'Inscribirme gratis'}
                </button>
              )
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
