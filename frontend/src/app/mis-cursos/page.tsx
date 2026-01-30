import MyCoursesContent from '@/components/my-courses/MyCoursesContent';
import { getUserCourses, getMyCoursesStatistics } from '@/data/courses';

export default function MisCursosPage() {
  const courses = getUserCourses();
  const statistics = getMyCoursesStatistics();

  return <MyCoursesContent courses={courses} statistics={statistics} />;
}
