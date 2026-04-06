'use client';

import { useCallback, useRef, useState } from 'react';
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
}

interface CompletionModal {
  folio: string | null;
  loading: boolean;
}

export default function CourseVideoContent({ initialCourse, inscripcionId, bunnyLibraryId, backHref }: CourseVideoContentProps) {
  const router = useRouter();
  const [course, setCourse] = useState<Course>(initialCourse);
  const [currentLesson, setCurrentLesson] = useState<Lesson | null>(
    course.modules.flatMap((m) => m.lessons)[0] ?? null
  );
  const [progress, setProgress] = useState(course.progress);
  const [completionModal, setCompletionModal] = useState<CompletionModal | null>(null);
  const [downloading, setDownloading] = useState(false);

  // Para throttle del tracking: cada 10 segundos
  const lastSentTime = useRef<number>(0);
  const videoDuration = useRef<number>(0);

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

    setCourse({ ...course, modules: updatedModules, progress: newProgress });
    setProgress(newProgress);

    if (newProgress === 100 && inscripcionId) {
      // Mostrar modal y ESPERAR a que el backend procese el certificado
      setCompletionModal({ folio: null, loading: true });
      try {
        await progresoApi.registrar({
          inscripcion_id: inscripcionId,
          leccion_id: currentLesson.id,
          visto_seg: videoDuration.current || 0,
          progreso_pct: 100,
        });
        // Pequeña pausa extra para que el PDF termine de generarse
        await new Promise((r) => setTimeout(r, 800));
        const resp = await (certificadosApi.mis() as Promise<{ data: { curso_id: string; folio: string; url_pdf: string | null }[] }>);
        const cert = resp.data.find((c) => c.curso_id === course.id && c.url_pdf);
        setCompletionModal({ folio: cert?.folio ?? null, loading: false });
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
      const token = localStorage.getItem('access_token');
      const res = await fetch(`/api/v1/certificados/descargar/${folio}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `certificado-${folio}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
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
            <Link href={backHref ?? `/curso/${initialCourse.id}`} className={styles.backButton}>
              ← Volver a información del curso
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
          <Link href={backHref ?? `/curso/${course.id}`} className={styles.backButton}>
            ← Volver a información del curso
          </Link>
        </div>

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
            <button className={styles.modalClose} onClick={() => setCompletionModal(null)}>×</button>
            <div className={styles.modalIcon}>✓</div>
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
