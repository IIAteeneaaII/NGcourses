import React from 'react';
import { InstructorLayout } from '@/components/instructor/InstructorLayout';

export const metadata = {
  title: 'Panel Instructor - Cursos Online',
  description: 'Panel de instructor para gestionar cursos y alumnos',
};

export default function InstructorRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <InstructorLayout>{children}</InstructorLayout>;
}
