'use client';

import { useState } from 'react';
import type { Module, Lesson } from '@/types/course';
import styles from './LessonsSidebar.module.css';

interface LessonsSidebarProps {
  modules: Module[];
  currentLessonId?: string;
  onLessonSelect: (lesson: Lesson) => void;
}

/**
 * Panel unificado de contenido del curso (lado del alumno): un solo árbol de
 * módulos colapsables con sus lecciones anidadas. Sustituye a los dos tabs
 * redundantes "Lecciones"/"Módulos".
 */
export default function LessonsSidebar({
  modules,
  currentLessonId,
  onLessonSelect,
}: LessonsSidebarProps) {
  // Todos los módulos expandidos por defecto; el alumno puede colapsar.
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const toggle = (id: string) =>
    setCollapsed((prev) => ({ ...prev, [id]: !prev[id] }));

  const allLessons = modules.flatMap((m) => m.lessons);
  const total = allLessons.length;
  const done = allLessons.filter((l) => l.completed).length;

  const getLessonItemClass = (lesson: Lesson) => {
    if (lesson.id === currentLessonId) return `${styles.lessonItem} ${styles.lessonItemActive}`;
    if (lesson.completed) return `${styles.lessonItem} ${styles.lessonItemCompleted}`;
    return styles.lessonItem;
  };

  const TypeIcon = ({ tipo }: { tipo?: Lesson['tipo'] }) => (
    <span className={styles.typeIcon} aria-hidden="true">
      {tipo === 'quiz' ? (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
        </svg>
      ) : tipo === 'lectura' ? (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><path d="M14 2v6h6" />
        </svg>
      ) : (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <polygon points="5 3 19 12 5 21 5 3" />
        </svg>
      )}
    </span>
  );

  return (
    <div className={styles.container}>
      <div className={styles.head}>
        <h3 className={styles.headTitle}>Contenido del curso</h3>
        <span className={styles.headMeta}>
          {done}/{total} lecciones completadas
        </span>
      </div>

      <div className={styles.lessonList}>
        {modules.map((module, idx) => {
          const isCollapsed = collapsed[module.id];
          const modDone = module.lessons.filter((l) => l.completed).length;
          return (
            <div key={module.id} className={styles.moduleContainer}>
              <button
                type="button"
                onClick={() => toggle(module.id)}
                className={styles.moduleToggle}
                aria-expanded={!isCollapsed}
              >
                <svg
                  width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
                  className={`${styles.chevron} ${isCollapsed ? styles.chevronCollapsed : ''}`}
                  aria-hidden="true"
                >
                  <path d="M6 9l6 6 6-6" />
                </svg>
                <span className={styles.moduleTitle}>{idx + 1}. {module.name}</span>
                <span className={styles.moduleCount}>{modDone}/{module.lessons.length}</span>
              </button>

              {!isCollapsed && (
                <div className={styles.moduleLessonList}>
                  {module.lessons.map((lesson) => (
                    <div
                      key={lesson.id}
                      onClick={() => onLessonSelect(lesson)}
                      className={getLessonItemClass(lesson)}
                    >
                      <TypeIcon tipo={lesson.tipo} />
                      <span className={styles.lessonName}>{lesson.name}</span>
                      <span className={styles.lessonIcon}>
                        {lesson.completed ? (
                          <span className={styles.checkIcon}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                          </span>
                        ) : lesson.id === currentLessonId ? (
                          <span className={styles.arrowIcon}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
                          </span>
                        ) : null}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
