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
    <span style={{ flexShrink: 0, display: 'inline-flex', marginRight: 6, color: '#94a3b8' }}>
      {tipo === 'quiz' ? (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
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
      <div style={{ padding: '0.9rem 1rem 0.65rem', borderBottom: '1px solid #e2e8f0' }}>
        <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, color: '#0f172a' }}>Contenido del curso</h3>
        <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
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
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: '0.5rem',
                  background: 'none', border: 'none', cursor: 'pointer', padding: '0.55rem 0.25rem', textAlign: 'left',
                }}
              >
                <svg
                  width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth={2}
                  style={{ transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)', transition: 'transform .15s', flexShrink: 0 }}
                >
                  <path d="M6 9l6 6 6-6" />
                </svg>
                <span className={styles.moduleTitle} style={{ flex: 1, margin: 0 }}>{idx + 1}. {module.name}</span>
                <span style={{ fontSize: '0.72rem', color: '#94a3b8', flexShrink: 0 }}>{modDone}/{module.lessons.length}</span>
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
