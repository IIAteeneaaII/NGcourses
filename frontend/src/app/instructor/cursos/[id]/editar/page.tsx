'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { cursosApi, categoriasApi } from '@/lib/api/client';
import VideoUploadButton from '@/components/video/VideoUploadButton';
import LessonTypeSelector from '@/components/course/LessonTypeSelector';
import QuizBuilder from '@/components/course/QuizBuilder';
import type { QuizData } from '@/types/course';
import { logError } from '@/lib/logger';
import styles from './page.module.css';

interface ApiCategoria { id: string; nombre: string }

interface ApiLeccionRecurso {
  id: string;
  titulo: string;
  url: string;
  tipo: string;
}

interface ApiLeccion {
  id: string;
  titulo: string;
  tipo: string;
  bunny_video_id: string | null;
  duracion_seg: number;
  es_visible: boolean;
  contenido?: string | null;
  recursos?: ApiLeccionRecurso[];
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
  categoria_id?: string;
  modulos: ApiModulo[];
}

interface RecursoItem {
  id: string;
  titulo: string;
  url: string;
  tipo: string;
}

interface Lesson {
  id: string;
  title: string;
  tipo: 'video' | 'quiz';
  bunnyVideoId: string | null;
  isVisible: boolean;
  recursos: RecursoItem[];
  showRecursos: boolean;
  newRecursoTitulo: string;
  quizData: QuizData;
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
  const [category, setCategory] = useState('');
  const [categories, setCategories] = useState<ApiCategoria[]>([]);
  const [showNewCatInput, setShowNewCatInput] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);
  const [modules, setModules] = useState<Module[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const notify = React.useCallback((type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 3000);
  }, []);

  useEffect(() => {
    Promise.all([
      categoriasApi.list(),
      cursosApi.get(courseId),
    ]).then(([cats, raw]) => {
      setCategories(cats as ApiCategoria[]);
      const curso = raw as ApiCurso;
      setCourseTitle(curso.titulo);
      setCourseDescription(curso.descripcion || '');
      setCategory(curso.categoria_id || '');
      setModules(
        (curso.modulos || []).map((m) => ({
          id: m.id,
          title: m.titulo,
          description: m.descripcion || '',
          isExpanded: true,
          lessons: (m.lecciones || []).map((l) => ({
            id: l.id,
            title: l.titulo,
            tipo: (l.tipo === 'quiz' ? 'quiz' : 'video') as 'video' | 'quiz',
            bunnyVideoId: l.bunny_video_id,
            isVisible: l.es_visible,
            recursos: l.recursos || [],
            showRecursos: false,
            newRecursoTitulo: '',
            quizData: l.contenido ? (() => { try { return JSON.parse(l.contenido!); } catch { return { preguntas: [] }; } })() : { preguntas: [] },
          })),
        }))
      );
    }).catch((e) => logError('instructor/cursos/editar/autoSave', e)).finally(() => setLoading(false));
  }, [courseId]);

  const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (e.target.value === '__new__') {
      setShowNewCatInput(true);
      setCategory('');
    } else {
      setCategory(e.target.value);
      setShowNewCatInput(false);
    }
  };

  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) return;
    setIsCreatingCategory(true);
    try {
      const newCat = await categoriasApi.create({ nombre: newCategoryName.trim() }) as ApiCategoria;
      setCategories((prev) => [...prev, newCat]);
      setCategory(newCat.id);
      setNewCategoryName('');
      setShowNewCatInput(false);
    } catch (e) {
      logError('instructor/cursos/editar/createCategory', e);
    } finally {
      setIsCreatingCategory(false);
    }
  };

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
      notify('error', 'Error al crear el módulo');
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
      notify('error', 'Error al eliminar el módulo');
    }
  };

  const toggleModuleExpand = (moduleId: string) => {
    setModules((prev) => prev.map((m) =>
      m.id === moduleId ? { ...m, isExpanded: !m.isExpanded } : m
    ));
  };

  const confirmAddLesson = async (moduleId: string, tipo: 'video' | 'quiz') => {
    const mod = modules.find((m) => m.id === moduleId);
    if (!mod) return;
    setChoosingForModule(null);
    try {
      const resp = await cursosApi.createLeccion(courseId, moduleId, {
        titulo: tipo === 'quiz' ? 'Nueva lección - Quiz' : 'Nueva lección',
        tipo,
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
            tipo,
            bunnyVideoId: resp.bunny_video_id,
            isVisible: resp.es_visible,
            recursos: [],
            showRecursos: false,
            newRecursoTitulo: '',
            quizData: { preguntas: [] },
          }],
        } : m
      ));
    } catch {
      notify('error', 'Error al crear la lección');
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
      notify('error', 'Error al eliminar la lección');
    }
  };

  const updateLessonRecursoField = (moduleId: string, lessonId: string, field: 'newRecursoTitulo' | 'showRecursos', value: string | boolean) => {
    setModules((prev) => prev.map((m) =>
      m.id === moduleId ? {
        ...m,
        lessons: m.lessons.map((l) => l.id === lessonId ? { ...l, [field]: value } : l),
      } : m
    ));
  };

  const [pendingRecursoFiles, setPendingRecursoFiles] = useState<Record<string, File[]>>({});
  const [choosingForModule, setChoosingForModule] = useState<string | null>(null);

  const handleRecursoFileSelect = (lessonId: string, files: FileList) => {
    setPendingRecursoFiles((prev) => ({ ...prev, [lessonId]: Array.from(files) }));
  };

  const addRecurso = useCallback(async (moduleId: string, lesson: Lesson) => {
    const files = pendingRecursoFiles[lesson.id];
    if (!files || files.length === 0) return;
    try {
      const nuevos: ApiLeccionRecurso[] = [];
      for (const file of files) {
        const resp = await cursosApi.uploadRecurso(
          courseId, moduleId, lesson.id, file,
          files.length === 1 ? (lesson.newRecursoTitulo.trim() || undefined) : undefined
        ) as ApiLeccionRecurso;
        nuevos.push(resp);
      }
      setModules((prev) => prev.map((m) =>
        m.id === moduleId ? {
          ...m,
          lessons: m.lessons.map((l) => l.id === lesson.id ? {
            ...l,
            recursos: [...l.recursos, ...nuevos],
            newRecursoTitulo: '',
          } : l),
        } : m
      ));
      setPendingRecursoFiles((prev) => {
        const next = { ...prev };
        delete next[lesson.id];
        return next;
      });
    } catch {
      notify('error', 'Error al agregar el recurso');
    }
  }, [courseId, pendingRecursoFiles]);

  const deleteRecurso = useCallback(async (moduleId: string, lessonId: string, recursoId: string) => {
    try {
      await cursosApi.deleteRecurso(courseId, moduleId, lessonId, recursoId);
      setModules((prev) => prev.map((m) =>
        m.id === moduleId ? {
          ...m,
          lessons: m.lessons.map((l) => l.id === lessonId ? {
            ...l,
            recursos: l.recursos.filter((r) => r.id !== recursoId),
          } : l),
        } : m
      ));
    } catch {
      notify('error', 'Error al eliminar el recurso');
    }
  }, [courseId]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await cursosApi.update(courseId, { titulo: courseTitle, descripcion: courseDescription, ...(category ? { categoria_id: category } : {}) });
      await Promise.all(modules.map(async (m) => {
        await cursosApi.updateModulo(courseId, m.id, { titulo: m.title, descripcion: m.description });
        await Promise.all(m.lessons.map((l) =>
          cursosApi.updateLeccion(courseId, m.id, l.id, { titulo: l.title, es_visible: l.isVisible })
        ));
      }));
      notify('success', 'Cambios guardados correctamente');
    } catch {
      notify('error', 'Error al guardar los cambios');
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
      {notification && (
        <div style={{
          position: 'fixed', top: '1rem', right: '1rem', zIndex: 1000,
          padding: '0.75rem 1.25rem', borderRadius: '0.5rem', fontWeight: 500,
          background: notification.type === 'success' ? '#d4edda' : '#f8d7da',
          color: notification.type === 'success' ? '#155724' : '#721c24',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        }}>
          {notification.message}
        </div>
      )}
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
            <div className={styles.categoryGroup}>
              <label className={styles.categoryLabel}>Categoría</label>
              {!showNewCatInput ? (
                <select value={category} onChange={handleCategoryChange} className={styles.categorySelect}>
                  <option value="">Sin categoría</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>{cat.nombre}</option>
                  ))}
                  <option value="__new__">+ Crear nueva categoría...</option>
                </select>
              ) : (
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <input
                    type="text"
                    className={styles.categoryInput}
                    placeholder="Nombre de la nueva categoría"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleCreateCategory(); } }}
                    autoFocus
                    disabled={isCreatingCategory}
                    aria-label="Nombre de la nueva categoría"
                    style={{ flex: 1 }}
                  />
                  <button
                    type="button"
                    onClick={handleCreateCategory}
                    disabled={!newCategoryName.trim() || isCreatingCategory}
                    style={{ padding: '0.5rem 1rem', background: 'var(--color-secondary-30)', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: 600, whiteSpace: 'nowrap' }}
                  >
                    {isCreatingCategory ? 'Creando...' : 'Crear'}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowNewCatInput(false); setNewCategoryName(''); }}
                    style={{ padding: '0.5rem 0.75rem', background: 'transparent', border: '1px solid #ccc', borderRadius: '0.5rem', cursor: 'pointer' }}
                    aria-label="Cancelar crear categoría"
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>
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
                          {lesson.tipo === 'video' ? (
                            <VideoUploadButton
                              cursoId={courseId}
                              moduloId={module.id}
                              leccionId={lesson.id}
                              currentBunnyVideoId={lesson.bunnyVideoId}
                              onUploadComplete={(videoId) => updateLessonLocal(module.id, lesson.id, { bunnyVideoId: videoId })}
                            />
                          ) : (
                            <QuizBuilder
                              quizData={lesson.quizData}
                              onChange={(qd) => updateLessonLocal(module.id, lesson.id, { quizData: qd })}
                              onSave={(data) => cursosApi.saveQuizData(courseId, module.id, lesson.id, data).catch((e) => logError('instructor/cursos/editar/autoSave', e))}
                            />
                          )}
                          {/* Recursos adicionales */}
                          <button
                            type="button"
                            className={styles.toggleRecursosBtn}
                            onClick={() => updateLessonRecursoField(module.id, lesson.id, 'showRecursos', !lesson.showRecursos)}
                          >
                            {lesson.showRecursos ? '▲' : '▼'} Recursos ({lesson.recursos.length})
                          </button>
                          {lesson.showRecursos && (
                            <div className={styles.recursosSection}>
                              {lesson.recursos.map((r) => (
                                <div key={r.id} className={styles.recursoItem}>
                                  <span className={styles.recursoType}>{r.tipo.toUpperCase()}</span>
                                  <a href={r.url} target="_blank" rel="noopener noreferrer" className={styles.recursoTitle}>
                                    {r.titulo}
                                  </a>
                                  <button
                                    type="button"
                                    className={styles.deleteRecursoBtn}
                                    onClick={() => deleteRecurso(module.id, lesson.id, r.id)}
                                  >✕</button>
                                </div>
                              ))}
                              <div className={styles.addRecursoForm}>
                                <input
                                  type="text"
                                  placeholder="Nombre del recurso (opcional)"
                                  value={lesson.newRecursoTitulo}
                                  onChange={(e) => updateLessonRecursoField(module.id, lesson.id, 'newRecursoTitulo', e.target.value)}
                                  className={styles.recursoInput}
                                />
                                <label className={styles.recursoFileLabel}>
                                  <input
                                    type="file"
                                    accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
                                    multiple
                                    style={{ display: 'none' }}
                                    onChange={(e) => {
                                      if (e.target.files?.length) handleRecursoFileSelect(lesson.id, e.target.files);
                                    }}
                                  />
                                  {pendingRecursoFiles[lesson.id]?.length
                                    ? `${pendingRecursoFiles[lesson.id].length} archivo(s) seleccionado(s)`
                                    : '📎 Seleccionar archivos'}
                                </label>
                                <button
                                  type="button"
                                  className={styles.addRecursoBtn}
                                  onClick={() => addRecurso(module.id, lesson)}
                                  disabled={!pendingRecursoFiles[lesson.id]?.length}
                                >
                                  + Subir recurso
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}

                    {choosingForModule === module.id ? (
                      <LessonTypeSelector
                        onSelect={(tipo) => confirmAddLesson(module.id, tipo)}
                        onCancel={() => setChoosingForModule(null)}
                      />
                    ) : (
                    <button className={styles.addLessonButton} onClick={() => setChoosingForModule(module.id)}>
                      + Agregar lección
                    </button>
                    )}
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
