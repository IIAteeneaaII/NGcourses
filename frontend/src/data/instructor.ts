import type {
  InstructorUser,
  InstructorDashboardStats,
  InstructorCourse,
  ManagedInstructor,
  InstructorStudent,
  CourseStatistics,
  InstructorActivity,
} from '@/types/instructor';

// ============================================================================
// INSTRUCTOR USER
// ============================================================================

export const MOCK_INSTRUCTOR_USER: InstructorUser = {
  id: '6',
  name: 'Laura Sanchez',
  email: 'lsanchez@pascual.com',
  initials: 'LS',
  role: 'instructor',
  department: 'Capacitacion Empresarial',
  phone: '+52 55 8765 4321',
  registrationDate: '5 de Marzo, 2024',
};

// ============================================================================
// DASHBOARD STATS
// ============================================================================

export const MOCK_INSTRUCTOR_STATS: InstructorDashboardStats = {
  totalCourses: 8,
  totalStudentsEnrolled: 245,
  activeInstructors: 4,
  averageCompletionRate: 68,
};

// ============================================================================
// COURSES
// ============================================================================

export const MOCK_INSTRUCTOR_COURSES: InstructorCourse[] = [
  {
    id: 'sc-1',
    title: 'Facturacion Electronica Avanzada',
    description: 'Curso completo de facturacion electronica con CFDI 4.0',
    instructor: 'Maria Garcia',
    instructorId: 'i-1',
    category: 'Contabilidad',
    level: 'Avanzado',
    status: 'publicado',
    enrolledCount: 45,
    completionRate: 72,
    createdAt: '2024-06-15',
    image: '/images/courses/facturacion.png',
    modulesCount: 4,
    lessonsCount: 12,
  },
  {
    id: 'sc-2',
    title: 'Gestion de Recursos Humanos',
    description: 'Estrategias modernas para la gestion de talento humano',
    instructor: 'Ana Martinez',
    instructorId: 'i-2',
    category: 'Recursos Humanos',
    level: 'Intermedio',
    status: 'publicado',
    enrolledCount: 38,
    completionRate: 65,
    createdAt: '2024-07-20',
    image: '/images/courses/rrhh.png',
    modulesCount: 3,
    lessonsCount: 9,
  },
  {
    id: 'sc-3',
    title: 'Marketing Digital Corporativo',
    description: 'Herramientas y estrategias de marketing digital para empresas',
    instructor: 'Sofia Ramirez',
    instructorId: 'i-3',
    category: 'Marketing',
    level: 'Intermedio',
    status: 'publicado',
    enrolledCount: 52,
    completionRate: 58,
    createdAt: '2024-08-10',
    image: '/images/courses/marketing.png',
    modulesCount: 5,
    lessonsCount: 15,
  },
  {
    id: 'sc-4',
    title: 'Excel Practico: De Basico a Intermedio',
    description: 'Domina Excel con ejercicios practicos y casos reales',
    instructor: 'Roberto Mendez',
    instructorId: 'i-4',
    category: 'Productividad',
    level: 'Basico',
    status: 'publicado',
    enrolledCount: 67,
    completionRate: 81,
    createdAt: '2024-05-01',
    image: '/images/courses/excel-practico.png',
    modulesCount: 3,
    lessonsCount: 10,
  },
  {
    id: 'sc-5',
    title: 'Cumplimiento Fiscal y Obligaciones',
    description: 'Guia completa sobre obligaciones fiscales empresariales',
    instructor: 'Maria Garcia',
    instructorId: 'i-1',
    category: 'Contabilidad',
    level: 'Avanzado',
    status: 'publicado',
    enrolledCount: 28,
    completionRate: 55,
    createdAt: '2024-09-05',
    image: '/images/courses/fiscal.png',
    modulesCount: 4,
    lessonsCount: 11,
  },
  {
    id: 'sc-6',
    title: 'Solicitud de Creditos Empresariales',
    description: 'Proceso y requisitos para obtener creditos empresariales',
    instructor: 'Ana Martinez',
    instructorId: 'i-2',
    category: 'Finanzas',
    level: 'Intermedio',
    status: 'borrador',
    enrolledCount: 0,
    completionRate: 0,
    createdAt: '2025-01-10',
    image: '/images/courses/creditos.png',
    modulesCount: 3,
    lessonsCount: 8,
  },
  {
    id: 'sc-7',
    title: 'Gestion Contable para PyMEs',
    description: 'Fundamentos contables esenciales para pequenas y medianas empresas',
    instructor: 'Sofia Ramirez',
    instructorId: 'i-3',
    category: 'Contabilidad',
    level: 'Basico',
    status: 'borrador',
    enrolledCount: 0,
    completionRate: 0,
    createdAt: '2025-02-01',
    image: '/images/courses/contable.png',
    modulesCount: 4,
    lessonsCount: 12,
  },
  {
    id: 'sc-8',
    title: 'Liderazgo y Comunicacion Efectiva',
    description: 'Desarrolla habilidades de liderazgo y comunicacion en el entorno laboral',
    instructor: 'Roberto Mendez',
    instructorId: 'i-4',
    category: 'Desarrollo Personal',
    level: 'Intermedio',
    status: 'publicado',
    enrolledCount: 15,
    completionRate: 40,
    createdAt: '2024-11-20',
    image: '/images/courses/liderazgo.png',
    modulesCount: 3,
    lessonsCount: 9,
  },
];

