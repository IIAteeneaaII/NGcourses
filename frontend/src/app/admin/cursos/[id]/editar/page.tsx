'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import styles from './page.module.css';

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
  videoUrl: string;
  duration: string;
  isVisible: boolean;
}

interface CourseData {
  id: string;
  title: string;
  description: string;
  modules: Module[];
}

// Mock data para simular un curso existente
const MOCK_COURSE: CourseData = {
  id: '1',
  title: 'Facturacion Electronica Avanzada',
  description: 'Curso completo sobre facturacion electronica para empresas',
  modules: [
    {
      id: 'mod-1',
      title: 'Introduccion a la Facturacion Electronica',
      description: 'Conceptos basicos y marco legal',
      isExpanded: true,
      lessons: [
        { id: 'les-1', title: 'Que es la factura electronica', videoUrl: 'https://video.bunny.net/1', duration: '10:30', isVisible: true },
        { id: 'les-2', title: 'Marco legal y normativas', videoUrl: 'https://video.bunny.net/2', duration: '15:45', isVisible: true },
        { id: 'les-3', title: 'Requisitos del SAT', videoUrl: 'https://video.bunny.net/3', duration: '12:20', isVisible: true },
      ],
    },
    {
      id: 'mod-2',
      title: 'Configuracion del Sistema',
      description: 'Como configurar tu sistema de facturacion',
      isExpanded: false,
      lessons: [
        { id: 'les-4', title: 'Seleccion del PAC', videoUrl: 'https://video.bunny.net/4', duration: '8:15', isVisible: true },
        { id: 'les-5', title: 'Certificados digitales', videoUrl: 'https://video.bunny.net/5', duration: '20:00', isVisible: true },
      ],
    },
    {
      id: 'mod-3',
      title: 'Emision de Facturas',
      description: 'Proceso completo de emision',
      isExpanded: false,
      lessons: [
        { id: 'les-6', title: 'Crear una factura paso a paso', videoUrl: 'https://video.bunny.net/6', duration: '25:30', isVisible: true },
        { id: 'les-7', title: 'Tipos de comprobantes', videoUrl: 'https://video.bunny.net/7', duration: '18:45', isVisible: true },
        { id: 'les-8', title: 'Complementos de pago', videoUrl: 'https://video.bunny.net/8', duration: '22:10', isVisible: false },
      ],
    },
  ],
};

