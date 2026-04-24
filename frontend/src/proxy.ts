import { NextRequest, NextResponse } from 'next/server';

const ROLE_ROUTES: Record<string, string> = {
  '/admin':      'administrador',
  '/supervisor': 'supervisor',
  '/instructor': 'instructor',
};

const ROL_HOME: Record<string, string> = {
  'administrador': '/admin',
  'supervisor':    '/supervisor',
  'instructor':    '/instructor',
};

const AUTH_ROUTES = ['/cursos', '/curso', '/mis-cursos', '/perfil'];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get('access_token')?.value;
  const userRol = request.cookies.get('user_rol')?.value;
  const isSuperuser = request.cookies.get('user_superuser')?.value === '1';

  // Rutas con rol específico
  for (const [prefix, requiredRole] of Object.entries(ROLE_ROUTES)) {
    if (pathname.startsWith(prefix)) {
      if (!token) {
        return NextResponse.redirect(new URL('/?error=auth', request.url));
      }
      if (isSuperuser && prefix === '/admin') return NextResponse.next();
      if (userRol !== requiredRole) {
        // Tiene sesión pero rol incorrecto → redirigir a su propio dashboard
        const home = userRol ? (ROL_HOME[userRol] ?? '/cursos') : '/cursos';
        return NextResponse.redirect(new URL(`${home}?error=role`, request.url));
      }
      return NextResponse.next();
    }
  }

  // Rutas que solo requieren sesión activa
  for (const route of AUTH_ROUTES) {
    if (pathname.startsWith(route)) {
      if (!token) {
        return NextResponse.redirect(new URL('/?error=auth', request.url));
      }
      return NextResponse.next();
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/supervisor/:path*',
    '/instructor/:path*',
    '/cursos/:path*',
    '/curso/:path*',
    '/mis-cursos/:path*',
    '/perfil/:path*',
  ],
};