// ============================================================================
// INSTRUCTORS
// ============================================================================

export const MOCK_INSTRUCTOR_INSTRUCTORS: ManagedInstructor[] = [
  {
    id: 'i-1',
    name: 'Maria Garcia',
    email: 'mgarcia@pascual.com',
    initials: 'MG',
    department: 'Contabilidad',
    assignedCoursesCount: 2,
    totalStudents: 73,
    averageRating: 4.8,
    status: 'active',
    courses: [
      { id: 'sc-1', title: 'Facturacion Electronica Avanzada', enrolledCount: 45 },
      { id: 'sc-5', title: 'Cumplimiento Fiscal y Obligaciones', enrolledCount: 28 },
    ],
  },
  {
    id: 'i-2',
    name: 'Ana Martinez',
    email: 'amartinez@pascual.com',
    initials: 'AM',
    department: 'Recursos Humanos',
    assignedCoursesCount: 2,
    totalStudents: 38,
    averageRating: 4.6,
    status: 'active',
    courses: [
      { id: 'sc-2', title: 'Gestion de Recursos Humanos', enrolledCount: 38 },
      { id: 'sc-6', title: 'Solicitud de Creditos Empresariales', enrolledCount: 0 },
    ],
  },
  {
    id: 'i-3',
    name: 'Sofia Ramirez',
    email: 'sramirez@pascual.com',
    initials: 'SR',
    department: 'Marketing',
    assignedCoursesCount: 2,
    totalStudents: 52,
    averageRating: 4.5,
    status: 'active',
    courses: [
      { id: 'sc-3', title: 'Marketing Digital Corporativo', enrolledCount: 52 },
      { id: 'sc-7', title: 'Gestion Contable para PyMEs', enrolledCount: 0 },
    ],
  },
  {
    id: 'i-4',
    name: 'Roberto Mendez',
    email: 'rmendez@pascual.com',
    initials: 'RM',
    department: 'Productividad',
    assignedCoursesCount: 2,
    totalStudents: 82,
    averageRating: 4.9,
    status: 'active',
    courses: [
      { id: 'sc-4', title: 'Excel Practico: De Basico a Intermedio', enrolledCount: 67 },
      { id: 'sc-8', title: 'Liderazgo y Comunicacion Efectiva', enrolledCount: 15 },
    ],
  },
];

// ============================================================================
// STUDENTS
// ============================================================================

