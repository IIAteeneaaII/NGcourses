import { Suspense } from 'react';
import CourseVideoContent from '@/components/course/CourseVideoContent';

export default function CursoVideosPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#E8F4F8] flex items-center justify-center">
        <div className="text-center">
          <div className="text-2xl font-bold text-[#004777] mb-4">Cargando curso...</div>
          <div className="w-16 h-16 border-4 border-[#4FC3E0] border-t-transparent rounded-full animate-spin mx-auto"></div>
        </div>
      </div>
    }>
      <CourseVideoContent />
    </Suspense>
  );
}
