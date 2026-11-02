import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { headers } from "next/headers";
import ProfileSetupGate from "@/components/auth/ProfileSetupGate";
import { THEME_INIT_SCRIPT } from "@/lib/theme";

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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Nonce del CSP (lo genera src/proxy.ts) para el script inline del tema.
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Aplica el tema guardado antes del primer pintado (evita parpadeo).
            suppressHydrationWarning: el navegador oculta el atributo nonce tras
            cargar (queda en ""), y React lo reportaría como mismatch. */}
        <script nonce={nonce} suppressHydrationWarning dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ProfileSetupGate>{children}</ProfileSetupGate>
      </body>
    </html>
  );
}
