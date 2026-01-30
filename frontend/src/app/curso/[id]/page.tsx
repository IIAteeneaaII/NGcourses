import { notFound } from 'next/navigation';
import CourseInfoContent from '@/components/course/CourseInfoContent';
import { getCourseInfo } from '@/data/courses';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function CursoInfoPage({ params }: PageProps) {
  const { id } = await params;
  const course = getCourseInfo(id);

  if (!course) {
    notFound();
  }

  return <CourseInfoContent course={course} />;
}
