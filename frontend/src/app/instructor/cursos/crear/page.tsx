'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { cursosApi, categoriasApi } from '@/lib/api/client';
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

interface ApiCategoria {
  id: string;
  nombre: string;
}

interface ApiCurso {
  id: string;
}

interface ApiModulo {
  id: string;
}

interface CourseFormData {
  title: string;
  description: string;
  category: string;
  level: string;
  coverImage: File | null;
  coverImagePreview: string;
  modules: Module[];
  allowComments: boolean;
  allowDownloads: boolean;
  certificateEnabled: boolean;
  requireSequential: boolean;
  visibility: 'public' | 'private' | 'restricted';
  publishImmediately: boolean;
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
  isVisible: boolean;
}

const STEPS = [
  { id: 1, name: 'Info Basica', icon: '1' },
  { id: 2, name: 'Portada', icon: '2' },
  { id: 3, name: 'Estructura', icon: '3' },
  { id: 4, name: 'Configuracion', icon: '4' },
  { id: 5, name: 'Publicar', icon: '5' },
];

export default function CrearCursoPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [showPreview, setShowPreview] = useState(false);
  const [categories, setCategories] = useState<ApiCategoria[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const [formData, setFormData] = useState<CourseFormData>({
    title: '',
    description: '',
    category: '',
    level: '',
    coverImage: null,
    coverImagePreview: '',
    modules: [],
    allowComments: true,
    allowDownloads: false,
    certificateEnabled: true,
    requireSequential: false,
    visibility: 'public',
    publishImmediately: false,
  });

  useEffect(() => {
    categoriasApi.list().then((data) => {
      const cats = data as ApiCategoria[];
      setCategories(cats);
    }).catch(() => {});
  }, []);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData((prev) => ({
          ...prev,
          coverImage: file,
          coverImagePreview: reader.result as string,
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  const addModule = () => {
    const newModule: Module = {
      id: `module-${Date.now()}`,
      title: '',
      description: '',
      lessons: [],
      isExpanded: true,
    };
    setFormData((prev) => ({ ...prev, modules: [...prev.modules, newModule] }));
  };

  const updateModule = (moduleId: string, updates: Partial<Module>) => {
    setFormData((prev) => ({
      ...prev,
      modules: prev.modules.map((m) => m.id === moduleId ? { ...m, ...updates } : m),
    }));
  };

  const deleteModule = (moduleId: string) => {
    setFormData((prev) => ({
      ...prev,
      modules: prev.modules.filter((m) => m.id !== moduleId),
    }));
  };

  const addLesson = (moduleId: string) => {
    const newLesson: Lesson = {
      id: `lesson-${Date.now()}`,
      title: '',
      isVisible: true,
    };
    setFormData((prev) => ({
      ...prev,
      modules: prev.modules.map((m) =>
        m.id === moduleId ? { ...m, lessons: [...m.lessons, newLesson] } : m
      ),
    }));
  };

  const updateLesson = (moduleId: string, lessonId: string, updates: Partial<Lesson>) => {
    setFormData((prev) => ({
      ...prev,
      modules: prev.modules.map((m) =>
        m.id === moduleId
          ? { ...m, lessons: m.lessons.map((l) => l.id === lessonId ? { ...l, ...updates } : l) }
          : m
      ),
    }));
  };

  const deleteLesson = (moduleId: string, lessonId: string) => {
    setFormData((prev) => ({
      ...prev,
      modules: prev.modules.map((m) =>
        m.id === moduleId ? { ...m, lessons: m.lessons.filter((l) => l.id !== lessonId) } : m
      ),
    }));
  };

  const toggleModuleExpand = (moduleId: string) => {
    setFormData((prev) => ({
      ...prev,
      modules: prev.modules.map((m) =>
        m.id === moduleId ? { ...m, isExpanded: !m.isExpanded } : m
      ),
    }));
  };

  const handleNext = () => {
    if (currentStep < STEPS.length) setCurrentStep(currentStep + 1);
  };

  const handlePrev = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setSubmitError('');
    try {
      const cursoResp = await cursosApi.create({
        titulo: formData.title,
        slug: slugify(formData.title),
        descripcion: formData.description,
        ...(formData.category ? { categoria_id: formData.category } : {}),
        estado: formData.publishImmediately ? 'publicado' : 'borrador',
        es_gratis: true,
      }) as ApiCurso;

      const cursoId = cursoResp.id;

      for (let mi = 0; mi < formData.modules.length; mi++) {
        const mod = formData.modules[mi];
        const modResp = await cursosApi.createModulo(cursoId, {
          titulo: mod.title || `Modulo ${mi + 1}`,
          descripcion: mod.description,
          orden: mi + 1,
        }) as ApiModulo;

        for (let li = 0; li < mod.lessons.length; li++) {
          const les = mod.lessons[li];
          await cursosApi.createLeccion(cursoId, modResp.id, {
            titulo: les.title || `Leccion ${li + 1}`,
            tipo: 'video',
            orden: li + 1,
            es_visible: les.isVisible,
            duracion_seg: 0,
          });
        }
      }

      router.push(`/instructor/cursos/${cursoId}/editar`);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Error al crear el curso');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isStepComplete = (step: number): boolean => {
    switch (step) {
      case 1:
        return !!(formData.title && formData.description && formData.level);
      case 2:
        return !!formData.coverImagePreview;
      case 3:
        return formData.modules.length > 0;
      case 4:
        return true;
      case 5:
        return true;
      default:
        return false;
    }
  };

  return (
    <div className={styles.pageContainer}>
      <div className={styles.pageHeader}>
        <div className={styles.headerLeft}>
          <button className={styles.returnButton} onClick={() => router.push('/instructor')}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            Volver
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

            {/* Step 1: Info Basica */}
            {currentStep === 1 && (
              <div className={styles.stepContent}>
                <h2 className={styles.stepTitle}>Informacion Basica</h2>
                <p className={styles.stepDescription}>Completa la informacion fundamental de tu curso</p>

                <div className={styles.formGroup}>
                  <label htmlFor="title" className={styles.label}>
                    Titulo del curso <span className={styles.required}>*</span>
                  </label>
                  <input
                    type="text"
                    id="title"
                    name="title"
                    value={formData.title}
                    onChange={handleInputChange}
                    className={styles.input}
                    placeholder="Ej: Facturacion Electronica Avanzada"
                    required
                  />
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="description" className={styles.label}>
                    Descripcion <span className={styles.required}>*</span>
                  </label>
                  <textarea
                    id="description"
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    className={styles.textarea}
                    rows={5}
                    placeholder="Describe el contenido y objetivos del curso..."
                    required
                  />
                </div>

                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label htmlFor="category" className={styles.label}>
                      Categoria <span className={styles.required}>*</span>
                    </label>
                    <select
                      id="category"
                      name="category"
                      value={formData.category}
                      onChange={handleInputChange}
                      className={styles.select}
                      required
                    >
                      <option value="">Seleccionar categoria</option>
                      {categories.map((cat) => (
                        <option key={cat.id} value={cat.id}>{cat.nombre}</option>
                      ))}
                    </select>
                    {categories.length === 0 && (
                      <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.8rem', marginTop: '0.25rem' }}>
                        No hay categorias. Pide al administrador que cree una primero.
                      </p>
                    )}
                  </div>

                  <div className={styles.formGroup}>
                    <label htmlFor="level" className={styles.label}>
                      Nivel <span className={styles.required}>*</span>
                    </label>
                    <select
                      id="level"
                      name="level"
                      value={formData.level}
                      onChange={handleInputChange}
                      className={styles.select}
                      required
                    >
                      <option value="">Seleccionar nivel</option>
                      <option value="principiante">Principiante</option>
                      <option value="intermedio">Intermedio</option>
                      <option value="avanzado">Avanzado</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Portada */}
            {currentStep === 2 && (
              <div className={styles.stepContent}>
                <h2 className={styles.stepTitle}>Imagen de Portada</h2>
                <p className={styles.stepDescription}>Sube una imagen atractiva para tu curso (recomendado: 1200x675px)</p>

                <div className={styles.uploadArea}>
                  {formData.coverImagePreview ? (
                    <div className={styles.imagePreview}>
                      <img src={formData.coverImagePreview} alt="Preview" className={styles.previewImage} />
                      <button
                        className={styles.removeImageButton}
                        onClick={() => setFormData((prev) => ({ ...prev, coverImage: null, coverImagePreview: '' }))}
                      >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2M10 11v6M14 11v6" />
                        </svg>
                        Eliminar imagen
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
                        <p className={styles.uploadHint}>PNG, JPG o WEBP (max. 5MB)</p>
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
                <p className={styles.stepDescription}>
                  Organiza tu curso en modulos y lecciones. Los videos se suben despues de crear el curso.
                </p>

                <div className={styles.modulesContainer}>
                  {formData.modules.map((module, moduleIndex) => (
                    <div key={module.id} className={styles.moduleCard}>
                      <div className={styles.moduleHeader}>
                        <button className={styles.expandButton} onClick={() => toggleModuleExpand(module.id)}>
                          <svg
                            width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                            className={module.isExpanded ? styles.rotated : ''}
                          >
                            <path d="M9 18l6-6-6-6" />
                          </svg>
                        </button>
                        <input
                          type="text"
                          value={module.title}
                          onChange={(e) => updateModule(module.id, { title: e.target.value })}
                          className={styles.moduleTitleInput}
                          placeholder={`Modulo ${moduleIndex + 1}: Titulo`}
                        />
                        <button className={styles.deleteModuleButton} onClick={() => deleteModule(module.id)}>
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                          </svg>
                        </button>
                      </div>

                      {module.isExpanded && (
                        <div className={styles.moduleContent}>
                          <div className={styles.formGroup}>
                            <textarea
                              value={module.description}
                              onChange={(e) => updateModule(module.id, { description: e.target.value })}
                              className={styles.textarea}
                              rows={2}
                              placeholder="Descripcion del modulo (opcional)"
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
                                    onChange={(e) => updateLesson(module.id, lesson.id, { title: e.target.value })}
                                    className={styles.lessonTitleInput}
                                    placeholder="Titulo de la leccion"
                                  />
                                  <label className={styles.toggleLabel}>
                                    <input
                                      type="checkbox"
                                      checked={lesson.isVisible}
                                      onChange={(e) => updateLesson(module.id, lesson.id, { isVisible: e.target.checked })}
                                      className={styles.toggleInput}
                                    />
                                    <span className={styles.toggleSlider}></span>
                                  </label>
                                  <button className={styles.deleteLessonButton} onClick={() => deleteLesson(module.id, lesson.id)}>×</button>
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
            )}

            {/* Step 4: Configuracion */}
            {currentStep === 4 && (
              <div className={styles.stepContent}>
                <h2 className={styles.stepTitle}>Configuracion</h2>
                <p className={styles.stepDescription}>Personaliza las opciones de tu curso</p>

                <div className={styles.configSection}>
                  <label className={styles.checkboxLabel}>
                    <input type="checkbox" name="allowComments" checked={formData.allowComments} onChange={handleInputChange} className={styles.checkbox} />
                    <div className={styles.checkboxContent}>
                      <span className={styles.checkboxTitle}>Permitir comentarios</span>
                      <span className={styles.checkboxDescription}>Los estudiantes podran comentar en las lecciones</span>
                    </div>
                  </label>

                  <label className={styles.checkboxLabel}>
                    <input type="checkbox" name="allowDownloads" checked={formData.allowDownloads} onChange={handleInputChange} className={styles.checkbox} />
                    <div className={styles.checkboxContent}>
                      <span className={styles.checkboxTitle}>Permitir descargas</span>
                      <span className={styles.checkboxDescription}>Los estudiantes podran descargar materiales del curso</span>
                    </div>
                  </label>

                  <label className={styles.checkboxLabel}>
                    <input type="checkbox" name="certificateEnabled" checked={formData.certificateEnabled} onChange={handleInputChange} className={styles.checkbox} />
                    <div className={styles.checkboxContent}>
                      <span className={styles.checkboxTitle}>Certificado de finalizacion</span>
                      <span className={styles.checkboxDescription}>Emitir certificado al completar el curso</span>
                    </div>
                  </label>

                  <label className={styles.checkboxLabel}>
                    <input type="checkbox" name="requireSequential" checked={formData.requireSequential} onChange={handleInputChange} className={styles.checkbox} />
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
                <p className={styles.stepDescription}>Revisa y publica tu curso</p>

                <div className={styles.summaryGrid}>
                  <div className={styles.summaryCard}>
                    <span className={styles.summaryLabel}>Titulo</span>
                    <span className={styles.summaryValue}>{formData.title || 'Sin titulo'}</span>
                  </div>
                  <div className={styles.summaryCard}>
                    <span className={styles.summaryLabel}>Categoria</span>
                    <span className={styles.summaryValue}>
                      {categories.find((c) => c.id === formData.category)?.nombre || 'Sin categoria'}
                    </span>
                  </div>
                  <div className={styles.summaryCard}>
                    <span className={styles.summaryLabel}>Nivel</span>
                    <span className={styles.summaryValue}>{formData.level || 'Sin nivel'}</span>
                  </div>
                  <div className={styles.summaryCard}>
                    <span className={styles.summaryLabel}>Modulos</span>
                    <span className={styles.summaryValue}>{formData.modules.length}</span>
                  </div>
                  <div className={styles.summaryCard}>
                    <span className={styles.summaryLabel}>Lecciones</span>
                    <span className={styles.summaryValue}>
                      {formData.modules.reduce((acc, m) => acc + m.lessons.length, 0)}
                    </span>
                  </div>
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="visibility" className={styles.label}>Visibilidad</label>
                  <select id="visibility" name="visibility" value={formData.visibility} onChange={handleInputChange} className={styles.select}>
                    <option value="public">Publico - Visible para todos</option>
                    <option value="private">Privado - Solo usuarios asignados</option>
                    <option value="restricted">Restringido - Requiere aprobacion</option>
                  </select>
                </div>

                <label className={styles.checkboxLabel}>
                  <input type="checkbox" name="publishImmediately" checked={formData.publishImmediately} onChange={handleInputChange} className={styles.checkbox} />
                  <div className={styles.checkboxContent}>
                    <span className={styles.checkboxTitle}>Publicar inmediatamente</span>
                    <span className={styles.checkboxDescription}>El curso estara disponible para los estudiantes de inmediato</span>
                  </div>
                </label>

                {submitError && (
                  <p style={{ color: 'red', marginTop: '1rem', padding: '0.75rem', background: '#fff5f5', borderRadius: '0.5rem', border: '1px solid #fed7d7' }}>
                    {submitError}
                  </p>
                )}
              </div>
            )}

            {/* Navigation Buttons */}
            <div className={styles.navigationButtons}>
              <button className={styles.backButton} onClick={handlePrev} disabled={currentStep === 1}>
                Atras
              </button>

              {currentStep < STEPS.length ? (
                <button className={styles.nextButton} onClick={handleNext} disabled={!isStepComplete(currentStep)}>
                  Siguiente
                </button>
              ) : (
                <button className={styles.publishButton} onClick={handleSubmit} disabled={isSubmitting}>
                  {isSubmitting ? 'Creando...' : formData.publishImmediately ? 'Publicar curso' : 'Guardar como borrador'}
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
              {formData.coverImagePreview && (
                <img src={formData.coverImagePreview} alt={formData.title} className={styles.modalImage} />
              )}
              <h3 className={styles.modalCourseTitle}>{formData.title}</h3>
              <p className={styles.modalCourseDescription}>{formData.description}</p>
              <div className={styles.modalMeta}>
                <span>Categoria: {categories.find((c) => c.id === formData.category)?.nombre}</span>
                <span>Nivel: {formData.level}</span>
              </div>
              <div className={styles.modalModules}>
                <h4>Contenido del curso</h4>
                {formData.modules.map((module, idx) => (
                  <div key={module.id} className={styles.modalModule}>
                    <strong>Modulo {idx + 1}: {module.title || 'Sin titulo'}</strong>
                    <ul>
                      {module.lessons.map((lesson) => (
                        <li key={lesson.id}>{lesson.title || 'Sin titulo'}</li>
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
