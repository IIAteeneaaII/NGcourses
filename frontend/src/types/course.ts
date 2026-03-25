export interface Lesson {
  id: string;
  name: string;
  videoId?: string;
  videoUrl?: string;
  duration?: number;
  completed: boolean;
  order: number;
  resources?: Resource[];
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

export interface CourseInfo {
  id: string;
  title: string;
  instructor: string;
  rating: number;
  level: string;
  duration: string;
  lessonsCount: number;
  description: string;
  learningOutcomes: string[];
  requirements: string;
  syllabus: string[];
  image: string;
}

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
}

export interface User {
  id: string;
  name: string;
  initials: string;
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

export type CourseStatus = 'in_progress' | 'completed';

export interface UserCourse {
  id: string;
  title: string;
  instructor: string;
  lessonsCount: number;
  image: string;
  status: CourseStatus;
  progress?: number;
  completedDate?: string;
}

export interface MyCoursesStatistics {
  totalCourses: number;
  inProgress: number;
  completed: number;
  totalHours: string;
}
