import CoursesContent from '@/components/courses/CoursesContent';
import { getAllCourseCards, getCurrentUser } from '@/data/courses';

export default function CursosPage() {
  const courses = getAllCourseCards();
  const user = getCurrentUser();

  return <CoursesContent courses={courses} user={user} />;
}
