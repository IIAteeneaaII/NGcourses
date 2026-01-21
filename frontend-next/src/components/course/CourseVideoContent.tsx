'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import VideoPlayer from '@/components/video/VideoPlayer';
import LessonsSidebar from '@/components/course/LessonsSidebar';
import VideoControls from '@/components/course/VideoControls';
import type { Course, Lesson } from '@/types/course';
import styles from './CourseVideoContent.module.css';

// Datos de ejemplo - esto vendrá del backend FastAPI
const MOCK_COURSE_DATA: Record<string, Course> = {
  '1': {
    id: '1',
    title: 'Facturación Electrónica',
    description: 'Curso completo sobre facturación electrónica en México',
    progress: 25,
    modules: [
      {
        id: 'm1',
        name: 'Módulo 1: Introducción',
        order: 1,
        lessons: [
          { id: 'l1', name: 'Lección 1: Introducción a la facturación electrónica', completed: true, order: 1, videoId: '2694e857-a403-4f27-8b00-32b9ba4049c3' },
          { id: 'l2', name: 'Lección 2: Marco legal y normativo', completed: true, order: 2 },
          { id: 'l3', name: 'Lección 3: Tipos de comprobantes fiscales', completed: false, order: 3 },
        ],
      },
      {
        id: 'm2',
        name: 'Módulo 2: Implementación',
        order: 2,
        lessons: [
          { id: 'l4', name: 'Lección 4: Proceso de emisión de CFDI', completed: false, order: 4 },
          { id: 'l5', name: 'Lección 5: Timbrado y certificados', completed: false, order: 5 },
          { id: 'l6', name: 'Lección 6: Validación de facturas', completed: false, order: 6 },
        ],
      },
      {
        id: 'm3',
        name: 'Módulo 3: Gestión',
        order: 3,
        lessons: [
          { id: 'l7', name: 'Lección 7: Cancelación de documentos', completed: false, order: 7 },
          { id: 'l8', name: 'Lección 8: Gestión y archivo de facturas', completed: false, order: 8 },
        ],
      },
    ],
  },
};

export default function CourseVideoContent() {
  const searchParams = useSearchParams();
  const courseId = searchParams.get('id') || '1';

  const [course, setCourse] = useState<Course>(MOCK_COURSE_DATA[courseId] || MOCK_COURSE_DATA['1']);
  const [currentLesson, setCurrentLesson] = useState<Lesson>(course.modules[0].lessons[0]);
  const [progress, setProgress] = useState(course.progress);

  const bunnyConfig = {
    libraryId: process.env.NEXT_PUBLIC_BUNNY_LIBRARY_ID || '583601',
    videoId: currentLesson.videoId || process.env.NEXT_PUBLIC_BUNNY_VIDEO_ID || '2694e857-a403-4f27-8b00-32b9ba4049c3',
  };

  const handleLessonSelect = (lesson: Lesson) => {
    setCurrentLesson(lesson);
  };

  const handleMarkComplete = () => {
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

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.headerContent}>
          <div className={styles.logo}>Cursos Online</div>
          <div className={styles.navTitle}>Course Videos</div>
        </div>
      </header>

      <div className={styles.main}>
        <h1 className={styles.pageTitle}>Videos: {course.title}</h1>

        <div className={styles.backButtonContainer}>
          <a href={`/curso-info?id=${courseId}`} className={styles.backButton}>
            ← Volver a información del curso
          </a>
        </div>

        <div className={styles.contentGrid}>
          <div className={styles.videoSection}>
            <VideoPlayer
              config={bunnyConfig}
              onTimeUpdate={(time) => console.log('Current time:', time)}
              onEnded={() => console.log('Video ended')}
            />
            <VideoControls progress={progress} onMarkComplete={handleMarkComplete} />
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
