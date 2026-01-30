import type { Course, CourseInfo, CourseCard, User, UserProfile, UserStatistics, CourseInProgress, UserCourse, MyCoursesStatistics } from '@/types/course';

// Datos de ejemplo - TODO: Reemplazar con datos del backend FastAPI
export const MOCK_COURSES_INFO: Record<string, CourseInfo> = {
  '1': {
    id: '1',
    title: 'Facturación Electrónica',
    instructor: 'Lic. María González',
    rating: 5.0,
    level: 'Básico-Intermedio',
    duration: '4 semanas',
    lessonsCount: 16,
    description: 'Aprende todo sobre facturación electrónica, desde los conceptos básicos hasta la implementación práctica. Domina el proceso de emisión, recepción y gestión de comprobantes fiscales digitales.',
    learningOutcomes: [
      'Normativas de facturación electrónica',
      'Emisión de CFDI y comprobantes digitales',
      'Timbrado y validación de facturas',
      'Cancelación y gestión de documentos',
    ],
    requirements: 'Conocimientos básicos de computación. No se requiere experiencia previa en contabilidad.',
    syllabus: [
      'Introducción a la facturación electrónica',
      'Marco legal y normativo',
      'Proceso de emisión de facturas',
      'Gestión y control de comprobantes',
    ],
    image: '/images/courses/facturacion-electronica.jpg',
  },
};

// Datos de ejemplo para videos - TODO: Reemplazar con datos del backend FastAPI
// Los videoId deben coincidir con los videos subidos a Bunny.net
// Estructura en Bunny: Library > Coleccion (Curso) > Videos por modulo
export const MOCK_COURSES_DATA: Record<string, Course> = {
  '1': {
    id: '1',
    title: 'Facturación Electrónica',
    description: 'Curso completo sobre facturación electrónica en México',
    progress: 25,
    modules: [
      {
        id: 'm1',
        name: 'Módulo 1: Introducción',
        order: 1,
        lessons: [
          { id: 'l1', name: 'Lección 1: Introducción a la facturación electrónica', completed: true, order: 1, videoId: '2694e857-a403-4f27-8b00-32b9ba4049c3' },
          { id: 'l2', name: 'Lección 2: Marco legal y normativo', completed: true, order: 2, videoId: 'VIDEO_ID_LECCION_2' },
          { id: 'l3', name: 'Lección 3: Tipos de comprobantes fiscales', completed: false, order: 3, videoId: 'VIDEO_ID_LECCION_3' },
        ],
      },
      {
        id: 'm2',
        name: 'Módulo 2: Implementación',
        order: 2,
        lessons: [
          { id: 'l4', name: 'Lección 4: Proceso de emisión de CFDI', completed: false, order: 4, videoId: 'fc92ea3e-5c47-4eb9-bbe5-c410b09df26d' },
          { id: 'l5', name: 'Lección 5: Timbrado y certificados', completed: false, order: 5, videoId: 'VIDEO_ID_LECCION_5' },
          { id: 'l6', name: 'Lección 6: Validación de facturas', completed: false, order: 6, videoId: 'VIDEO_ID_LECCION_6' },
        ],
      },
      {
        id: 'm3',
        name: 'Módulo 3: Gestión',
        order: 3,
        lessons: [
          { id: 'l7', name: 'Lección 7: Cancelación de documentos', completed: false, order: 7, videoId: 'VIDEO_ID_LECCION_7' },
          { id: 'l8', name: 'Lección 8: Gestión y archivo de facturas', completed: false, order: 8, videoId: 'VIDEO_ID_LECCION_8' },
        ],
      },
    ],
  },
};

export function getCourseInfo(id: string): CourseInfo | null {
  return MOCK_COURSES_INFO[id] || null;
}

export function getCourseData(id: string): Course | null {
  return MOCK_COURSES_DATA[id] || null;
}

// Datos para las tarjetas del dashboard - TODO: Reemplazar con datos del backend
export const MOCK_COURSES_CARDS: CourseCard[] = [
  {
    id: '1',
    title: 'Facturación Electrónica',
    instructor: 'Lic. María González',
    level: 'Básico-Intermedio',
    rating: 5,
    image: '/images/courses/facturacion-electronica.jpg',
    tag: 'Nuevo',
    category: 'Contabilidad',
  },
  {
    id: '2',
    title: 'Solicitud de Créditos Empresariales',
    instructor: 'Lic. Carlos Méndez',
    level: 'Intermedio',
    rating: 5,
    image: '/images/courses/creditos-empresariales.jpg',
    tag: 'Popular',
    category: 'Finanzas',
  },
  {
    id: '3',
    title: 'Gestión Contable para PyMEs',
    instructor: 'CPA Ana Rodríguez',
    level: 'Básico',
    rating: 5,
    image: '/images/courses/gestion-contable-pymes.jpg',
    tag: 'Destacado',
    category: 'Contabilidad',
  },
];

