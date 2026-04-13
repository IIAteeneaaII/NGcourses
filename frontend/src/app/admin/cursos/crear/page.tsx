'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { cursosApi, categoriasApi } from '@/lib/api/client';
import VideoUploadButton from '@/components/video/VideoUploadButton';
import LessonTypeSelector from '@/components/course/LessonTypeSelector';
import QuizBuilder from '@/components/course/QuizBuilder';
import type { QuizData } from '@/types/course';
import { logError } from '@/lib/logger';
import styles from './page.module.css';

function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-') +
    '-' +
    Date.now()
  );
}

interface ApiCategoria { id: string; nombre: string }
interface ApiModulo { id: string; titulo: string; descripcion: string | null }
interface ApiLeccion { id: string; titulo: string; bunny_video_id: string | null; es_visible: boolean }
interface ApiLeccionRecurso { id: string; titulo: string; url: string; tipo: string }

interface RecursoItem {
  id: string;
  titulo: string;
  url: string;
  tipo: string;
}

interface Module {
  id: string;
  title: string;
  description: string;
  lessons: Lesson[];
  isExpanded: boolean;
}

interface Lesson {
  id: string;
  title: string;
  tipo: 'video' | 'quiz';
  isVisible: boolean;
  bunnyVideoId: string | null;
  recursos: RecursoItem[];
  showRecursos: boolean;
  newRecursoTitulo: string;
  quizData: QuizData;
}

const STEPS = [
  { id: 1, name: 'Info Básica', icon: '1' },
  { id: 2, name: 'Portada', icon: '2' },
  { id: 3, name: 'Estructura', icon: '3' },
  { id: 4, name: 'Configuración', icon: '4' },
  { id: 5, name: 'Publicar', icon: '5' },
];

