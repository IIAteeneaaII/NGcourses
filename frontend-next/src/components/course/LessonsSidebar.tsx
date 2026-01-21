'use client';

import { useState } from 'react';
import type { Module, Lesson } from '@/types/course';
import styles from './LessonsSidebar.module.css';

interface LessonsSidebarProps {
  modules: Module[];
  currentLessonId?: string;
  onLessonSelect: (lesson: Lesson) => void;
}

export default function LessonsSidebar({
  modules,
  currentLessonId,
  onLessonSelect,
}: LessonsSidebarProps) {
  const [activeTab, setActiveTab] = useState<'lessons' | 'modules'>('lessons');

  const allLessons = modules.flatMap((module) =>
    module.lessons.map((lesson) => ({ ...lesson, moduleName: module.name }))
  );

  const getLessonItemClass = (lesson: Lesson) => {
    if (lesson.completed) return `${styles.lessonItem} ${styles.lessonItemCompleted}`;
    if (lesson.id === currentLessonId) return `${styles.lessonItem} ${styles.lessonItemActive}`;
    return styles.lessonItem;
  };

  return (
    <div className={styles.container}>
      <div className={styles.tabs}>
        <button
          onClick={() => setActiveTab('lessons')}
          className={`${styles.tab} ${activeTab === 'lessons' ? styles.tabActive : ''}`}
        >
          Lecciones
        </button>
        <button
          onClick={() => setActiveTab('modules')}
          className={`${styles.tab} ${activeTab === 'modules' ? styles.tabActive : ''}`}
        >
          Módulos
        </button>
      </div>

      <div className={styles.lessonList}>
        {activeTab === 'lessons' &&
          allLessons.map((lesson) => (
            <div
              key={lesson.id}
              onClick={() => onLessonSelect(lesson)}
              className={getLessonItemClass(lesson)}
            >
              <span className={styles.lessonName}>{lesson.name}</span>
              <span className={styles.lessonIcon}>
                {lesson.completed ? (
                  <span className={styles.checkIcon}>✓</span>
                ) : (
                  <span className={styles.arrowIcon}>∨</span>
                )}
              </span>
            </div>
          ))}

        {activeTab === 'modules' &&
          modules.map((module) => (
            <div key={module.id} className={styles.moduleContainer}>
              <h3 className={styles.moduleTitle}>{module.name}</h3>
              <div className={styles.moduleLessonList}>
                {module.lessons.map((lesson) => (
                  <div
                    key={lesson.id}
                    onClick={() => onLessonSelect(lesson)}
                    className={getLessonItemClass(lesson)}
                  >
                    <span className={styles.lessonName}>{lesson.name}</span>
                    <span className={styles.lessonIcon}>
                      {lesson.completed ? (
                        <span className={styles.checkIcon}>✓</span>
                      ) : (
                        <span className={styles.arrowIcon}>∨</span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}