export const MOCK_INSTRUCTOR_STUDENTS: InstructorStudent[] = [
  { id: 'st-1', name: 'Carlos Lopez', email: 'clopez@pascual.com', initials: 'CL', department: 'Ventas', enrolledCourses: 3, completedCourses: 1, overallProgress: 65, lastActivity: '2025-02-10' },
  { id: 'st-2', name: 'Pedro Rodriguez', email: 'prodriguez@pascual.com', initials: 'PR', department: 'Operaciones', enrolledCourses: 2, completedCourses: 1, overallProgress: 80, lastActivity: '2025-02-11' },
  { id: 'st-3', name: 'Miguel Torres', email: 'mtorres@pascual.com', initials: 'MT', department: 'Contabilidad', enrolledCourses: 4, completedCourses: 2, overallProgress: 72, lastActivity: '2025-02-09' },
  { id: 'st-4', name: 'Diego Flores', email: 'dflores@pascual.com', initials: 'DF', department: 'Marketing', enrolledCourses: 2, completedCourses: 0, overallProgress: 35, lastActivity: '2025-02-08' },
  { id: 'st-5', name: 'Carmen Morales', email: 'cmorales@pascual.com', initials: 'CM', department: 'Recursos Humanos', enrolledCourses: 3, completedCourses: 2, overallProgress: 90, lastActivity: '2025-02-11' },
  { id: 'st-6', name: 'Elena Castro', email: 'ecastro@pascual.com', initials: 'EC', department: 'Ventas', enrolledCourses: 1, completedCourses: 0, overallProgress: 20, lastActivity: '2025-02-07' },
  { id: 'st-7', name: 'Luis Hernandez', email: 'lhernandez@pascual.com', initials: 'LH', department: 'Produccion', enrolledCourses: 2, completedCourses: 1, overallProgress: 75, lastActivity: '2025-02-10' },
  { id: 'st-8', name: 'Patricia Vega', email: 'pvega@pascual.com', initials: 'PV', department: 'Contabilidad', enrolledCourses: 3, completedCourses: 3, overallProgress: 100, lastActivity: '2025-02-06' },
  { id: 'st-9', name: 'Andres Gutierrez', email: 'agutierrez@pascual.com', initials: 'AG', department: 'Logistica', enrolledCourses: 1, completedCourses: 0, overallProgress: 45, lastActivity: '2025-02-09' },
  { id: 'st-10', name: 'Daniela Romero', email: 'dromero@pascual.com', initials: 'DR', department: 'Marketing', enrolledCourses: 2, completedCourses: 1, overallProgress: 60, lastActivity: '2025-02-11' },
  { id: 'st-11', name: 'Fernando Diaz', email: 'fdiaz@pascual.com', initials: 'FD', department: 'Operaciones', enrolledCourses: 3, completedCourses: 0, overallProgress: 15, lastActivity: '2025-02-05' },
  { id: 'st-12', name: 'Isabel Ruiz', email: 'iruiz@pascual.com', initials: 'IR', department: 'Recursos Humanos', enrolledCourses: 2, completedCourses: 2, overallProgress: 100, lastActivity: '2025-02-10' },
  { id: 'st-13', name: 'Javier Ortega', email: 'jortega@pascual.com', initials: 'JO', department: 'Ventas', enrolledCourses: 1, completedCourses: 0, overallProgress: 50, lastActivity: '2025-02-08' },
  { id: 'st-14', name: 'Lucia Navarro', email: 'lnavarro@pascual.com', initials: 'LN', department: 'Produccion', enrolledCourses: 4, completedCourses: 1, overallProgress: 55, lastActivity: '2025-02-07' },
  { id: 'st-15', name: 'Oscar Medina', email: 'omedina@pascual.com', initials: 'OM', department: 'Contabilidad', enrolledCourses: 2, completedCourses: 1, overallProgress: 70, lastActivity: '2025-02-11' },
];

// ============================================================================
// COURSE STATISTICS
// ============================================================================