export default function CrearCursoPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [showPreview, setShowPreview] = useState(false);
  const [categories, setCategories] = useState<ApiCategoria[]>([]);

  // Datos del step 1
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [level, setLevel] = useState('');
  const [loQueAprenderas, setLoQueAprenderas] = useState('');
  const [requisitos, setRequisitos] = useState('');

  // Portada
  const [coverImagePreview, setCoverImagePreview] = useState('');
  const [coverFile, setCoverFile] = useState<File | null>(null);

  // Curso ya creado en backend
  const [cursoId, setCursoId] = useState<string | null>(null);
  const [modules, setModules] = useState<Module[]>([]);

  // Configuración
  const [allowComments, setAllowComments] = useState(true);
  const [certificateEnabled, setCertificateEnabled] = useState(true);
  const [requireSequential, setRequireSequential] = useState(false);
  const [marca, setMarca] = useState<'ram' | 'nextgen'>('ram');

  // Archivos pendientes de recursos, clave = lessonId (soporte multi-archivo)
  const [pendingRecursoFiles, setPendingRecursoFiles] = useState<Record<string, File[]>>({});

  // Selector de tipo de lección (moduleId o null)
  const [choosingForModule, setChoosingForModule] = useState<string | null>(null);

  // UI state
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const [coverUploadStatus, setCoverUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [isAddingModule, setIsAddingModule] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishError, setPublishError] = useState('');
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const notify = React.useCallback((type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 3000);
  }, []);

  // Creación inline de categoría
  const [showNewCatInput, setShowNewCatInput] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);

  useEffect(() => {
    categoriasApi.list().then((data) => setCategories(data as ApiCategoria[])).catch((e) => logError('admin/cursos/crear/loadCategories', e));
  }, []);

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
      logError('admin/cursos/crear/createCategory', e);
    } finally {
      setIsCreatingCategory(false);
    }
  };

  // Avanzar paso — al ir de step 1 a step 2, crear el curso en backend
  const handleNext = async () => {
    if (currentStep === 1) {
      if (cursoId) {
        setCurrentStep(2);
        return;
      }
      setIsCreating(true);
      setCreateError('');
      try {
        const resp = await cursosApi.create({
          titulo: title,
          slug: slugify(title),
          descripcion: description,
          ...(category ? { categoria_id: category } : {}),
          estado: 'borrador',
          marca,
          es_gratis: true,
          nivel: level || undefined,
          lo_que_aprenderas: loQueAprenderas.split('\n').map((s) => s.trim()).filter(Boolean),
          requisitos: requisitos.trim() || undefined,
        }) as { id: string };
        setCursoId(resp.id);
        setCurrentStep(2);
      } catch (err) {
        setCreateError(err instanceof Error ? err.message : 'Error al crear el borrador');
      } finally {
        setIsCreating(false);
      }
      return;
    }
    if (currentStep < STEPS.length) setCurrentStep(currentStep + 1);
  };

  const handlePrev = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  // Módulos
  const addModule = async () => {
    if (!cursoId) return;
    setIsAddingModule(true);
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
      notify('error', 'Error al crear el módulo');
    } finally {
      setIsAddingModule(false);
    }
  };

  const updateModuleLocal = (moduleId: string, updates: Partial<Module>) => {
    setModules((prev) => prev.map((m) => m.id === moduleId ? { ...m, ...updates } : m));
  };

  const deleteModule = async (moduleId: string) => {
    if (!cursoId || !confirm('¿Eliminar este módulo y todas sus lecciones?')) return;
    try {
      await cursosApi.deleteModulo(cursoId, moduleId);
      setModules((prev) => prev.filter((m) => m.id !== moduleId));
    } catch {
      notify('error', 'Error al eliminar el módulo');
    }
  };

  // Lecciones
  const confirmAddLesson = async (moduleId: string, tipo: 'video' | 'quiz') => {
    if (!cursoId) return;
    const mod = modules.find((m) => m.id === moduleId);
    if (!mod) return;
    setChoosingForModule(null);
    try {
      const resp = await cursosApi.createLeccion(cursoId, moduleId, {
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
            isVisible: resp.es_visible,
            bunnyVideoId: resp.bunny_video_id,
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
    if (!cursoId || !confirm('¿Eliminar esta lección?')) return;
    try {
      await cursosApi.deleteLeccion(cursoId, moduleId, lessonId);
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

  const handleRecursoFileSelect = (lessonId: string, files: FileList) => {
    setPendingRecursoFiles((prev) => ({ ...prev, [lessonId]: Array.from(files) }));
  };

  const addRecurso = useCallback(async (moduleId: string, lesson: Lesson) => {
    if (!cursoId) return;
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
      notify('error', 'Error al agregar el recurso');
    }
  }, [cursoId, pendingRecursoFiles]);

  const deleteRecurso = useCallback(async (moduleId: string, lessonId: string, recursoId: string) => {
    if (!cursoId) return;
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
      notify('error', 'Error al eliminar el recurso');
    }
  }, [cursoId]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCoverFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setCoverImagePreview(reader.result as string);
    reader.readAsDataURL(file);

    if (!cursoId) return;
    setIsUploadingCover(true);
    setCoverUploadStatus('uploading');
    try {
      await cursosApi.uploadCover(cursoId, file);
      setCoverUploadStatus('success');
      notify('success', '¡Imagen cargada exitosamente!');
    } catch (e) {
      setCoverUploadStatus('error');
      logError('admin/cursos/crear/uploadCover', e);
      notify('error', 'No se pudo subir la imagen. Intenta de nuevo.');
    } finally {
      setIsUploadingCover(false);
    }
  };

  // Publicar al finalizar (admin publica directamente)
  const handlePublish = async () => {
    if (!cursoId) return;
    setIsPublishing(true);
    setPublishError('');
    try {
      await cursosApi.update(cursoId, {
        estado: 'publicado',
        titulo: title,
        descripcion: description,
        nivel: level || undefined,
        lo_que_aprenderas: loQueAprenderas.split('\n').map((s) => s.trim()).filter(Boolean),
        requisitos: requisitos.trim() || undefined,
      });
      router.push(`/admin/cursos/${cursoId}/editar`);
    } catch {
      setPublishError('Error al publicar el curso. Intenta de nuevo.');
    } finally {
      setIsPublishing(false);
    }
  };

  const isStepComplete = (step: number): boolean => {
    switch (step) {
      case 1: return !!(title && description && level);
      case 2: return true; // portada opcional
      case 3: return modules.length > 0;
      case 4: return true;
      case 5: return true;
      default: return false;
    }
  };

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
          <button className={styles.returnButton} onClick={() => router.push('/admin/cursos')}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            Volver a cursos
          </button>
          <h1 className={styles.pageTitle}>Crear Nuevo Curso</h1>
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
                <p className={styles.stepDescription}>Completa la información fundamental de tu curso</p>

                <div className={styles.formGroup}>
                  <label className={styles.label}>Título del curso <span className={styles.required}>*</span></label>
                  <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className={styles.input} placeholder="Ej: Facturación Electrónica Avanzada" />
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.label}>Descripción <span className={styles.required}>*</span></label>
                  <textarea value={description} onChange={(e) => setDescription(e.target.value)} className={styles.textarea} rows={5} placeholder="Describe el contenido y objetivos del curso..." />
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.label}>Marca del certificado <span className={styles.required}>*</span></label>
                  <div style={{ display: 'flex', gap: '1.5rem', marginTop: '0.375rem' }}>
                    {(['ram', 'nextgen'] as const).map((m) => (
                      <label key={m} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontWeight: marca === m ? 700 : 400 }}>
                        <input
                          type="radio"
                          name="marca"
                          value={m}
                          checked={marca === m}
                          onChange={() => setMarca(m)}
                        />
                        {m === 'ram' ? 'RAM Electronics' : 'NextGen'}
                      </label>
                    ))}
                  </div>
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

                {createError && (
                  <p style={{ color: 'red', padding: '0.75rem', background: '#fff5f5', borderRadius: '0.5rem', border: '1px solid #fed7d7' }}>
                    {createError}
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
                      <button className={styles.removeImageButton} onClick={() => { setCoverImagePreview(''); setCoverFile(null); setCoverUploadStatus('idle'); }}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2M10 11v6M14 11v6" />
                        </svg>
                        Eliminar imagen
                      </button>
                      {coverUploadStatus === 'uploading' && (
                        <p style={{ marginTop: '0.5rem', color: '#2563eb', fontSize: '0.875rem', fontWeight: 500 }}>
                          ⏳ Subiendo imagen al servidor...
                        </p>
                      )}
                      {coverUploadStatus === 'success' && (
                        <p style={{ marginTop: '0.5rem', color: '#16a34a', fontSize: '0.875rem', fontWeight: 500 }}>
                          ✓ Imagen guardada correctamente
                        </p>
                      )}
                      {coverUploadStatus === 'error' && (
                        <p style={{ marginTop: '0.5rem', color: '#dc2626', fontSize: '0.875rem', fontWeight: 500 }}>
                          ✗ Error al subir. Selecciona la imagen de nuevo para reintentar.
                        </p>
                      )}
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

            {/* Step 3: Estructura con VideoUploadButton real */}
            {currentStep === 3 && !cursoId && (
              <div className={styles.stepContent}>
                <p style={{ color: 'red' }}>Error: el curso no fue creado. Vuelve al Step 1 y vuelve a intentar.</p>
              </div>
            )}
            {currentStep === 3 && cursoId && (
              <div className={styles.stepContent}>
                <h2 className={styles.stepTitle}>Estructura del Curso</h2>
                <p className={styles.stepDescription}>Agrega módulos, lecciones y sube los videos directamente.</p>

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
                          onBlur={() => cursosApi.updateModulo(cursoId, module.id, { titulo: module.title, descripcion: module.description }).catch((e) => logError('admin/cursos/crear/autoSave', e))}
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
                              onBlur={() => cursosApi.updateModulo(cursoId, module.id, { titulo: module.title, descripcion: module.description }).catch((e) => logError('admin/cursos/crear/autoSave', e))}
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
                                    onBlur={() => cursosApi.updateLeccion(cursoId, module.id, lesson.id, { titulo: lesson.title, es_visible: lesson.isVisible }).catch((e) => logError('admin/cursos/crear/autoSave', e))}
                                    className={styles.lessonTitleInput}
                                    placeholder="Título de la lección"
                                  />
                                  <label className={styles.toggleLabel}>
                                    <input
                                      type="checkbox"
                                      checked={lesson.isVisible}
                                      onChange={(e) => {
                                        updateLessonLocal(module.id, lesson.id, { isVisible: e.target.checked });
                                        cursosApi.updateLeccion(cursoId, module.id, lesson.id, { titulo: lesson.title, es_visible: e.target.checked }).catch((e) => logError('admin/cursos/crear/autoSave', e));
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
                                  {lesson.tipo === 'video' ? (
                                    <VideoUploadButton
                                      cursoId={cursoId}
                                      moduloId={module.id}
                                      leccionId={lesson.id}
                                      currentBunnyVideoId={lesson.bunnyVideoId}
                                      onUploadComplete={(videoId) => updateLessonLocal(module.id, lesson.id, { bunnyVideoId: videoId })}
                                    />
                                  ) : (
                                    <QuizBuilder
                                      quizData={lesson.quizData}
                                      onChange={(qd) => updateLessonLocal(module.id, lesson.id, { quizData: qd })}
                                      onSave={(data) => cursosApi.saveQuizData(cursoId, module.id, lesson.id, data).catch((e) => logError('admin/cursos/crear/autoSave', e))}
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

                  <button className={styles.addModuleButton} onClick={addModule} disabled={isAddingModule}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 5v14M5 12h14" />
                    </svg>
                    {isAddingModule ? 'Creando módulo...' : 'Agregar módulo'}
                  </button>
                </div>
              </div>
            )}

            {/* Step 4: Configuración */}
            {currentStep === 4 && (
              <div className={styles.stepContent}>
                <h2 className={styles.stepTitle}>Configuración</h2>
                <p className={styles.stepDescription}>Personaliza las opciones de tu curso</p>

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

            {/* Step 5: Publicar */}
            {currentStep === 5 && (
              <div className={styles.stepContent}>
                <h2 className={styles.stepTitle}>Publicar Curso</h2>
                <p className={styles.stepDescription}>Revisa el resumen y publica tu curso</p>

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

            {/* Navigation Buttons */}
            <div className={styles.navigationButtons}>
              <button className={styles.backButton} onClick={handlePrev} disabled={currentStep === 1}>
                Atrás
              </button>

              {currentStep < STEPS.length ? (
                <button
                  className={styles.nextButton}
                  onClick={handleNext}
                  disabled={!isStepComplete(currentStep) || isCreating || isUploadingCover || coverUploadStatus === 'uploading'}
                >
                  {isCreating ? 'Creando borrador...' : 'Siguiente'}
                </button>
              ) : (
                <>
                  {publishError && (
                    <p style={{ color: 'var(--color-error, #e53e3e)', fontSize: '0.875rem', margin: '0 0 0.5rem' }}>
                      {publishError}
                    </p>
                  )}
                  <button className={styles.publishButton} onClick={handlePublish} disabled={isPublishing}>
                    {isPublishing ? 'Publicando...' : 'Publicar curso'}
                  </button>
                </>
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
              {coverImagePreview && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={coverImagePreview} alt={title} className={styles.modalImage} />
              )}
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
                        <li key={lesson.id}>
                          {lesson.title || 'Sin título'}{lesson.bunnyVideoId ? ' ✓' : ''}
                        </li>
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
