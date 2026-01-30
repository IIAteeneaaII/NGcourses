'use client';

import { useState } from 'react';
import Link from 'next/link';
import VideoPlayer from '@/components/video/VideoPlayer';
import LessonsSidebar from '@/components/course/LessonsSidebar';
import VideoControls from '@/components/course/VideoControls';
import type { Course, Lesson } from '@/types/course';
import styles from './CourseVideoContent.module.css';

interface CourseVideoContentProps {
  initialCourse: Course;
}

export default function CourseVideoContent({ initialCourse }: CourseVideoContentProps) {
  const [course, setCourse] = useState<Course>(initialCourse);
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
          <Link href="/cursos" className={styles.navTitle}>
            Cursos
          </Link>
        </div>
      </header>

      <div className={styles.main}>
        <h1 className={styles.pageTitle}>Videos: {course.title}</h1>

        <div className={styles.backButtonContainer}>
          <Link href={`/curso/${course.id}`} className={styles.backButton}>
            ← Volver a información del curso
          </Link>
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
