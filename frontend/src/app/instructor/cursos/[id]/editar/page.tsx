'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { cursosApi, categoriasApi } from '@/lib/api/client';
import VideoUploadButton from '@/components/video/VideoUploadButton';
import LessonTypeSelector from '@/components/course/LessonTypeSelector';
import LessonMoveButtons from '@/components/course/LessonMoveButtons';
import QuizBuilder from '@/components/course/QuizBuilder';
import type { QuizData } from '@/types/course';
import { validateQuiz } from '@/lib/quizValidation';
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
  nivel?: string;
  categoria_id?: string;
  portada_url?: string | null;
  estado?: string;
  modulos: ApiModulo[];
  precio?: number | string | null;
  moneda?: string;
  lo_que_aprenderas?: string[];
  requisitos?: string;
  destacado?: boolean;
  notas_revision?: string | null;
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

const STEPS = [
  { id: 1, name: 'Info Básica', icon: '1' },
  { id: 2, name: 'Portada', icon: '2' },
  { id: 3, name: 'Estructura', icon: '3' },
  { id: 4, name: 'Configuración', icon: '4' },
  { id: 5, name: 'Guardar', icon: '5' },
];

export default function EditarCursoInstructorPage() {
  const router = useRouter();
  const params = useParams();
  const courseId = params.id as string;

  const [currentStep, setCurrentStep] = useState(1);

  // Step 1
  const [courseTitle, setCourseTitle] = useState('');
  const [courseDescription, setCourseDescription] = useState('');
  const [category, setCategory] = useState('');
  const [categories, setCategories] = useState<ApiCategoria[]>([]);
  const [showNewCatInput, setShowNewCatInput] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);
  const [level, setLevel] = useState('');
  const [loQueAprenderas, setLoQueAprenderas] = useState('');
  const [requisitos, setRequisitos] = useState('');
  const [precio, setPrecio] = useState('');
  const [moneda, setMoneda] = useState('MXN');
  const [saveError, setSaveError] = useState('');

  // Step 2
  const [coverImagePreview, setCoverImagePreview] = useState('');
  const [coverUploadStatus, setCoverUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');

  // Step 3
  const [modules, setModules] = useState<Module[]>([]);
  const [pendingRecursoFiles, setPendingRecursoFiles] = useState<Record<string, File[]>>({});
  const [choosingForModule, setChoosingForModule] = useState<string | null>(null);

  // Step 4
  const [allowComments, setAllowComments] = useState(true);
  const [certificateEnabled, setCertificateEnabled] = useState(true);
  const [requireSequential, setRequireSequential] = useState(false);
  const [destacado, setDestacado] = useState(false);

  // General
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSendingReview, setIsSendingReview] = useState(false);
  const [cursoEstado, setCursoEstado] = useState('borrador');
  const [notasRevision, setNotasRevision] = useState('');
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
      setLevel(curso.nivel || '');
      if (curso.precio != null) setPrecio(String(curso.precio));
      if (curso.moneda) setMoneda(curso.moneda);
      if (curso.portada_url) setCoverImagePreview(curso.portada_url);
      if (curso.lo_que_aprenderas?.length) setLoQueAprenderas(curso.lo_que_aprenderas.join('\n'));
      if (curso.requisitos) setRequisitos(curso.requisitos);
      setDestacado(!!curso.destacado);
      if (curso.estado) setCursoEstado(curso.estado);
      setNotasRevision(curso.notas_revision || '');
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
            quizData: l.contenido
              ? (() => { try { return JSON.parse(l.contenido!); } catch { return { preguntas: [] }; } })()
              : { preguntas: [] },
          })),
        }))
      );
    }).catch((e) => logError('instructor/cursos/editar/load', e)).finally(() => setLoading(false));
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

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCoverImagePreview(URL.createObjectURL(file));
    setCoverUploadStatus('uploading');
    try {
      await cursosApi.uploadCover(courseId, file);
      setCoverUploadStatus('success');
    } catch {
      setCoverUploadStatus('error');
    }
  };

  // Módulos
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
    if (!confirm('¿Eliminar este módulo y todas sus lecciones?')) return;
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
    if (!confirm('¿Eliminar esta lección?')) return;
    try {
      await cursosApi.deleteLeccion(courseId, moduleId, lessonId);
      setModules((prev) => prev.map((m) =>
        m.id === moduleId ? { ...m, lessons: m.lessons.filter((l) => l.id !== lessonId) } : m
      ));
    } catch {
      notify('error', 'Error al eliminar la lección');
    }
  };

  // Reordenar una lección dentro de su módulo (botones ↑/↓): intercambia con la
  // vecina en el estado local y persiste el nuevo `orden` de ambas.
  const moveLesson = (moduleId: string, index: number, dir: 'up' | 'down') => {
    const mod = modules.find((m) => m.id === moduleId);
    if (!mod) return;
    const target = index + (dir === 'up' ? -1 : 1);
    if (target < 0 || target >= mod.lessons.length) return;
    const lessons = [...mod.lessons];
    [lessons[index], lessons[target]] = [lessons[target], lessons[index]];
    setModules((prev) => prev.map((m) => (m.id === moduleId ? { ...m, lessons } : m)));
    cursosApi.updateLeccion(courseId, moduleId, lessons[index].id, { orden: index + 1 })
      .catch((e) => logError('instructor/cursos/editar/reorder', e));
    cursosApi.updateLeccion(courseId, moduleId, lessons[target].id, { orden: target + 1 })
      .catch((e) => logError('instructor/cursos/editar/reorder', e));
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

  const handleDescargarRecurso = useCallback(async (recursoId: string) => {
    try {
      await cursosApi.descargarRecurso(recursoId);
    } catch (e) {
      logError('instructor/cursos/editar/descargarRecurso', e);
      const detail = (e as { detail?: string })?.detail || 'No se pudo abrir el recurso.';
      notify('error', detail);
    }
  }, []);

  const doSave = async (): Promise<void> => {
    const precioNum = precio.trim() === '' ? null : Number(precio);
    if (precioNum !== null && (Number.isNaN(precioNum) || precioNum < 0)) {
      throw new Error('El precio debe ser un número válido (0 o mayor)');
    }
    await cursosApi.update(courseId, {
      titulo: courseTitle,
      descripcion: courseDescription,
      nivel: level || undefined,
      precio: precioNum,
      moneda,
      lo_que_aprenderas: loQueAprenderas.split('\n').map((s) => s.trim()).filter(Boolean),
      requisitos: requisitos.trim() || undefined,
      destacado,
      ...(category ? { categoria_id: category } : {}),
    });
    await Promise.all(modules.map(async (m) => {
      await cursosApi.updateModulo(courseId, m.id, { titulo: m.title, descripcion: m.description });
      await Promise.all(m.lessons.map((l) =>
        cursosApi.updateLeccion(courseId, m.id, l.id, { titulo: l.title, es_visible: l.isVisible })
      ));
    }));
  };

  const handleNext = async () => {
    if (currentStep === 1) {
      setSaveError('');
      const precioNum = precio.trim() === '' ? null : Number(precio);
      if (precioNum !== null && (Number.isNaN(precioNum) || precioNum < 0)) {
        setSaveError('El precio debe ser un número válido (0 o mayor)');
        return;
      }
      setIsSaving(true);
      try {
        await cursosApi.update(courseId, {
          titulo: courseTitle,
          descripcion: courseDescription,
          nivel: level || undefined,
          precio: precioNum,
          moneda,
          lo_que_aprenderas: loQueAprenderas.split('\n').map((s) => s.trim()).filter(Boolean),
          requisitos: requisitos.trim() || undefined,
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
    if (currentStep < 5) setCurrentStep(currentStep + 1);
  };

  const handlePrev = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await doSave();
      notify('success', 'Cambios guardados correctamente');
    } catch {
      notify('error', 'Error al guardar los cambios');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSendToReview = async () => {
    if (!level) {
      notify('error', 'Selecciona el nivel del curso antes de enviarlo a revisión');
      return;
    }
    // Bloquear publicación si algún quiz está incompleto (sin respuesta correcta,
    // sin enunciado, etc.) — de otro modo el alumno no podría aprobarlo.
    const quizErrors: string[] = [];
    modules.forEach((m) => {
      m.lessons.forEach((l) => {
        if (l.tipo !== 'quiz') return;
        const issues = validateQuiz(l.quizData);
        if (issues.length) quizErrors.push(`"${l.title || 'Quiz sin título'}": ${issues.join('; ')}`);
      });
    });
    if (quizErrors.length) {
      notify('error', `Corrige los quizzes antes de publicar — ${quizErrors[0]}${quizErrors.length > 1 ? ` (y ${quizErrors.length - 1} más)` : ''}`);
      return;
    }
    setIsSendingReview(true);
    try {
      await doSave();
      // Al reenviar se limpian las notas de la revisión anterior.
      await cursosApi.update(courseId, { estado: 'revision', notas_revision: '' });
      setCursoEstado('revision');
      setNotasRevision('');
      notify('success', 'Curso enviado a revisión');
    } catch {
      notify('error', 'Error al enviar a revisión');
    } finally {
      setIsSendingReview(false);
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

      <div className={styles.pageHeader}>
        <div className={styles.headerLeft}>
          <button className={styles.returnButton} onClick={() => router.push('/instructor/cursos')}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            Volver a cursos
          </button>
          <h1 className={styles.pageTitle}>Editar Curso</h1>
        </div>
      </div>

      {notasRevision && (cursoEstado === 'borrador' || cursoEstado === 'rechazado') && (
        <div style={{
          display: 'flex', gap: '0.75rem', alignItems: 'flex-start',
          padding: '1rem 1.25rem', margin: '0 0 1rem',
          background: cursoEstado === 'rechazado' ? '#fef2f2' : '#fffbeb',
          border: `1px solid ${cursoEstado === 'rechazado' ? '#fecaca' : '#fcd34d'}`,
          borderRadius: '0.75rem',
        }}>
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8}
            stroke={cursoEstado === 'rechazado' ? '#b91c1c' : '#b45309'} width="20" height="20" style={{ flexShrink: 0, marginTop: '0.1rem' }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
          <div>
            <p style={{ margin: '0 0 0.25rem', fontWeight: 700, color: cursoEstado === 'rechazado' ? '#991b1b' : '#92400e' }}>
              {cursoEstado === 'rechazado' ? 'Curso rechazado por el administrador' : 'El administrador solicitó cambios'}
            </p>
            <p style={{ margin: 0, fontSize: '0.9rem', color: cursoEstado === 'rechazado' ? '#7f1d1d' : '#78350f', whiteSpace: 'pre-wrap' }}>
              {notasRevision}
            </p>
            <p style={{ margin: '0.5rem 0 0', fontSize: '0.8rem', color: '#64748b' }}>
              Corrige lo indicado y vuelve a enviar el curso a revisión.
            </p>
          </div>
        </div>
      )}

      <div className={styles.contentWrapper}>
        <aside className={styles.sidebar}>
          <nav className={styles.stepNav}>
            {STEPS.map((step) => (
              <button
                key={step.id}
                className={`${styles.stepButton} ${currentStep === step.id ? styles.active : ''}`}
                onClick={() => setCurrentStep(step.id)}
              >
                <span className={styles.stepIcon}>{step.icon}</span>
                <span className={styles.stepName}>{step.name}</span>
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
                  <input
                    type="text"
                    value={courseTitle}
                    onChange={(e) => setCourseTitle(e.target.value)}
                    className={styles.input}
                    placeholder="Ej: Facturación Electrónica Avanzada"
                  />
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.label}>Descripción <span className={styles.required}>*</span></label>
                  <textarea
                    value={courseDescription}
                    onChange={(e) => setCourseDescription(e.target.value)}
                    className={styles.textarea}
                    rows={5}
                    placeholder="Describe el contenido y objetivos del curso..."
                  />
                </div>

                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>Categoría</label>
                    {!showNewCatInput ? (
                      <select value={category} onChange={handleCategoryChange} className={styles.select}>
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
                          className={styles.input}
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
                  <div className={styles.formGroup}>
                    <label className={styles.label}>Nivel <span className={styles.required}>*</span></label>
                    <select value={level} onChange={(e) => setLevel(e.target.value)} className={styles.select}>
                      <option value="">Seleccionar nivel</option>
                      <option value="principiante">Principiante</option>
                      <option value="intermedio">Intermedio</option>
                      <option value="avanzado">Avanzado</option>
                    </select>
                  </div>
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.label}>Lo que aprenderás</label>
                  <textarea
                    value={loQueAprenderas}
                    onChange={(e) => setLoQueAprenderas(e.target.value)}
                    className={styles.textarea}
                    rows={4}
                    placeholder={'Escribe un punto por línea, por ejemplo:\nIdentificar procesos de facturación\nUsar herramientas de gestión'}
                  />
                  <small style={{ color: 'var(--color-text-secondary)', fontSize: '0.8rem' }}>Un elemento por línea</small>
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.label}>Requisitos previos</label>
                  <textarea
                    value={requisitos}
                    onChange={(e) => setRequisitos(e.target.value)}
                    className={styles.textarea}
                    rows={3}
                    placeholder="Ej: Conocimientos básicos de computación, acceso a internet..."
                  />
                </div>

                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>Precio</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={precio}
                      onChange={(e) => setPrecio(e.target.value)}
                      className={styles.input}
                      placeholder="Vacio o 0 = curso gratuito"
                    />
                    <span style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '0.25rem', display: 'block' }}>
                      Deja vacio o 0 para que el curso sea gratuito.
                    </span>
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>Moneda</label>
                    <select value={moneda} onChange={(e) => setMoneda(e.target.value)} className={styles.select}>
                      <option value="MXN">MXN — Peso Mexicano</option>
                      <option value="USD">USD — Dolar</option>
                      <option value="EUR">EUR — Euro</option>
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
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={coverImagePreview} alt="Preview" className={styles.previewImage} />
                      <label className={styles.removeImageButton} style={{ cursor: 'pointer' }}>
                        <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={handleImageUpload} className={styles.fileInput} />
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M17 1l4 4-4 4" /><path d="M3 11V9a4 4 0 0 1 4-4h14" /><path d="M7 23l-4-4 4-4" /><path d="M21 13v2a4 4 0 0 1-4 4H3" />
                        </svg>
                        Cambiar imagen
                      </label>
                      {coverUploadStatus === 'uploading' && (
                        <p style={{ marginTop: '0.5rem', color: '#2563eb', fontSize: '0.875rem', fontWeight: 500 }}>
                          Subiendo imagen al servidor...
                        </p>
                      )}
                      {coverUploadStatus === 'success' && (
                        <p style={{ marginTop: '0.5rem', color: '#16a34a', fontSize: '0.875rem', fontWeight: 500 }}>
                          Imagen guardada correctamente
                        </p>
                      )}
                      {coverUploadStatus === 'error' && (
                        <p style={{ marginTop: '0.5rem', color: '#dc2626', fontSize: '0.875rem', fontWeight: 500 }}>
                          Error al subir. Selecciona la imagen de nuevo para reintentar.
                        </p>
                      )}
                    </div>
                  ) : (
                    <label className={styles.uploadLabel}>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        onChange={handleImageUpload}
                        className={styles.fileInput}
                      />
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
                                  <LessonMoveButtons
                                    onUp={() => moveLesson(module.id, lessonIndex, 'up')}
                                    onDown={() => moveLesson(module.id, lessonIndex, 'down')}
                                    disableUp={lessonIndex === 0}
                                    disableDown={lessonIndex === module.lessons.length - 1}
                                  />
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
                                      onSave={(data) => cursosApi.saveQuizData(courseId, module.id, lesson.id, data).catch((e) => logError('instructor/cursos/editar/quiz', e))}
                                    />
                                  )}
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
                                          <button type="button" className={styles.recursoTitle} onClick={() => handleDescargarRecurso(r.id)} title="Descargar recurso">
                                            {r.titulo}
                                          </button>
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
                                            : 'Seleccionar archivos'}
                                        </label>
                                        <button
                                          type="button"
                                          className={styles.addRecursoBtn}
                                          onClick={() => addRecurso(module.id, lesson)}
                                          disabled={!pendingRecursoFiles[lesson.id]?.length}
                                        >
                                          Subir recurso
                                        </button>
                                        <p className={styles.recursoHint}>
                                          Formatos: PDF, Word, Excel o PowerPoint · máx. 20 MB
                                        </p>
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
            )}

            {/* Step 4: Configuración */}
            {currentStep === 4 && (
              <div className={styles.stepContent}>
                <h2 className={styles.stepTitle}>Configuración</h2>
                <p className={styles.stepDescription}>Ajusta las opciones adicionales del curso</p>

                <div className={styles.configSection}>
                  <label className={styles.checkboxLabel}>
                    <input
                      type="checkbox"
                      className={styles.checkbox}
                      checked={allowComments}
                      onChange={(e) => setAllowComments(e.target.checked)}
                    />
                    <div className={styles.checkboxContent}>
                      <span className={styles.checkboxTitle}>Permitir comentarios</span>
                      <span className={styles.checkboxDescription}>Los estudiantes podrán dejar comentarios en las lecciones</span>
                    </div>
                  </label>

                  <label className={styles.checkboxLabel}>
                    <input
                      type="checkbox"
                      className={styles.checkbox}
                      checked={certificateEnabled}
                      onChange={(e) => setCertificateEnabled(e.target.checked)}
                    />
                    <div className={styles.checkboxContent}>
                      <span className={styles.checkboxTitle}>Certificado de finalización</span>
                      <span className={styles.checkboxDescription}>Los estudiantes recibirán un certificado al completar el curso</span>
                    </div>
                  </label>

                  <label className={styles.checkboxLabel}>
                    <input
                      type="checkbox"
                      className={styles.checkbox}
                      checked={requireSequential}
                      onChange={(e) => setRequireSequential(e.target.checked)}
                    />
                    <div className={styles.checkboxContent}>
                      <span className={styles.checkboxTitle}>Avance secuencial</span>
                      <span className={styles.checkboxDescription}>Los estudiantes deben completar cada lección antes de avanzar</span>
                    </div>
                  </label>

                  <label className={styles.checkboxLabel}>
                    <input
                      type="checkbox"
                      className={styles.checkbox}
                      checked={destacado}
                      onChange={(e) => setDestacado(e.target.checked)}
                    />
                    <div className={styles.checkboxContent}>
                      <span className={styles.checkboxTitle}>Destacar curso</span>
                      <span className={styles.checkboxDescription}>Aparecerá en el carrete de cursos destacados de la pantalla de inicio</span>
                    </div>
                  </label>
                </div>
              </div>
            )}

            {/* Step 5: Guardar */}
            {currentStep === 5 && (
              <div className={styles.stepContent}>
                <h2 className={styles.stepTitle}>Guardar</h2>
                <p className={styles.stepDescription}>Revisa el resumen y guarda los cambios</p>

                <div className={styles.summaryGrid}>
                  <div className={styles.summaryCard}>
                    <span className={styles.summaryLabel}>Título</span>
                    <span className={styles.summaryValue}>{courseTitle || '—'}</span>
                  </div>
                  <div className={styles.summaryCard}>
                    <span className={styles.summaryLabel}>Nivel</span>
                    <span className={styles.summaryValue}>{level || 'Sin nivel'}</span>
                  </div>
                  <div className={styles.summaryCard}>
                    <span className={styles.summaryLabel}>Precio</span>
                    <span className={styles.summaryValue}>
                      {precio.trim() === '' || precio === '0' ? 'Gratuito' : `${precio} ${moneda}`}
                    </span>
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
                    <span className={styles.summaryLabel}>Estado</span>
                    <span className={styles.summaryValue}>{cursoEstado}</span>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                  <button
                    className={styles.nextButton}
                    onClick={handleSave}
                    disabled={isSaving || isSendingReview}
                    style={{ minWidth: '160px' }}
                  >
                    {isSaving ? 'Guardando...' : 'Guardar cambios'}
                  </button>
                  {(cursoEstado === 'borrador' || cursoEstado === 'rechazado') && (
                    <button
                      className={styles.publishButton}
                      onClick={handleSendToReview}
                      disabled={isSaving || isSendingReview}
                      style={{ minWidth: '180px' }}
                    >
                      {isSendingReview ? 'Enviando...' : 'Enviar a revisión'}
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Navegación entre pasos */}
            <div className={styles.navigationButtons}>
              <button
                className={styles.backButton}
                onClick={handlePrev}
                disabled={currentStep === 1}
              >
                Anterior
              </button>
              {currentStep < 5 && (
                <button
                  className={styles.nextButton}
                  onClick={handleNext}
                  disabled={isSaving}
                >
                  {currentStep === 1 && isSaving ? 'Guardando...' : 'Siguiente'}
                </button>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
