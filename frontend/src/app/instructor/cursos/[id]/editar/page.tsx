'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { cursosApi } from '@/lib/api/client';
import VideoUploadButton from '@/components/video/VideoUploadButton';
import styles from './page.module.css';

interface ApiLeccion {
  id: string;
  titulo: string;
  tipo: string;
  bunny_video_id: string | null;
  duracion_seg: number;
  es_visible: boolean;
}

interface ApiModulo {
  id: string;
  titulo: string;
  descripcion: string | null;
  lecciones: ApiLeccion[];
}

interface ApiCurso {
  id: string;
  titulo: string;
  descripcion: string | null;
  modulos: ApiModulo[];
}

interface Lesson {
  id: string;
  title: string;
  bunnyVideoId: string | null;
  isVisible: boolean;
}

interface Module {
  id: string;
  title: string;
  description: string;
  lessons: Lesson[];
  isExpanded: boolean;
}

export default function EditarCursoInstructorPage() {
  const router = useRouter();
  const params = useParams();
  const courseId = params.id as string;

  const [courseTitle, setCourseTitle] = useState('');
  const [courseDescription, setCourseDescription] = useState('');
  const [modules, setModules] = useState<Module[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    cursosApi.get(courseId).then((raw) => {
      const curso = raw as ApiCurso;
      setCourseTitle(curso.titulo);
      setCourseDescription(curso.descripcion || '');
      setModules(
        (curso.modulos || []).map((m) => ({
          id: m.id,
          title: m.titulo,
          description: m.descripcion || '',
          isExpanded: true,
          lessons: (m.lecciones || []).map((l) => ({
            id: l.id,
            title: l.titulo,
            bunnyVideoId: l.bunny_video_id,
            isVisible: l.es_visible,
          })),
        }))
      );
    }).catch(() => {}).finally(() => setLoading(false));
  }, [courseId]);

  const addModule = async () => {
    try {
      const resp = await cursosApi.createModulo(courseId, {
        titulo: 'Nuevo modulo',
        descripcion: '',
        orden: modules.length + 1,
      }) as ApiModulo;
      setModules((prev) => [...prev, {
        id: resp.id,
        title: resp.titulo,
        description: resp.descripcion || '',
        lessons: [],
        isExpanded: true,
      }]);
    } catch {
      alert('Error al crear el modulo');
    }
  };

  const updateModuleLocal = (moduleId: string, updates: Partial<Module>) => {
    setModules((prev) => prev.map((m) => m.id === moduleId ? { ...m, ...updates } : m));
  };

  const deleteModule = async (moduleId: string) => {
    if (!confirm('Eliminar este modulo y todas sus lecciones?')) return;
    try {
      await cursosApi.deleteModulo(courseId, moduleId);
      setModules((prev) => prev.filter((m) => m.id !== moduleId));
    } catch {
      alert('Error al eliminar el modulo');
    }
  };

  const toggleModuleExpand = (moduleId: string) => {
    setModules((prev) => prev.map((m) =>
      m.id === moduleId ? { ...m, isExpanded: !m.isExpanded } : m
    ));
  };

  const addLesson = async (moduleId: string) => {
    const mod = modules.find((m) => m.id === moduleId);
    if (!mod) return;
    try {
      const resp = await cursosApi.createLeccion(courseId, moduleId, {
        titulo: 'Nueva leccion',
        tipo: 'video',
        orden: mod.lessons.length + 1,
        es_visible: true,
        duracion_seg: 0,
      }) as ApiLeccion;
      setModules((prev) => prev.map((m) =>
        m.id === moduleId ? {
          ...m,
          lessons: [...m.lessons, {
            id: resp.id,
            title: resp.titulo,
            bunnyVideoId: resp.bunny_video_id,
            isVisible: resp.es_visible,
          }],
        } : m
      ));
    } catch {
      alert('Error al crear la leccion');
    }
  };

  const updateLessonLocal = (moduleId: string, lessonId: string, updates: Partial<Lesson>) => {
    setModules((prev) => prev.map((m) =>
      m.id === moduleId ? {
        ...m,
        lessons: m.lessons.map((l) => l.id === lessonId ? { ...l, ...updates } : l),
      } : m
    ));
  };

  const deleteLesson = async (moduleId: string, lessonId: string) => {
    if (!confirm('Eliminar esta leccion?')) return;
    try {
      await cursosApi.deleteLeccion(courseId, moduleId, lessonId);
      setModules((prev) => prev.map((m) =>
        m.id === moduleId ? { ...m, lessons: m.lessons.filter((l) => l.id !== lessonId) } : m
      ));
    } catch {
      alert('Error al eliminar la leccion');
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await cursosApi.update(courseId, { titulo: courseTitle, descripcion: courseDescription });
      await Promise.all(modules.map(async (m) => {
        await cursosApi.updateModulo(courseId, m.id, { titulo: m.title, descripcion: m.description });
        await Promise.all(m.lessons.map((l) =>
          cursosApi.updateLeccion(courseId, m.id, l.id, { titulo: l.title, es_visible: l.isVisible })
        ));
      }));
      alert('Cambios guardados correctamente');
    } catch {
      alert('Error al guardar los cambios');
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return <div className={styles.pageContainer}><div className={styles.loading}>Cargando curso...</div></div>;
  }

  const totalLessons = modules.reduce((acc, m) => acc + m.lessons.length, 0);

  return (
    <div className={styles.pageContainer}>
      <div className={styles.headerBar}>
        <button className={styles.backButton} onClick={() => router.push('/instructor/cursos')}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Volver a cursos
        </button>
        <button className={styles.saveButton} onClick={handleSave} disabled={isSaving}>
          {isSaving ? 'Guardando...' : 'Guardar cambios'}
        </button>
      </div>

      <div className={styles.contentCard}>
        <div className={styles.cardHeader}>
          <div className={styles.courseInfo}>
            <input
              type="text"
              value={courseTitle}
              onChange={(e) => setCourseTitle(e.target.value)}
              className={styles.pageTitle}
              placeholder="Titulo del curso"
            />
            <textarea
              value={courseDescription}
              onChange={(e) => setCourseDescription(e.target.value)}
              className={styles.courseDescription}
              placeholder="Descripcion del curso"
              rows={2}
            />
          </div>
          <div className={styles.courseStats}>
            <div className={styles.statItem}>
              <span className={styles.statNumber}>{modules.length}</span>
              <span className={styles.statLabel}>Modulos</span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statNumber}>{totalLessons}</span>
              <span className={styles.statLabel}>Lecciones</span>
            </div>
          </div>
        </div>

        <div className={styles.sectionTitle}>Estructura del curso</div>

        <div className={styles.modulesContainer}>
          {modules.map((module, moduleIndex) => (
            <div key={module.id} className={styles.moduleCard}>
              <div className={styles.moduleHeader}>
                <button className={styles.expandButton} onClick={() => toggleModuleExpand(module.id)}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                    className={module.isExpanded ? styles.rotated : ''}>
                    <path d="M9 18l6-6-6-6" />
                  </svg>
                </button>
                <div className={styles.moduleNumber}>{moduleIndex + 1}</div>
                <input
                  type="text"
                  value={module.title}
                  onChange={(e) => updateModuleLocal(module.id, { title: e.target.value })}
                  className={styles.moduleTitleInput}
                  placeholder="Titulo del modulo"
                />
                <span className={styles.lessonCount}>{module.lessons.length} lecciones</span>
                <button className={styles.deleteModuleButton} onClick={() => deleteModule(module.id)} title="Eliminar modulo">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                  </svg>
                </button>
              </div>

              {module.isExpanded && (
                <div className={styles.moduleContent}>
                  <div className={styles.moduleDescriptionGroup}>
                    <textarea
                      value={module.description}
                      onChange={(e) => updateModuleLocal(module.id, { description: e.target.value })}
                      className={styles.moduleDescriptionInput}
                      placeholder="Descripcion del modulo (opcional)"
                      rows={2}
                    />
                  </div>

                  <div className={styles.lessonsContainer}>
                    {module.lessons.map((lesson, lessonIndex) => (
                      <div key={lesson.id} className={styles.lessonCard}>
                        <div className={styles.lessonHeader}>
                          <span className={styles.lessonNumber}>{lessonIndex + 1}</span>
                          <input
                            type="text"
                            value={lesson.title}
                            onChange={(e) => updateLessonLocal(module.id, lesson.id, { title: e.target.value })}
                            className={styles.lessonTitleInput}
                            placeholder="Titulo de la leccion"
                          />
                          <label className={styles.toggleLabel}>
                            <input
                              type="checkbox"
                              checked={lesson.isVisible}
                              onChange={(e) => updateLessonLocal(module.id, lesson.id, { isVisible: e.target.checked })}
                              className={styles.toggleInput}
                            />
                            <span className={styles.toggleSlider}></span>
                          </label>
                          <button className={styles.deleteLessonButton} onClick={() => deleteLesson(module.id, lesson.id)} title="Eliminar leccion">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M18 6L6 18M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                        <div className={styles.lessonInputs}>
                          <VideoUploadButton
                            cursoId={courseId}
                            moduloId={module.id}
                            leccionId={lesson.id}
                            currentBunnyVideoId={lesson.bunnyVideoId}
                            onUploadComplete={(videoId) => updateLessonLocal(module.id, lesson.id, { bunnyVideoId: videoId })}
                          />
                        </div>
                      </div>
                    ))}

                    <button className={styles.addLessonButton} onClick={() => addLesson(module.id)}>
                      + Agregar leccion
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}

          <button className={styles.addModuleButton} onClick={addModule}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Agregar modulo
          </button>
        </div>
      </div>
    </div>
  );
}
