'use client';

import { useState } from 'react';
import Link from 'next/link';
import StudentHeader from '@/components/shared/StudentHeader';
import { certificadosApi } from '@/lib/api/client';
import { logError } from '@/lib/logger';
import styles from './CertificatesContent.module.css';

export interface StudentCertificate {
  folio: string;
  courseId: string;
  courseTitle: string;
  marca?: 'ram' | 'nextgen';
  issuedAt: string;
  /** El curso tiene lecciones nuevas sin completar: la descarga no está disponible. */
  pending?: boolean;
}

export interface UpcomingCertificate {
  courseId: string;
  courseTitle: string;
  progress: number;
  /** null si no se pudo leer el progreso. */
  lessonsLeft: number | null;
}

interface CertificatesContentProps {
  studentName: string;
  certificates: StudentCertificate[];
  upcoming: UpcomingCertificate[];
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const cleanTitle = (t: string) => t.trim().replace(/\.$/, '');

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default function CertificatesContent({ studentName, certificates, upcoming }: CertificatesContentProps) {
  const [downloading, setDownloading] = useState<string | null>(null);
  // Mensaje por folio (resultado de descargar o copiar), mostrado bajo la tarjeta.
  const [messages, setMessages] = useState<Record<string, string>>({});

  const setMessage = (folio: string, text: string) =>
    setMessages((prev) => ({ ...prev, [folio]: text }));

  const handleDownload = async (folio: string) => {
    setDownloading(folio);
    setMessage(folio, '');
    try {
      await certificadosApi.descargar(folio);
    } catch (e) {
      const err = e as { detail?: string; status?: number };
      // CP20: el backend responde 409 si el curso recibió contenido nuevo y hay
      // lecciones pendientes. Es un caso esperado: solo se registran los demás.
      if (err?.status !== 409) logError('CertificatesContent/descargar', e);
      setMessage(folio, err?.detail || 'No se pudo descargar el certificado. Inténtalo de nuevo.');
    } finally {
      setDownloading(null);
    }
  };

  const handleCopy = async (folio: string) => {
    try {
      await navigator.clipboard.writeText(folio);
      setMessage(folio, 'Folio copiado');
    } catch {
      setMessage(folio, `No se pudo copiar. Folio: ${folio}`);
    }
  };

  return (
    <div className={styles.container}>
      <StudentHeader />

      <main className={styles.main}>
        <section className={styles.pageHead} aria-labelledby="certs-title">
          <h1 id="certs-title" className={styles.pageTitle}>Certificados</h1>
          <p className={styles.pageSubtitle}>
            {certificates.length > 0
              ? `${plural(certificates.length, 'certificado emitido', 'certificados emitidos')}. Descárgalos en PDF o comparte el folio para que lo verifiquen.`
              : 'Aún no tienes certificados.'}
          </p>
        </section>

        {certificates.length > 0 ? (
          <div className={styles.grid}>
            {certificates.map((cert) => {
              const title = cleanTitle(cert.courseTitle);
              const isDownloading = downloading === cert.folio;
              return (
                <article key={cert.folio} className={styles.card}>
                  {/* Vista previa del documento: hoja apaisada con marco fino, como el PDF. */}
                  <div className={styles.sheet} aria-hidden="true">
                    <div className={styles.sheetInner}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src="/images/logo.png" alt="" className={styles.sheetLogo} />
                      <span className={styles.sheetKicker}>Certificado de finalización</span>
                      <span className={styles.sheetName}>{studentName}</span>
                      <span className={styles.sheetRule} />
                      <span className={styles.sheetCourse}>
                        completó el curso <b>{title}</b>
                      </span>
                    </div>
                  </div>

                  <div className={styles.info}>
                    <h2 className={styles.cardTitle}>
                      <Link href={`/curso/${cert.courseId}`}>{title}</Link>
                    </h2>
                    <p className={styles.meta}>Emitido el {formatDate(cert.issuedAt)}</p>
                    <p className={styles.meta}>
                      Folio <span className={styles.folio}>{cert.folio}</span>
                    </p>
                  </div>

                  <div className={styles.actions}>
                    {!cert.pending && (
                      <button
                        type="button"
                        className={`${styles.btn} ${styles.btnPrimary}`}
                        onClick={() => handleDownload(cert.folio)}
                        disabled={isDownloading}
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v11m0 0l-4.5-4.5M12 15l4.5-4.5M5 20h14" />
                        </svg>
                        {isDownloading ? 'Descargando…' : 'Descargar PDF'}
                      </button>
                    )}
                    <button
                      type="button"
                      className={`${styles.btn} ${styles.btnGhost}`}
                      onClick={() => handleCopy(cert.folio)}
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
                        <rect x="9" y="9" width="11" height="11" rx="2" />
                        <path d="M5 15V6a2 2 0 012-2h9" />
                      </svg>
                      Copiar folio
                    </button>
                  </div>

                  <p className={styles.message} role="status">
                    {messages[cert.folio] ||
                      (cert.pending
                        ? 'El curso tiene lecciones nuevas. Complétalas para volver a descargar tu certificado.'
                        : '')}
                  </p>
                </article>
              );
            })}
          </div>
        ) : (
          <div className={styles.empty}>
            <p>Termina un curso para obtener tu primer certificado.</p>
            <Link href="/mis-cursos" className={`${styles.btn} ${styles.btnGhost}`}>
              Ver mi progreso
            </Link>
          </div>
        )}

        {upcoming.length > 0 && (
          <section aria-labelledby="upcoming-title">
            <div className={styles.sectionHead}>
              <h2 id="upcoming-title" className={styles.sectionTitle}>Próximos certificados</h2>
              <span className={styles.sectionCount}>{plural(upcoming.length, 'curso', 'cursos')}</span>
            </div>
            <div className={styles.upcoming}>
              {upcoming.map((u) => {
                const title = cleanTitle(u.courseTitle);
                return (
                  <Link key={u.courseId} href={`/curso/${u.courseId}/videos`} className={styles.upRow}>
                    <span className={styles.upTitle}>{title}</span>
                    <span className={styles.upProgress}>
                      <span
                        className={styles.track}
                        role="progressbar"
                        aria-label={`Avance en ${title}`}
                        aria-valuenow={u.progress}
                        aria-valuemin={0}
                        aria-valuemax={100}
                      >
                        <span className={styles.fill} style={{ width: `${u.progress}%` }} />
                      </span>
                    </span>
                    <span className={styles.upLeft}>
                      {u.lessonsLeft != null
                        ? `${plural(u.lessonsLeft, 'lección', 'lecciones')} para terminar`
                        : `${u.progress} %`}
                    </span>
                  </Link>
                );
              })}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
