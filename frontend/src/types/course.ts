export interface Lesson {
  id: string;
  name: string;
  resumen?: string;
  tipo?: 'video' | 'quiz' | 'lectura';
  moduleId?: string;
  videoId?: string;
  videoUrl?: string;
  thumbnailUrl?: string;
  /** % visto a partir del cual el backend da la lección por completada. */
  umbralPct?: number;
  duration?: number;
  completed: boolean;
  order: number;
  resources?: Resource[];
  contenido?: unknown;  // JSON string u objeto con QuizData para lecciones tipo quiz
}

export interface Resource {
  id: string;
  name: string;
  url: string;
  type: 'docx' | 'xlsx' | 'pdf' | 'other';
}

export interface Module {
  id: string;
  name: string;
  lessons: Lesson[];
  resources?: Resource[];
  order: number;
}

export interface Course {
  id: string;
  title: string;
  description: string;
  modules: Module[];
  progress: number;
}

export interface VideoProgress {
  lessonId: string;
  currentTime: number;
  duration: number;
  completed: boolean;
  lastWatched: Date;
}

export interface BunnyVideoConfig {
  libraryId: string;
  videoId: string;
  thumbnailTime?: number;
}

export interface SyllabusLesson {
  id?: string;
  title: string;
  tipo?: string;
  durationSec?: number;
  thumbnailUrl?: string;
}

export interface SyllabusModule {
  title: string;
  lessons: SyllabusLesson[];
}

export interface CourseInfo {
  id: string;
  title: string;
  instructor: string;
  rating: number;
  reviewsCount?: number;
  level: string;
  duration: string;
  lessonsCount: number;
  description: string;
  learningOutcomes: string[];
  requirements: string;
  syllabus: SyllabusModule[];
  image: string;
  bloqueadoPorLicencia?: boolean;
  esDeMiOrg?: boolean;
  puedeInscribirse?: boolean;
  category?: string;
  marca?: 'ram' | 'nextgen';
  esGratis?: boolean;
  precio?: number | null;
  moneda?: string;
  destacado?: boolean;
}

// ── Quiz / Lección tipos (editor de cursos) ──────────────────────────────────

export type LeccionTipo = 'video' | 'quiz';
export type QuestionType = 'multiple_choice' | 'true_false';

export interface QuizOption {
  id: string;
  texto: string;
  esCorrecta: boolean;
}

export interface QuizQuestion {
  id: string;
  tipo: QuestionType;
  enunciado: string;
  opciones: QuizOption[];
  orden: number;
}

export interface QuizData {
  preguntas: QuizQuestion[];
}

// ─────────────────────────────────────────────────────────────────────────────

export type CourseTag = 'Nuevo' | 'Popular' | 'Destacado';

export interface CourseCard {
  id: string;
  title: string;
  instructor: string;
  level: string;
  rating: number;
  image: string;
  tag?: CourseTag;
  category?: string;
  marca?: 'ram' | 'nextgen';
  bloqueadoPorLicencia?: boolean;
  esDeMiOrg?: boolean;
  precio?: number | null;
  moneda?: string;
  destacado?: boolean;
  /** Curso gratuito (Curso.es_gratis). */
  esGratis?: boolean;
  /** Número de reseñas; las estrellas solo se muestran si hay alguna. */
  reviews?: number;
  /** El alumno tiene una inscripción vigente (activa o finalizada). */
  enrolled?: boolean;
  /** 'global' = agrupa varios cursos (subcursos). Sin valor = curso normal. */
  tipo?: 'individual' | 'global';
  /** Solo en cursos globales: cursos dentro y avance del alumno. */
  subcursosTotal?: number;
  subcursosCompletados?: number;
  leccionesTotal?: number;
  leccionesCompletadas?: number;
  subcursosTitulos?: string[];
}

export interface User {
  id: string;
  name: string;
  initials: string;
  avatarUrl?: string | null;
}

export interface UserProfile {
  id: string;
  name: string;
  initials: string;
  email: string;
  phone: string;
  department: string;
  position: string;
  registrationDate: string;
  organizacion?: { id: string; nombre: string; rol_org: string } | null;
}

export interface UserStatistics {
  coursesEnrolled: number;
  coursesCompleted: number;
  totalTime: string;
}

export interface CourseInProgress {
  id: string;
  title: string;
  progress: number;
  order: number;
}

export type CourseStatus = 'not_started' | 'in_progress' | 'completed';

export interface UserCourse {
  id: string;
  title: string;
  instructor: string;
  lessonsCount: number;
  image: string;
  status: CourseStatus;
  progress?: number;
  completedDate?: string;
  certificadoFolio?: string;
  marca?: 'ram' | 'nextgen';
  /** Lecciones completadas (GET /progreso/curso/{id}). */
  completedLessons?: number;
  /** Título de la siguiente lección pendiente, en orden de módulo/lección. */
  nextLessonTitle?: string;
  /** ISO de la última actividad registrada; ordena "Mi progreso". */
  lastActivity?: string;
}

export interface MyCoursesStatistics {
  totalCourses: number;
  inProgress: number;
  completed: number;
  totalHours: string;
}
