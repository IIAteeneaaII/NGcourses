'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { cursosApi, categoriasApi } from '@/lib/api/client';
import VideoUploadButton from '@/components/video/VideoUploadButton';
import styles from './page.module.css';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

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
  nivel?: string;
  categoria_id?: string;
  portada_url?: string | null;
  estado?: string;
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
  isVisible: boolean;
  bunnyVideoId: string | null;
  recursos: RecursoItem[];
  showRecursos: boolean;
  newRecursoTitulo: string;
}

interface Module {
  id: string;
  title: string;
  description: string;
  lessons: Lesson[];
  isExpanded: boolean;
}

const STEPS = [
  { id: 1, name: 'Info Básica', icon: '1' },
  { id: 2, name: 'Portada', icon: '2' },
  { id: 3, name: 'Estructura', icon: '3' },
  { id: 4, name: 'Configuración', icon: '4' },
  { id: 5, name: 'Guardar', icon: '5' },
];

export default function EditarCursoAdminPage() {
  const router = useRouter();
  const params = useParams();
  const cursoId = params.id as string;

  const [currentStep, setCurrentStep] = useState(1);
  const [showPreview, setShowPreview] = useState(false);
  const [categories, setCategories] = useState<ApiCategoria[]>([]);
  const [loading, setLoading] = useState(true);

  // Step 1
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [level, setLevel] = useState('');

  // Step 2
  const [coverImagePreview, setCoverImagePreview] = useState('');
  const [coverFile, setCoverFile] = useState<File | null>(null);

  // Step 3
  const [modules, setModules] = useState<Module[]>([]);
  const [pendingRecursoFiles, setPendingRecursoFiles] = useState<Record<string, File[]>>({});

  // Step 4
  const [allowComments, setAllowComments] = useState(true);
  const [certificateEnabled, setCertificateEnabled] = useState(true);
  const [requireSequential, setRequireSequential] = useState(false);

  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    Promise.all([
      categoriasApi.list(),
      cursosApi.get(cursoId),
    ]).then(([cats, raw]) => {
      setCategories(cats as ApiCategoria[]);
      const curso = raw as ApiCurso;
      setTitle(curso.titulo);
      setDescription(curso.descripcion || '');
      setLevel(curso.nivel || '');
      setCategory(curso.categoria_id || '');
      if (curso.portada_url) {
        setCoverImagePreview(`${API_URL}${curso.portada_url}`);
      }
      setModules(
        (curso.modulos || []).map((m) => ({
          id: m.id,
          title: m.titulo,
          description: m.descripcion || '',
          isExpanded: true,
          lessons: (m.lecciones || []).map((l) => ({
            id: l.id,
            title: l.titulo,
            isVisible: l.es_visible,
            bunnyVideoId: l.bunny_video_id,
            recursos: l.recursos || [],
            showRecursos: false,
            newRecursoTitulo: '',
          })),
        }))
      );
    }).catch(() => {}).finally(() => setLoading(false));
  }, [cursoId]);

  const handleNext = async () => {
    if (currentStep === 1) {
      setIsSaving(true);
      setSaveError('');
      try {
        await cursosApi.update(cursoId, {
          titulo: title,
          descripcion: description,
          ...(category ? { categoria_id: category } : {}),
        });
        setCurrentStep(2);
      } catch {
        setSaveError('Error al guardar la información básica');
      } finally {
        setIsSaving(false);
      }
      return;
    }
    if (currentStep === 2 && coverFile) {
      try {
        await cursosApi.uploadCover(cursoId, coverFile);
      } catch {
        // No bloqueamos si falla la portada
      }
    }
    if (currentStep < STEPS.length) setCurrentStep(currentStep + 1);
  };

  const handlePrev = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await cursosApi.update(cursoId, { titulo: title, descripcion: description });
      router.push('/admin/cursos');
    } catch {
      alert('Error al guardar los cambios');
    } finally {
      setIsSaving(false);
    }
  };

  // Módulos
  const addModule = async () => {
    try {
      const resp = await cursosApi.createModulo(cursoId, {
        titulo: 'Nuevo módulo',
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
      alert('Error al crear el módulo');
    }
  };

  const updateModuleLocal = (moduleId: string, updates: Partial<Module>) => {
    setModules((prev) => prev.map((m) => m.id === moduleId ? { ...m, ...updates } : m));
  };

  const deleteModule = async (moduleId: string) => {
    if (!confirm('¿Eliminar este módulo y todas sus lecciones?')) return;
    try {
      await cursosApi.deleteModulo(cursoId, moduleId);
      setModules((prev) => prev.filter((m) => m.id !== moduleId));
    } catch {
      alert('Error al eliminar el módulo');
    }
  };

  // Lecciones
  const addLesson = async (moduleId: string) => {
    const mod = modules.find((m) => m.id === moduleId);
    if (!mod) return;
    try {
      const resp = await cursosApi.createLeccion(cursoId, moduleId, {
        titulo: 'Nueva lección',
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
            isVisible: resp.es_visible,
            bunnyVideoId: resp.bunny_video_id,
            recursos: [],
            showRecursos: false,
            newRecursoTitulo: '',
          }],
        } : m
      ));
    } catch {
      alert('Error al crear la lección');
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
    if (!confirm('¿Eliminar esta lección?')) return;
    try {
      await cursosApi.deleteLeccion(cursoId, moduleId, lessonId);
      setModules((prev) => prev.map((m) =>
        m.id === moduleId ? { ...m, lessons: m.lessons.filter((l) => l.id !== lessonId) } : m
      ));
    } catch {
      alert('Error al eliminar la lección');
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
          cursoId, moduleId, lesson.id, file,
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
      alert('Error al agregar el recurso');
    }
  }, [cursoId, pendingRecursoFiles]);

  const deleteRecurso = useCallback(async (moduleId: string, lessonId: string, recursoId: string) => {
    try {
      await cursosApi.deleteRecurso(cursoId, moduleId, lessonId, recursoId);
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
      alert('Error al eliminar el recurso');
    }
  }, [cursoId]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCoverFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setCoverImagePreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const isStepComplete = (step: number): boolean => {
    switch (step) {
      case 1: return !!(title && description);
      case 2: return true;
      case 3: return true;
      case 4: return true;
      case 5: return true;
      default: return false;
    }
  };

  const totalLessons = modules.reduce((acc, m) => acc + m.lessons.length, 0);

  if (loading) {
    return (
      <div className={styles.pageContainer}>
        <div className={styles.loading}>Cargando curso...</div>
      </div>
    );
  }

  return (
    <div className={styles.pageContainer}>
      <div className={styles.pageHeader}>
        <div className={styles.headerLeft}>
          <button className={styles.returnButton} onClick={() => router.push('/admin/cursos')}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            Volver a cursos
          </button>
          <h1 className={styles.pageTitle}>Editar Curso</h1>
        </div>
        <button className={styles.previewButton} onClick={() => setShowPreview(true)}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
          Vista previa
        </button>
      </div>

      <div className={styles.contentWrapper}>
        <aside className={styles.sidebar}>
          <nav className={styles.stepNav}>
            {STEPS.map((step) => (
              <button
                key={step.id}
                className={`${styles.stepButton} ${currentStep === step.id ? styles.active : ''} ${isStepComplete(step.id) ? styles.complete : ''}`}
                onClick={() => setCurrentStep(step.id)}
              >
                <span className={styles.stepIcon}>{step.icon}</span>
                <span className={styles.stepName}>{step.name}</span>
                {isStepComplete(step.id) && currentStep !== step.id && (
                  <span className={styles.checkmark}>✓</span>
                )}
              </button>
            ))}
          </nav>
        </aside>

        <main className={styles.mainContent}>
          <div className={styles.formContainer}>

            {/* Step 1: Info Básica */}
            {currentStep === 1 && (
              <div className={styles.stepContent}>
                <h2 className={styles.stepTitle}>Información Básica</h2>
                <p className={styles.stepDescription}>Edita la información fundamental del curso</p>

                <div className={styles.formGroup}>
                  <label className={styles.label}>Título del curso <span className={styles.required}>*</span></label>
                  <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className={styles.input} placeholder="Ej: Facturación Electrónica Avanzada" />
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.label}>Descripción <span className={styles.required}>*</span></label>
                  <textarea value={description} onChange={(e) => setDescription(e.target.value)} className={styles.textarea} rows={5} placeholder="Describe el contenido y objetivos del curso..." />
                </div>

                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>Categoría</label>
                    <select value={category} onChange={(e) => setCategory(e.target.value)} className={styles.select}>
                      <option value="">Sin categoría</option>
                      {categories.map((cat) => (
                        <option key={cat.id} value={cat.id}>{cat.nombre}</option>
                      ))}
                    </select>
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>Nivel</label>
                    <select value={level} onChange={(e) => setLevel(e.target.value)} className={styles.select}>
                      <option value="">Seleccionar nivel</option>
                      <option value="principiante">Principiante</option>
                      <option value="intermedio">Intermedio</option>
                      <option value="avanzado">Avanzado</option>
                    </select>
                  </div>
                </div>

                {saveError && (
                  <p style={{ color: 'red', padding: '0.75rem', background: '#fff5f5', borderRadius: '0.5rem', border: '1px solid #fed7d7' }}>
                    {saveError}
                  </p>
                )}
              </div>
            )}

            {/* Step 2: Portada */}
            {currentStep === 2 && (
              <div className={styles.stepContent}>
                <h2 className={styles.stepTitle}>Imagen de Portada</h2>
                <p className={styles.stepDescription}>Sube una imagen atractiva para tu curso (recomendado: 1200x675px)</p>

                <div className={styles.uploadArea}>
                  {coverImagePreview ? (
                    <div className={styles.imagePreview}>
                      <img src={coverImagePreview} alt="Preview" className={styles.previewImage} />
                      <button className={styles.removeImageButton} onClick={() => { setCoverImagePreview(''); setCoverFile(null); }}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2M10 11v6M14 11v6" />
                        </svg>
                        Cambiar imagen
                      </button>
                    </div>
                  ) : (
                    <label className={styles.uploadLabel}>
                      <input type="file" accept="image/*" onChange={handleImageUpload} className={styles.fileInput} />
                      <div className={styles.uploadPlaceholder}>
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" />
                        </svg>
                        <p className={styles.uploadText}>Haz clic para subir una imagen</p>
                        <p className={styles.uploadHint}>PNG, JPG o WEBP (máx. 5MB)</p>
                      </div>
                    </label>
                  )}
                </div>
              </div>
            )}

            {/* Step 3: Estructura */}
            {currentStep === 3 && (
              <div className={styles.stepContent}>
                <h2 className={styles.stepTitle}>Estructura del Curso</h2>
                <p className={styles.stepDescription}>Administra módulos, lecciones, videos y recursos.</p>

                <div className={styles.modulesContainer}>
                  {modules.map((module, moduleIndex) => (
                    <div key={module.id} className={styles.moduleCard}>
                      <div className={styles.moduleHeader}>
                        <button className={styles.expandButton} onClick={() => updateModuleLocal(module.id, { isExpanded: !module.isExpanded })}>
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
                          onBlur={() => cursosApi.updateModulo(cursoId, module.id, { titulo: module.title, descripcion: module.description }).catch(() => {})}
                          className={styles.moduleTitleInput}
                          placeholder="Título del módulo"
                        />
                        <span className={styles.lessonCount}>{module.lessons.length} lecciones</span>
                        <button className={styles.deleteModuleButton} onClick={() => deleteModule(module.id)} title="Eliminar módulo">
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
                              onBlur={() => cursosApi.updateModulo(cursoId, module.id, { titulo: module.title, descripcion: module.description }).catch(() => {})}
                              className={styles.moduleDescriptionInput}
                              placeholder="Descripción del módulo (opcional)"
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
                                    onBlur={() => cursosApi.updateLeccion(cursoId, module.id, lesson.id, { titulo: lesson.title, es_visible: lesson.isVisible }).catch(() => {})}
                                    className={styles.lessonTitleInput}
                                    placeholder="Título de la lección"
                                  />
                                  <label className={styles.toggleLabel}>
                                    <input
                                      type="checkbox"
                                      checked={lesson.isVisible}
                                      onChange={(e) => {
                                        updateLessonLocal(module.id, lesson.id, { isVisible: e.target.checked });
                                        cursosApi.updateLeccion(cursoId, module.id, lesson.id, { titulo: lesson.title, es_visible: e.target.checked }).catch(() => {});
                                      }}
                                      className={styles.toggleInput}
                                    />
                                    <span className={styles.toggleSlider}></span>
                                  </label>
                                  <button className={styles.deleteLessonButton} onClick={() => deleteLesson(module.id, lesson.id)} title="Eliminar lección">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                      <path d="M18 6L6 18M6 6l12 12" />
                                    </svg>
                                  </button>
                                </div>
                                <div className={styles.lessonInputs}>
                                  <VideoUploadButton
                                    cursoId={cursoId}
                                    moduloId={module.id}
                                    leccionId={lesson.id}
                                    currentBunnyVideoId={lesson.bunnyVideoId}
                                    onUploadComplete={(videoId) => updateLessonLocal(module.id, lesson.id, { bunnyVideoId: videoId })}
                                  />
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
                                          <a href={r.url.startsWith('/') ? `${API_URL}${r.url}` : r.url} target="_blank" rel="noopener noreferrer" className={styles.recursoTitle}>
                                            {r.titulo}
                                          </a>
                                          <button type="button" className={styles.deleteRecursoBtn} onClick={() => deleteRecurso(module.id, lesson.id, r.id)}>✕</button>
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
                                            onChange={(e) => { if (e.target.files?.length) handleRecursoFileSelect(lesson.id, e.target.files); }}
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

                            <button className={styles.addLessonButton} onClick={() => addLesson(module.id)}>
                              + Agregar lección
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
                    Agregar módulo
                  </button>
                </div>
              </div>
            )}

            {/* Step 4: Configuración */}
            {currentStep === 4 && (
              <div className={styles.stepContent}>
                <h2 className={styles.stepTitle}>Configuración</h2>
                <p className={styles.stepDescription}>Personaliza las opciones del curso</p>

                <div className={styles.configSection}>
                  <label className={styles.checkboxLabel}>
                    <input type="checkbox" checked={allowComments} onChange={(e) => setAllowComments(e.target.checked)} className={styles.checkbox} />
                    <div className={styles.checkboxContent}>
                      <span className={styles.checkboxTitle}>Permitir comentarios</span>
                      <span className={styles.checkboxDescription}>Los estudiantes podrán comentar en las lecciones</span>
                    </div>
                  </label>
                  <label className={styles.checkboxLabel}>
                    <input type="checkbox" checked={certificateEnabled} onChange={(e) => setCertificateEnabled(e.target.checked)} className={styles.checkbox} />
                    <div className={styles.checkboxContent}>
                      <span className={styles.checkboxTitle}>Certificado de finalización</span>
                      <span className={styles.checkboxDescription}>Emitir certificado al completar el curso</span>
                    </div>
                  </label>
                  <label className={styles.checkboxLabel}>
                    <input type="checkbox" checked={requireSequential} onChange={(e) => setRequireSequential(e.target.checked)} className={styles.checkbox} />
                    <div className={styles.checkboxContent}>
                      <span className={styles.checkboxTitle}>Avance secuencial</span>
                      <span className={styles.checkboxDescription}>Las lecciones deben completarse en orden</span>
                    </div>
                  </label>
                </div>
              </div>
            )}

            {/* Step 5: Guardar */}
            {currentStep === 5 && (
              <div className={styles.stepContent}>
                <h2 className={styles.stepTitle}>Guardar Cambios</h2>
                <p className={styles.stepDescription}>Revisa el resumen y guarda los cambios</p>

                <div className={styles.summaryGrid}>
                  <div className={styles.summaryCard}>
                    <span className={styles.summaryLabel}>Título</span>
                    <span className={styles.summaryValue}>{title || 'Sin título'}</span>
                  </div>
                  <div className={styles.summaryCard}>
                    <span className={styles.summaryLabel}>Categoría</span>
                    <span className={styles.summaryValue}>{categories.find((c) => c.id === category)?.nombre || 'Sin categoría'}</span>
                  </div>
                  <div className={styles.summaryCard}>
                    <span className={styles.summaryLabel}>Nivel</span>
                    <span className={styles.summaryValue}>{level || 'Sin nivel'}</span>
                  </div>
                  <div className={styles.summaryCard}>
                    <span className={styles.summaryLabel}>Módulos</span>
                    <span className={styles.summaryValue}>{modules.length}</span>
                  </div>
                  <div className={styles.summaryCard}>
                    <span className={styles.summaryLabel}>Lecciones</span>
                    <span className={styles.summaryValue}>{totalLessons}</span>
                  </div>
                  <div className={styles.summaryCard}>
                    <span className={styles.summaryLabel}>Videos subidos</span>
                    <span className={styles.summaryValue}>
                      {modules.reduce((acc, m) => acc + m.lessons.filter((l) => l.bunnyVideoId).length, 0)} / {totalLessons}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Navigation */}
            <div className={styles.navigationButtons}>
              <button className={styles.backButton} onClick={handlePrev} disabled={currentStep === 1}>
                Atrás
              </button>

              {currentStep < STEPS.length ? (
                <button
                  className={styles.nextButton}
                  onClick={handleNext}
                  disabled={!isStepComplete(currentStep) || isSaving}
                >
                  {isSaving ? 'Guardando...' : 'Siguiente'}
                </button>
              ) : (
                <button className={styles.publishButton} onClick={handleSave} disabled={isSaving}>
                  {isSaving ? 'Guardando...' : 'Guardar cambios'}
                </button>
              )}
            </div>
          </div>
        </main>
      </div>

      {/* Preview Modal */}
      {showPreview && (
        <div className={styles.modalOverlay} onClick={() => setShowPreview(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>Vista Previa del Curso</h2>
              <button className={styles.closeButton} onClick={() => setShowPreview(false)}>×</button>
            </div>
            <div className={styles.modalBody}>
              {coverImagePreview && <img src={coverImagePreview} alt={title} className={styles.modalImage} />}
              <h3 className={styles.modalCourseTitle}>{title}</h3>
              <p className={styles.modalCourseDescription}>{description}</p>
              <div className={styles.modalMeta}>
                <span>Categoría: {categories.find((c) => c.id === category)?.nombre || '—'}</span>
                <span>Nivel: {level || '—'}</span>
              </div>
              <div className={styles.modalModules}>
                <h4>Contenido del curso</h4>
                {modules.map((module, idx) => (
                  <div key={module.id} className={styles.modalModule}>
                    <strong>Módulo {idx + 1}: {module.title || 'Sin título'}</strong>
                    <ul>
                      {module.lessons.map((lesson) => (
                        <li key={lesson.id}>{lesson.title || 'Sin título'}{lesson.bunnyVideoId ? ' ✓' : ''}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
