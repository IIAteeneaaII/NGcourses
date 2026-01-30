// Admin Panel Type Definitions

// ============================================================================
// USER MANAGEMENT
// ============================================================================

export type UserRole = 'admin' | 'instructor' | 'student';
export type UserStatus = 'active' | 'inactive' | 'suspended';

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  phone?: string;
  department?: string;
  position?: string;
  role: UserRole;
  status: UserStatus;
  createdAt: string;
  lastLogin?: string;
  enrolledCoursesCount: number;
}

export interface UserFormData {
  name: string;
  email: string;
  phone?: string;
  department?: string;
  position?: string;
  role: UserRole;
  password?: string; // Only for creation
}

// ============================================================================
// COURSE MANAGEMENT
// ============================================================================

export type CourseStatus = 'draft' | 'published' | 'archived';
export type CourseVisibility = 'public' | 'private' | 'restricted';

export interface AdminCourse {
  id: string;
  title: string;
  description: string;
  instructor: string;
  instructorId: string;
  category: string;
  level: string;
  duration: string;
  image: string;
  status: CourseStatus;
  visibility: CourseVisibility;
  enrolledCount: number;
  completionRate: number;
  rating: number;
  createdAt: string;
  updatedAt: string;
  modulesCount: number;
  lessonsCount: number;
}

export interface CourseFormData {
  title: string;
  description: string;
  instructorId: string;
  category: string;
  level: string;
  duration: string;
  image?: File | string;
  status: CourseStatus;
  visibility: CourseVisibility;
  learningOutcomes: string[];
  requirements: string;
  syllabus: string[];
}

export interface AdminModule {
  id: string;
  name: string;
  description?: string;
  order: number;
  lessons: AdminLesson[];
}

export interface AdminLesson {
  id: string;
  name: string;
  description?: string;
  videoId?: string;
  duration?: number;
  order: number;
  isPublished: boolean;
}

// ============================================================================
// COURSE REQUESTS
// ============================================================================

export type RequestPriority = 'low' | 'medium' | 'high';
export type RequestStatus = 'pending' | 'approved' | 'rejected';

export interface CourseRequest {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  courseTitle: string;
  description: string;
  category: string;
  priority: RequestPriority;
  status: RequestStatus;
  createdAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
  notes?: string;
}

export interface RequestFormData {
  courseTitle: string;
  description: string;
  category: string;
  priority: RequestPriority;
}

// ============================================================================
// DASHBOARD & ANALYTICS
// ============================================================================

export interface DashboardStats {
  totalUsers: number;
  activeUsers: number;
  totalCourses: number;
  publishedCourses: number;
  totalEnrollments: number;
  completionRate: number;
  avgCourseRating: number;
}

export type ActivityType =
  | 'user_joined'
  | 'course_completed'
  | 'course_created'
  | 'request_submitted';

export interface RecentActivity {
  id: string;
  type: ActivityType;
  description: string;
  timestamp: string;
  userId?: string;
  courseId?: string;
  userName?: string;
  courseName?: string;
}

// ============================================================================
// PAGINATION & FILTERING
// ============================================================================

export interface PaginationParams {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface FilterParams {
  search?: string;
  role?: UserRole;
  status?: UserStatus | CourseStatus | RequestStatus;
  category?: string;
  level?: string;
  priority?: RequestPriority;
}

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

export interface ApiError {
  message: string;
  field?: string;
  code?: string;
}

export interface ApiResponse<T> {
  data?: T;
  error?: ApiError;
  success: boolean;
}

// ============================================================================
// FORM & UI STATES
// ============================================================================

export type FormMode = 'create' | 'edit' | 'view';

export interface FormState {
  isSubmitting: boolean;
  errors: Record<string, string>;
  touched: Record<string, boolean>;
}

export interface ToastNotification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  duration?: number;
}

// ============================================================================
// TABLE & DATA GRID
// ============================================================================

export interface TableColumn<T> {
  key: keyof T | string;
  label: string;
  sortable?: boolean;
  width?: string;
  align?: 'left' | 'center' | 'right';
  render?: (value: any, row: T) => React.ReactNode;
}

export interface TableAction<T> {
  label: string;
  icon?: React.ReactNode;
  onClick: (row: T) => void;
  variant?: 'primary' | 'secondary' | 'danger';
  show?: (row: T) => boolean;
}

// ============================================================================
// NAVIGATION & ROUTING
// ============================================================================

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export interface NavItem {
  label: string;
  href: string;
  icon?: React.ReactNode;
  badge?: number;
  children?: NavItem[];
}
