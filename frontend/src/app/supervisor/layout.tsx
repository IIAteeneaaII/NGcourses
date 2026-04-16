import React from 'react';
import { SupervisorLayout } from '@/components/supervisor/SupervisorLayout';

export const metadata = {
  title: 'Panel Supervisor - Cursos Online',
  description: 'Panel de supervisión de organización',
};

export default function SupervisorRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <SupervisorLayout>{children}</SupervisorLayout>;
}
