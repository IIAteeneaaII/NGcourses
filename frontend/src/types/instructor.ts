// Instructor Panel Type Definitions

// ============================================================================
// INSTRUCTOR USER
// ============================================================================

export interface InstructorUser {
  id: string;
  name: string;
  email: string;
  initials: string;
  role: 'instructor';
  department: string;
  phone: string;
  registrationDate: string;
}

// ============================================================================
// DASHBOARD
// ============================================================================

export interface InstructorDashboardStats {
  totalCourses: number;
  totalStudentsEnrolled: number;
  activeInstructors: number;
  averageCompletionRate: number;
}

export type InstructorActivityType =
  | 'course_created'
  | 'course_published'
  | 'student_enrolled'
  | 'student_completed'
  | 'instructor_assigned';

export interface InstructorActivity {
  id: string;
  type: InstructorActivityType;
  description: string;
  timestamp: string;
  userName?: string;
  courseName?: string;
}

// ============================================================================
// COURSES
// ============================================================================

export interface InstructorCourse {
  id: string;
  title: string;
  description: string;
  instructor: string;
  instructorId: string;
  category: string;
  level: string;
  status: 'publicado' | 'borrador';
  enrolledCount: number;
  completionRate: number;
  createdAt: string;
  image: string;
  modulesCount: number;
  lessonsCount: number;
}

// ============================================================================
// COURSE STATISTICS
// ============================================================================

export interface StudentCourseProgress {
  studentId: string;
  studentName: string;
  studentEmail: string;
  studentInitials: string;
  enrolledDate: string;
  progress: number;
  completedLessons: number;
  totalLessons: number;
  lastAccessed: string;
  status: 'en_progreso' | 'completado' | 'sin_iniciar';
}

export interface CourseStatistics {
  courseId: string;
  courseTitle: string;
  totalEnrolled: number;
  activeStudents: number;
  completedStudents: number;
  averageProgress: number;
  enrollmentHistory: { month: string; count: number }[];
  lessonCompletionRates: { lessonName: string; completionRate: number }[];
  students: StudentCourseProgress[];
}

// ============================================================================
// INSTRUCTORS (MANAGED)
// ============================================================================

export interface ManagedInstructor {
  id: string;
  name: string;
  email: string;
  initials: string;
  department: string;
  assignedCoursesCount: number;
  totalStudents: number;
  averageRating: number;
  status: 'active' | 'inactive';
  courses: { id: string; title: string; enrolledCount: number }[];
}

// ============================================================================
// STUDENTS
// ============================================================================

export interface InstructorStudent {
  id: string;
  name: string;
  email: string;
  initials: string;
  department: string;
  enrolledCourses: number;
  completedCourses: number;
  overallProgress: number;
  lastActivity: string;
}
