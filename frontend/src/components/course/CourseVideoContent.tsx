'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import VideoPlayer from '@/components/video/VideoPlayer';
import LessonsSidebar from '@/components/course/LessonsSidebar';
import VideoControls from '@/components/course/VideoControls';
import QuizPlayer from '@/components/course/QuizPlayer';
import type { Course, Lesson, QuizData } from '@/types/course';
import { progresoApi, certificadosApi } from '@/lib/api/client';
import { logError } from '@/lib/logger';
import styles from './CourseVideoContent.module.css';

interface CourseVideoContentProps {
  initialCourse: Course;
  inscripcionId?: string | null;
  bunnyLibraryId?: string | null;
  backHref?: string;
  /** Vista previa de admin/instructor: el quiz se califica localmente sin inscripción. */
  previewMode?: boolean;
}

interface CompletionModal {
  folio: string | null;
  loading: boolean;
}

export default function CourseVideoContent({ initialCourse, inscripcionId, bunnyLibraryId, backHref, previewMode }: CourseVideoContentProps) {
  const router = useRouter();
  const [course, setCourse] = useState<Course>(initialCourse);
  const [currentLesson, setCurrentLesson] = useState<Lesson | null>(
    course.modules.flatMap((m) => m.lessons)[0] ?? null
  );
  const [progress, setProgress] = useState(course.progress);
  const [completionModal, setCompletionModal] = useState<CompletionModal | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [certFolio, setCertFolio] = useState<string | null>(null);

  // Para throttle del tracking: cada 10 segundos
  const lastSentTime = useRef<number>(0);
  const videoDuration = useRef<number>(0);

  useEffect(() => {
    if (initialCourse.progress !== 100) return;
    (certificadosApi.mis() as Promise<{ data: { curso_id: string; folio: string; url_pdf: string | null }[] }>)
      .then((resp) => {
        const cert = resp.data.find((c) => c.curso_id === initialCourse.id);
        if (cert) setCertFolio(cert.folio);
      })
      .catch(() => {});
  }, [initialCourse.id, initialCourse.progress]);

  const resolvedLibraryId = bunnyLibraryId || process.env.NEXT_PUBLIC_BUNNY_LIBRARY_ID || '';
  const bunnyConfig = currentLesson && !currentLesson.videoUrl && currentLesson.videoId && resolvedLibraryId
    ? {
        libraryId: resolvedLibraryId,
        videoId: currentLesson.videoId,
      }
    : undefined;

  const handleLessonSelect = (lesson: Lesson) => {
    setCurrentLesson(lesson);
    lastSentTime.current = 0;
  };

  const handleTimeUpdate = useCallback((currentTime: number) => {
    if (!inscripcionId || !currentLesson) return;
    const now = Date.now();
    if (now - lastSentTime.current < 10_000) return; // throttle 10s
    lastSentTime.current = now;

    const duration = videoDuration.current || 1;
    const pct = Math.min(100, Math.round((currentTime / duration) * 100));

    progresoApi.registrar({
      inscripcion_id: inscripcionId,
      leccion_id: currentLesson.id,
      visto_seg: Math.round(currentTime),
      progreso_pct: pct,
    }).catch((e) => logError('CourseVideoContent/handleTimeUpdate', e));
  }, [inscripcionId, currentLesson]);

  const handleMarkComplete = async () => {
    if (!currentLesson) return;
    if (currentLesson.completed) return;

    const updatedModules = course.modules.map((module) => ({
      ...module,
      lessons: module.lessons.map((lesson) =>
        lesson.id === currentLesson.id ? { ...lesson, completed: true } : lesson
      ),
    }));

    const totalLessons = updatedModules.reduce((acc, mod) => acc + mod.lessons.length, 0);
    const completedLessons = updatedModules.reduce(
      (acc, mod) => acc + mod.lessons.filter((l) => l.completed).length,
      0
    );
    const newProgress = Math.round((completedLessons / totalLessons) * 100);

    const updatedLesson = updatedModules.flatMap((m) => m.lessons).find((l) => l.id === currentLesson.id);
    if (updatedLesson) setCurrentLesson(updatedLesson);

    setCourse({ ...course, modules: updatedModules, progress: newProgress });
    setProgress(newProgress);

    if (newProgress === 100 && inscripcionId) {
      // El certificado se emite de forma síncrona al registrar el 100%; basta
      // con leer el folio. La descarga regenera el PDF si hiciera falta, así
      // que NO se gatea por url_pdf ni se espera con un sleep arbitrario.
      setCompletionModal({ folio: null, loading: true });
      try {
        await progresoApi.registrar({
          inscripcion_id: inscripcionId,
          leccion_id: currentLesson.id,
          visto_seg: videoDuration.current || 0,
          progreso_pct: 100,
        });
        const resp = await (certificadosApi.mis() as Promise<{ data: { curso_id: string; folio: string; url_pdf: string | null }[] } | undefined>);
        // El certificado puede no existir aún (p.ej. el perfil no tiene un nombre
        // válido — CP20). En ese caso el modal se muestra sin folio de descarga.
        const cert = resp?.data?.find((c) => c.curso_id === course.id);
        setCompletionModal({ folio: cert?.folio ?? null, loading: false });
        if (cert?.folio) setCertFolio(cert.folio);
      } catch (e) {
        logError('CourseVideoContent/completionModal', e);
        setCompletionModal({ folio: null, loading: false });
      }
    } else if (inscripcionId) {
      progresoApi.registrar({
        inscripcion_id: inscripcionId,
        leccion_id: currentLesson.id,
        visto_seg: videoDuration.current || 0,
        progreso_pct: 100,
      }).catch((e) => logError('CourseVideoContent/handleMarkComplete', e));
    }
  };

  const handleDescargarCert = async (folio: string) => {
    setDownloading(true);
    try {
      await certificadosApi.descargar(folio);
    } catch (e) {
      logError('CourseVideoContent/handleDescargarCert', e);
    } finally {
      setDownloading(false);
    }
  };

  if (!currentLesson) {
    return (
      <div className={styles.container}>
        <header className={styles.header}>
          <div className={styles.headerContent}>
            <div className={styles.logo}>Cursos Online</div>
            <Link href="/cursos" className={styles.navTitle}>Cursos</Link>
          </div>
        </header>
        <div className={styles.main}>
          <div className={styles.backButtonContainer}>
            <Link href={backHref ?? `/curso/${initialCourse.id}`} className={styles.backButton} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem' }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" /></svg>
              Volver a información del curso
            </Link>
          </div>
          <p style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-text-secondary)' }}>
            Este curso aún no tiene lecciones disponibles.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.headerContent}>
          <div className={styles.logo}>Cursos Online</div>
          <Link href="/cursos" className={styles.navTitle}>
            Cursos
          </Link>
        </div>
      </header>

      <div className={styles.main}>
        <h1 className={styles.pageTitle}>Videos: {course.title}</h1>

        <div className={styles.backButtonContainer}>
          <Link href={backHref ?? `/curso/${course.id}`} className={styles.backButton} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem' }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" /></svg>
            Volver a información del curso
          </Link>
        </div>

        {certFolio && (
          <div className={styles.certBanner}>
            <div className={styles.certBannerText}>
              <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} style={{ flexShrink: 0 }}><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9a9 9 0 01-9-9 9 9 0 019-9h9a9 9 0 019 9 9 9 0 01-9 9z" /><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75l2 2 4-4.5" /></svg>
              <span>¡Curso completado! Tu certificado está listo.</span>
            </div>
            <button
              className={styles.certBannerBtn}
              disabled={downloading}
              onClick={() => handleDescargarCert(certFolio)}
            >
              {downloading ? 'Descargando...' : 'Descargar certificado'}
            </button>
          </div>
        )}

        <div className={styles.contentGrid}>
          <div className={styles.videoSection}>
            {currentLesson.tipo === 'quiz' ? (
              <QuizPlayer
                leccionId={currentLesson.id}
                inscripcionId={inscripcionId ?? null}
                quizData={(() => {
                  try { return currentLesson.contenido ? JSON.parse(currentLesson.contenido) as QuizData : { preguntas: [] }; }
                  catch { return { preguntas: [] }; }
                })()}
                onAprobado={handleMarkComplete}
                previewMode={previewMode}
              />
            ) : (
              <>
                <VideoPlayer
                  key={currentLesson.id}
                  config={bunnyConfig}
                  videoUrl={currentLesson.videoUrl}
                  onTimeUpdate={handleTimeUpdate}
                  onEnded={() => {
                    handleTimeUpdate(videoDuration.current);
                    handleMarkComplete();
                  }}
                />
                <VideoControls
                  progress={progress}
                  onMarkComplete={handleMarkComplete}
                  resources={currentLesson.resources}
                  courseId={course.id}
                  lessonId={currentLesson.id}
                  certFolio={certFolio}
                  onDownloadCert={handleDescargarCert}
                  downloading={downloading}
                />
              </>
            )}
          </div>

          <LessonsSidebar
            modules={course.modules}
            currentLessonId={currentLesson.id}
            onLessonSelect={handleLessonSelect}
          />
        </div>
      </div>

      {completionModal && (
        <div className={styles.modalOverlay} onClick={() => setCompletionModal(null)}>
          <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <button className={styles.modalClose} onClick={() => setCompletionModal(null)}>
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
            <div className={styles.modalIcon}><svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg></div>
            <h2 className={styles.modalTitle}>¡Felicidades!</h2>
            <p className={styles.modalSubtitle}>Has completado el curso exitosamente.</p>
            <div className={styles.modalActions}>
              <button
                className={styles.modalBtnPrimary}
                disabled={completionModal.loading || !completionModal.folio || downloading}
                onClick={() => completionModal.folio && handleDescargarCert(completionModal.folio)}
              >
                {completionModal.loading
                  ? 'Generando certificado...'
                  : downloading
                  ? 'Descargando...'
                  : completionModal.folio
                  ? 'Descargar Certificado'
                  : 'Certificado no disponible'}
              </button>
              <button
                className={styles.modalBtnSecondary}
                onClick={() => router.push('/mis-cursos')}
              >
                Ir a Mis Cursos
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
