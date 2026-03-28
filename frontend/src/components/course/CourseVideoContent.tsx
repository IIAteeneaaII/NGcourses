'use client';

import { useCallback, useRef, useState } from 'react';
import Link from 'next/link';
import VideoPlayer from '@/components/video/VideoPlayer';
import LessonsSidebar from '@/components/course/LessonsSidebar';
import VideoControls from '@/components/course/VideoControls';
import type { Course, Lesson } from '@/types/course';
import { progresoApi } from '@/lib/api/client';
import styles from './CourseVideoContent.module.css';

interface CourseVideoContentProps {
  initialCourse: Course;
  inscripcionId?: string | null;
  bunnyLibraryId?: string | null;
  backHref?: string;
}

export default function CourseVideoContent({ initialCourse, inscripcionId, bunnyLibraryId, backHref }: CourseVideoContentProps) {
  const [course, setCourse] = useState<Course>(initialCourse);
  const [currentLesson, setCurrentLesson] = useState<Lesson | null>(
    course.modules.flatMap((m) => m.lessons)[0] ?? null
  );
  const [progress, setProgress] = useState(course.progress);

  // Para throttle del tracking: cada 10 segundos
  const lastSentTime = useRef<number>(0);
  const videoDuration = useRef<number>(0);

  const bunnyConfig = currentLesson && !currentLesson.videoUrl && currentLesson.videoId
    ? {
        libraryId: bunnyLibraryId || process.env.NEXT_PUBLIC_BUNNY_LIBRARY_ID || '',
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
    }).catch(() => {}); // Fire & forget
  }, [inscripcionId, currentLesson]);

  const handleMarkComplete = async () => {
    if (!currentLesson) return;
    // Enviar 100% al backend si hay inscripción
    if (inscripcionId) {
      progresoApi.registrar({
        inscripcion_id: inscripcionId,
        leccion_id: currentLesson.id,
        visto_seg: videoDuration.current || 0,
        progreso_pct: 100,
      }).catch(() => {});
    }

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
            <VideoPlayer
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
          </div>

          <LessonsSidebar
            modules={course.modules}
            currentLessonId={currentLesson.id}
            onLessonSelect={handleLessonSelect}
          />
        </div>
      </div>
    </div>
  );
}