export const MOCK_COURSE_STATISTICS: Record<string, CourseStatistics> = {
  'sc-1': {
    courseId: 'sc-1',
    courseTitle: 'Facturacion Electronica Avanzada',
    totalEnrolled: 45,
    activeStudents: 32,
    completedStudents: 13,
    averageProgress: 72,
    enrollmentHistory: [
      { month: 'Sep 2024', count: 8 },
      { month: 'Oct 2024', count: 12 },
      { month: 'Nov 2024', count: 7 },
      { month: 'Dic 2024', count: 6 },
      { month: 'Ene 2025', count: 9 },
      { month: 'Feb 2025', count: 3 },
    ],
    lessonCompletionRates: [
      { lessonName: 'Introduccion al CFDI 4.0', completionRate: 95 },
      { lessonName: 'Estructura del comprobante', completionRate: 88 },
      { lessonName: 'Tipos de comprobante', completionRate: 82 },
      { lessonName: 'Complementos de pago', completionRate: 75 },
      { lessonName: 'Cancelacion de facturas', completionRate: 70 },
      { lessonName: 'Facturacion global', completionRate: 65 },
      { lessonName: 'Nomina digital', completionRate: 58 },
      { lessonName: 'Carta porte', completionRate: 52 },
      { lessonName: 'Casos practicos I', completionRate: 45 },
      { lessonName: 'Casos practicos II', completionRate: 38 },
      { lessonName: 'Errores comunes', completionRate: 32 },
      { lessonName: 'Examen final', completionRate: 29 },
    ],
    students: [
      { studentId: 'st-1', studentName: 'Carlos Lopez', studentEmail: 'clopez@pascual.com', studentInitials: 'CL', enrolledDate: '2024-09-15', progress: 75, completedLessons: 9, totalLessons: 12, lastAccessed: '2025-02-10', status: 'en_progreso' },
      { studentId: 'st-3', studentName: 'Miguel Torres', studentEmail: 'mtorres@pascual.com', studentInitials: 'MT', enrolledDate: '2024-10-01', progress: 100, completedLessons: 12, totalLessons: 12, lastAccessed: '2025-01-20', status: 'completado' },
      { studentId: 'st-5', studentName: 'Carmen Morales', studentEmail: 'cmorales@pascual.com', studentInitials: 'CM', enrolledDate: '2024-10-15', progress: 92, completedLessons: 11, totalLessons: 12, lastAccessed: '2025-02-11', status: 'en_progreso' },
      { studentId: 'st-7', studentName: 'Luis Hernandez', studentEmail: 'lhernandez@pascual.com', studentInitials: 'LH', enrolledDate: '2024-11-01', progress: 58, completedLessons: 7, totalLessons: 12, lastAccessed: '2025-02-09', status: 'en_progreso' },
      { studentId: 'st-8', studentName: 'Patricia Vega', studentEmail: 'pvega@pascual.com', studentInitials: 'PV', enrolledDate: '2024-09-20', progress: 100, completedLessons: 12, totalLessons: 12, lastAccessed: '2025-01-15', status: 'completado' },
      { studentId: 'st-11', studentName: 'Fernando Diaz', studentEmail: 'fdiaz@pascual.com', studentInitials: 'FD', enrolledDate: '2025-01-05', progress: 8, completedLessons: 1, totalLessons: 12, lastAccessed: '2025-02-05', status: 'en_progreso' },
      { studentId: 'st-15', studentName: 'Oscar Medina', studentEmail: 'omedina@pascual.com', studentInitials: 'OM', enrolledDate: '2024-12-10', progress: 42, completedLessons: 5, totalLessons: 12, lastAccessed: '2025-02-11', status: 'en_progreso' },
    ],
  },
  'sc-2': {
    courseId: 'sc-2',
    courseTitle: 'Gestion de Recursos Humanos',
    totalEnrolled: 38,
    activeStudents: 25,
    completedStudents: 13,
    averageProgress: 65,
    enrollmentHistory: [
      { month: 'Sep 2024', count: 5 },
      { month: 'Oct 2024', count: 10 },
      { month: 'Nov 2024', count: 8 },
      { month: 'Dic 2024', count: 6 },
      { month: 'Ene 2025', count: 7 },
      { month: 'Feb 2025', count: 2 },
    ],
    lessonCompletionRates: [
      { lessonName: 'Fundamentos de RRHH', completionRate: 92 },
      { lessonName: 'Reclutamiento y seleccion', completionRate: 85 },
      { lessonName: 'Onboarding efectivo', completionRate: 78 },
      { lessonName: 'Evaluacion de desempeno', completionRate: 68 },
      { lessonName: 'Capacitacion y desarrollo', completionRate: 60 },
      { lessonName: 'Clima organizacional', completionRate: 55 },
      { lessonName: 'Legislacion laboral', completionRate: 48 },
      { lessonName: 'Nomina y prestaciones', completionRate: 42 },
      { lessonName: 'Proyecto final', completionRate: 34 },
    ],
    students: [
      { studentId: 'st-2', studentName: 'Pedro Rodriguez', studentEmail: 'prodriguez@pascual.com', studentInitials: 'PR', enrolledDate: '2024-10-05', progress: 100, completedLessons: 9, totalLessons: 9, lastAccessed: '2025-01-28', status: 'completado' },
      { studentId: 'st-5', studentName: 'Carmen Morales', studentEmail: 'cmorales@pascual.com', studentInitials: 'CM', enrolledDate: '2024-09-20', progress: 89, completedLessons: 8, totalLessons: 9, lastAccessed: '2025-02-11', status: 'en_progreso' },
      { studentId: 'st-10', studentName: 'Daniela Romero', studentEmail: 'dromero@pascual.com', studentInitials: 'DR', enrolledDate: '2024-11-15', progress: 56, completedLessons: 5, totalLessons: 9, lastAccessed: '2025-02-10', status: 'en_progreso' },
      { studentId: 'st-12', studentName: 'Isabel Ruiz', studentEmail: 'iruiz@pascual.com', studentInitials: 'IR', enrolledDate: '2024-10-01', progress: 100, completedLessons: 9, totalLessons: 9, lastAccessed: '2025-02-05', status: 'completado' },
      { studentId: 'st-14', studentName: 'Lucia Navarro', studentEmail: 'lnavarro@pascual.com', studentInitials: 'LN', enrolledDate: '2025-01-10', progress: 22, completedLessons: 2, totalLessons: 9, lastAccessed: '2025-02-07', status: 'en_progreso' },
    ],
  },
  'sc-3': {
    courseId: 'sc-3',
    courseTitle: 'Marketing Digital Corporativo',
    totalEnrolled: 52,
    activeStudents: 38,
    completedStudents: 14,
    averageProgress: 58,
    enrollmentHistory: [
      { month: 'Sep 2024', count: 6 },
      { month: 'Oct 2024', count: 14 },
      { month: 'Nov 2024', count: 11 },
      { month: 'Dic 2024', count: 8 },
      { month: 'Ene 2025', count: 10 },
      { month: 'Feb 2025', count: 3 },
    ],
    lessonCompletionRates: [
      { lessonName: 'Introduccion al marketing digital', completionRate: 94 },
      { lessonName: 'Estrategia de contenidos', completionRate: 87 },
      { lessonName: 'SEO basico', completionRate: 80 },
      { lessonName: 'Google Ads', completionRate: 72 },
      { lessonName: 'Redes sociales corporativas', completionRate: 65 },
      { lessonName: 'Email marketing', completionRate: 58 },
      { lessonName: 'Analitica web', completionRate: 50 },
      { lessonName: 'Automatizacion', completionRate: 42 },
      { lessonName: 'Branding digital', completionRate: 35 },
      { lessonName: 'Plan de marketing', completionRate: 30 },
      { lessonName: 'Metricas y KPIs', completionRate: 25 },
      { lessonName: 'Caso practico integrador', completionRate: 22 },
      { lessonName: 'Tendencias 2025', completionRate: 18 },
      { lessonName: 'Presentacion final', completionRate: 15 },
      { lessonName: 'Examen de certificacion', completionRate: 12 },
    ],
    students: [
      { studentId: 'st-4', studentName: 'Diego Flores', studentEmail: 'dflores@pascual.com', studentInitials: 'DF', enrolledDate: '2024-10-20', progress: 40, completedLessons: 6, totalLessons: 15, lastAccessed: '2025-02-08', status: 'en_progreso' },
      { studentId: 'st-6', studentName: 'Elena Castro', studentEmail: 'ecastro@pascual.com', studentInitials: 'EC', enrolledDate: '2025-01-15', progress: 13, completedLessons: 2, totalLessons: 15, lastAccessed: '2025-02-07', status: 'en_progreso' },
      { studentId: 'st-9', studentName: 'Andres Gutierrez', studentEmail: 'agutierrez@pascual.com', studentInitials: 'AG', enrolledDate: '2024-11-01', progress: 47, completedLessons: 7, totalLessons: 15, lastAccessed: '2025-02-09', status: 'en_progreso' },
      { studentId: 'st-13', studentName: 'Javier Ortega', studentEmail: 'jortega@pascual.com', studentInitials: 'JO', enrolledDate: '2024-12-01', progress: 33, completedLessons: 5, totalLessons: 15, lastAccessed: '2025-02-08', status: 'en_progreso' },
    ],
  },
};