export function getAllCourseCards(): CourseCard[] {
  return MOCK_COURSES_CARDS;
}

// Usuario mock - TODO: Reemplazar con autenticación real
export const MOCK_USER: User = {
  id: '1',
  name: 'Juan Pérez',
  initials: 'JP',
};

export function getCurrentUser(): User {
  return MOCK_USER;
}

// Perfil de usuario mock - TODO: Reemplazar con datos del backend
export const MOCK_USER_PROFILE: UserProfile = {
  id: '1',
  name: 'Juan Pérez',
  initials: 'JP',
  email: 'juan.perez@empresa.com',
  phone: '+52 55 1234 5678',
  department: 'Recursos Humanos',
  position: 'Gerente de Capacitación',
  registrationDate: '15 de Enero, 2024',
};

export const MOCK_USER_STATISTICS: UserStatistics = {
  coursesEnrolled: 6,
  coursesCompleted: 3,
  totalTime: '45h',
};

export const MOCK_COURSES_IN_PROGRESS: CourseInProgress[] = [
  {
    id: '1',
    title: 'Facturación Electrónica',
    progress: 25,
    order: 1,
  },
  {
    id: '2',
    title: 'Solicitud de Créditos',
    progress: 60,
    order: 2,
  },
  {
    id: '3',
    title: 'Gestión Contable para PyMEs',
    progress: 40,
    order: 3,
  },
];

export function getUserProfile(): UserProfile {
  return MOCK_USER_PROFILE;
}

export function getUserStatistics(): UserStatistics {
  return MOCK_USER_STATISTICS;
}

export function getUserCoursesInProgress(): CourseInProgress[] {
  return MOCK_COURSES_IN_PROGRESS;
}

// Mis Cursos mock - TODO: Reemplazar con datos del backend
export const MOCK_USER_COURSES: UserCourse[] = [
  {
    id: '1',
    title: 'Facturación Electrónica',
    instructor: 'Lic. María González',
    lessonsCount: 16,
    image: '/images/courses/facturacion-electronica.jpg',
    status: 'in_progress',
    progress: 25,
  },
  {
    id: '2',
    title: 'Solicitud de Créditos Empresariales',
    instructor: 'Lic. Carlos Méndez',
    lessonsCount: 20,
    image: '/images/courses/creditos-empresariales.jpg',
    status: 'in_progress',
    progress: 60,
  },
  {
    id: '3',
    title: 'Gestión Contable para PyMEs',
    instructor: 'CPA Ana Rodríguez',
    lessonsCount: 24,
    image: '/images/courses/gestion-contable-pymes.jpg',
    status: 'in_progress',
    progress: 40,
  },
  {
    id: '4',
    title: 'Gestión de Recursos Humanos',
    instructor: 'Lic. Roberto Jiménez',
    lessonsCount: 18,
    image: '/images/courses/recursos-humanos.jpg',
    status: 'completed',
    completedDate: 'Completado el 20 de Diciembre, 2024',
  },
  {
    id: '5',
    title: 'Marketing Digital para Empresas',
    instructor: 'Lic. Laura Fernández',
    lessonsCount: 22,
    image: '/images/courses/marketing-digital.jpg',
    status: 'completed',
    completedDate: 'Completado el 15 de Diciembre, 2024',
  },
  {
    id: '6',
    title: 'Cumplimiento Fiscal y Obligaciones',
    instructor: 'CPA Jorge Martínez',
    lessonsCount: 28,
    image: '/images/courses/cumplimiento-fiscal.jpg',
    status: 'completed',
    completedDate: 'Completado el 10 de Diciembre, 2024',
  },
];

export const MOCK_MY_COURSES_STATISTICS: MyCoursesStatistics = {
  totalCourses: 6,
  inProgress: 3,
  completed: 3,
  totalHours: '45h',
};

export function getUserCourses(): UserCourse[] {
  return MOCK_USER_COURSES;
}

export function getMyCoursesStatistics(): MyCoursesStatistics {
  return MOCK_MY_COURSES_STATISTICS;
}
