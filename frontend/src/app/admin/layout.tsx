import React from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';

export const metadata = {
  title: 'Panel Admin - Cursos Online',
  description: 'Panel de administración para gestionar usuarios, cursos y contenido',
};

export default function AdminRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AdminLayout>{children}</AdminLayout>;
}