export default function EditarCursoPage() {
  const router = useRouter();
  const params = useParams();
  const courseId = params.id as string;

  const [courseData, setCourseData] = useState<CourseData | null>(null);
  const [modules, setModules] = useState<Module[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    // Simular carga de datos del curso
    // En produccion, esto seria una llamada a la API
    setCourseData(MOCK_COURSE);
    setModules(MOCK_COURSE.modules);
  }, [courseId]);

  const addModule = () => {
    const newModule: Module = {
      id: `module-${Date.now()}`,
      title: '',
      description: '',
      lessons: [],
      isExpanded: true,
    };
    setModules((prev) => [...prev, newModule]);
  };

  const updateModule = (moduleId: string, updates: Partial<Module>) => {
    setModules((prev) =>
      prev.map((m) => (m.id === moduleId ? { ...m, ...updates } : m))
    );
  };

  const deleteModule = (moduleId: string) => {
    if (confirm('Estas seguro de eliminar este modulo y todas sus lecciones?')) {
      setModules((prev) => prev.filter((m) => m.id !== moduleId));
    }
  };

  const toggleModuleExpand = (moduleId: string) => {
    setModules((prev) =>
      prev.map((m) =>
        m.id === moduleId ? { ...m, isExpanded: !m.isExpanded } : m
      )
    );
  };

  const addLesson = (moduleId: string) => {
    const newLesson: Lesson = {
      id: `lesson-${Date.now()}`,
      title: '',
      videoUrl: '',
      duration: '',
      isVisible: true,
    };
    setModules((prev) =>
      prev.map((m) =>
        m.id === moduleId ? { ...m, lessons: [...m.lessons, newLesson] } : m
      )
    );
  };

  const updateLesson = (
    moduleId: string,
    lessonId: string,
    updates: Partial<Lesson>
  ) => {
    setModules((prev) =>
      prev.map((m) =>
        m.id === moduleId
          ? {
              ...m,
              lessons: m.lessons.map((l) =>
                l.id === lessonId ? { ...l, ...updates } : l
              ),
            }
          : m
      )
    );
  };

  const deleteLesson = (moduleId: string, lessonId: string) => {
    setModules((prev) =>
      prev.map((m) =>
        m.id === moduleId
          ? { ...m, lessons: m.lessons.filter((l) => l.id !== lessonId) }
          : m
      )
    );
  };

  const handleSave = async () => {
    setIsSaving(true);
    // Simular guardado
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setIsSaving(false);
    alert('Cambios guardados correctamente');
  };

  if (!courseData) {
    return (
      <div className={styles.pageContainer}>
        <div className={styles.loading}>Cargando curso...</div>
      </div>
    );
  }

  const totalLessons = modules.reduce((acc, m) => acc + m.lessons.length, 0);

  return (
    <div className={styles.pageContainer}>
      <div className={styles.headerBar}>
        <button
          className={styles.backButton}
          onClick={() => router.push('/admin/cursos')}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Volver a cursos
        </button>
        <button
          className={styles.saveButton}
          onClick={handleSave}
          disabled={isSaving}
        >
          {isSaving ? 'Guardando...' : 'Guardar cambios'}
        </button>
      </div>

      <div className={styles.contentCard}>
        <div className={styles.cardHeader}>
          <div className={styles.courseInfo}>
            <h1 className={styles.pageTitle}>{courseData.title}</h1>
            <p className={styles.courseDescription}>{courseData.description}</p>
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
                <button
                  className={styles.expandButton}
                  onClick={() => toggleModuleExpand(module.id)}
                >
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className={module.isExpanded ? styles.rotated : ''}
                  >
                    <path d="M9 18l6-6-6-6" />
                  </svg>
                </button>
                <div className={styles.moduleNumber}>{moduleIndex + 1}</div>
                <input
                  type="text"
                  value={module.title}
                  onChange={(e) =>
                    updateModule(module.id, { title: e.target.value })
                  }
                  className={styles.moduleTitleInput}
                  placeholder="Titulo del modulo"
                />
                <span className={styles.lessonCount}>
                  {module.lessons.length} lecciones
                </span>
                <button
                  className={styles.deleteModuleButton}
                  onClick={() => deleteModule(module.id)}
                  title="Eliminar modulo"
                >
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                  </svg>
                </button>
              </div>

              {module.isExpanded && (
                <div className={styles.moduleContent}>
                  <div className={styles.moduleDescriptionGroup}>
                    <textarea
                      value={module.description}
                      onChange={(e) =>
                        updateModule(module.id, { description: e.target.value })
                      }
                      className={styles.moduleDescriptionInput}
                      placeholder="Descripcion del modulo (opcional)"
                      rows={2}
                    />
                  </div>

                  <div className={styles.lessonsContainer}>
                    {module.lessons.map((lesson, lessonIndex) => (
                      <div key={lesson.id} className={styles.lessonCard}>
                        <div className={styles.lessonHeader}>
                          <span className={styles.lessonNumber}>
                            {lessonIndex + 1}
                          </span>
                          <input
                            type="text"
                            value={lesson.title}
                            onChange={(e) =>
                              updateLesson(module.id, lesson.id, {
                                title: e.target.value,
                              })
                            }
                            className={styles.lessonTitleInput}
                            placeholder="Titulo de la leccion"
                          />
                          <label className={styles.toggleLabel}>
                            <input
                              type="checkbox"
                              checked={lesson.isVisible}
                              onChange={(e) =>
                                updateLesson(module.id, lesson.id, {
                                  isVisible: e.target.checked,
                                })
                              }
                              className={styles.toggleInput}
                            />
                            <span className={styles.toggleSlider}></span>
                          </label>
                          <button
                            className={styles.deleteLessonButton}
                            onClick={() => deleteLesson(module.id, lesson.id)}
                            title="Eliminar leccion"
                          >
                            <svg
                              width="18"
                              height="18"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                            >
                              <path d="M18 6L6 18M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                        <div className={styles.lessonInputs}>
                          <input
                            type="text"
                            value={lesson.videoUrl}
                            onChange={(e) =>
                              updateLesson(module.id, lesson.id, {
                                videoUrl: e.target.value,
                              })
                            }
                            className={styles.lessonInput}
                            placeholder="URL del video (Bunny.net)"
                          />
                          <input
                            type="text"
                            value={lesson.duration}
                            onChange={(e) =>
                              updateLesson(module.id, lesson.id, {
                                duration: e.target.value,
                              })
                            }
                            className={styles.lessonDurationInput}
                            placeholder="00:00"
                          />
                        </div>
                      </div>
                    ))}

                    <button
                      className={styles.addLessonButton}
                      onClick={() => addLesson(module.id)}
                    >
                      + Agregar leccion
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}

          <button className={styles.addModuleButton} onClick={addModule}>
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M12 5v14M5 12h14" />
            </svg>
            Agregar modulo
          </button>
        </div>
      </div>
    </div>
  );
}
