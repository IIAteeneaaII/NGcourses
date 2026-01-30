import { notFound } from 'next/navigation';
import CourseVideoContent from '@/components/course/CourseVideoContent';
import { getCourseData } from '@/data/courses';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function CursoVideosPage({ params }: PageProps) {
  const { id } = await params;
  const course = getCourseData(id);

  if (!course) {
    notFound();
  }

  return <CourseVideoContent initialCourse={course} />;
}