// ============================================================================
// ACTIVITY FEED
// ============================================================================

export const MOCK_INSTRUCTOR_ACTIVITIES: InstructorActivity[] = [
  { id: 'a-1', type: 'student_enrolled', description: 'Oscar Medina se inscribio en Facturacion Electronica Avanzada', timestamp: '2025-02-11T14:30:00', userName: 'Oscar Medina', courseName: 'Facturacion Electronica Avanzada' },
  { id: 'a-2', type: 'student_completed', description: 'Isabel Ruiz completo Gestion de Recursos Humanos', timestamp: '2025-02-10T16:45:00', userName: 'Isabel Ruiz', courseName: 'Gestion de Recursos Humanos' },
  { id: 'a-3', type: 'course_created', description: 'Se creo el curso Gestion Contable para PyMEs', timestamp: '2025-02-01T09:00:00', courseName: 'Gestion Contable para PyMEs' },
  { id: 'a-4', type: 'student_enrolled', description: 'Elena Castro se inscribio en Marketing Digital Corporativo', timestamp: '2025-01-15T11:20:00', userName: 'Elena Castro', courseName: 'Marketing Digital Corporativo' },
  { id: 'a-5', type: 'instructor_assigned', description: 'Roberto Mendez fue asignado a Liderazgo y Comunicacion Efectiva', timestamp: '2024-11-20T10:00:00', userName: 'Roberto Mendez', courseName: 'Liderazgo y Comunicacion Efectiva' },
  { id: 'a-6', type: 'course_published', description: 'Se publico el curso Liderazgo y Comunicacion Efectiva', timestamp: '2024-11-20T14:00:00', courseName: 'Liderazgo y Comunicacion Efectiva' },
  { id: 'a-7', type: 'student_completed', description: 'Patricia Vega completo Facturacion Electronica Avanzada', timestamp: '2025-01-15T13:00:00', userName: 'Patricia Vega', courseName: 'Facturacion Electronica Avanzada' },
  { id: 'a-8', type: 'course_created', description: 'Se creo el curso Solicitud de Creditos Empresariales', timestamp: '2025-01-10T08:30:00', courseName: 'Solicitud de Creditos Empresariales' },
];

// ============================================================================
// GETTER FUNCTIONS
// ============================================================================

export function getInstructorUser(): InstructorUser {
  return MOCK_INSTRUCTOR_USER;
}

export function getInstructorStats(): InstructorDashboardStats {
  return MOCK_INSTRUCTOR_STATS;
}

export function getInstructorCourses(): InstructorCourse[] {
  return MOCK_INSTRUCTOR_COURSES;
}

export function getManagedInstructors(): ManagedInstructor[] {
  return MOCK_INSTRUCTOR_INSTRUCTORS;
}

export function getInstructorStudents(): InstructorStudent[] {
  return MOCK_INSTRUCTOR_STUDENTS;
}

export function getCourseStatistics(courseId: string): CourseStatistics | null {
  return MOCK_COURSE_STATISTICS[courseId] || null;
}

export function getInstructorActivities(): InstructorActivity[] {
  return MOCK_INSTRUCTOR_ACTIVITIES;
}
