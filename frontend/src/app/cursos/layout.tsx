import { AccessNotice } from '@/components/shared/AccessNotice';

export default function CursosLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AccessNotice />
      {children}
    </>
  );
}
