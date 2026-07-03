import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import ProfileSetupGate from "@/components/auth/ProfileSetupGate";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "NextGen Course",
  description: "Plataforma de cursos en línea NextGen",
  icons: {
    icon: '/images/favicon.png',
  },
};

// Render dinámico obligatorio en toda la app: el CSP usa un nonce por-request
// (generado en el middleware). Una página prerenderizada/cacheada sirve HTML sin
// nonce → 'strict-dynamic' bloquea todos sus scripts. Forzar dynamic hace que
// Next renderice en cada request e inyecte el nonce en sus <script>.
export const dynamic = 'force-dynamic';

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ProfileSetupGate>{children}</ProfileSetupGate>
      </body>
    </html>
  );
}
