import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8000';


async function handler(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const url = new URL(req.url);
  const targetUrl = `${BACKEND_URL}/api/${path.join('/')}${url.search}`;

  const headers: Record<string, string> = {};
  req.headers.forEach((value, key) => {
    if (key.toLowerCase() !== 'host') {
      headers[key] = value;
    }
  });

  const hasBody = req.method !== 'GET' && req.method !== 'HEAD';
  const contentType = req.headers.get('content-type') ?? '';
  // Para multipart (uploads de archivo) conservar datos binarios con blob;
  // para JSON y form-urlencoded usar texto plano.
  let body: string | Blob | undefined;
  if (!hasBody) {
    body = undefined;
  } else if (contentType.includes('multipart/form-data')) {
    body = await req.blob();
  } else {
    body = await req.text();
  }

  // No seguir redirects automáticamente — el backend redirige POST con 307
  // y Node.js pierde el body al seguirlo. Lo manejamos manualmente.
  let response = await fetch(targetUrl, {
    method: req.method,
    headers,
    body,
    redirect: 'manual',
    // Desactivar caché de Next.js para que los headers de respuesta sean frescos.
    cache: 'no-store',
  });

  // Seguir 307/308 manualmente reinyectando el body
  if ((response.status === 307 || response.status === 308) && response.headers.get('location')) {
    const location = response.headers.get('location')!;
    const redirectUrl = location.startsWith('http') ? location : `${BACKEND_URL}${location}`;
    response = await fetch(redirectUrl, {
      method: req.method,
      headers,
      body,
      redirect: 'manual',
      cache: 'no-store',
    });
  }

  const skip = ['transfer-encoding', 'connection', 'keep-alive', 'set-cookie'];

  const responseHeaders = new Headers();
  response.headers.forEach((value, key) => {
    if (!skip.includes(key.toLowerCase())) {
      responseHeaders.set(key, value);
    }
  });

  // getSetCookie() preserva cada Set-Cookie como entrada separada (no las mezcla).
  // Fallback a get() si la API no está disponible (Node < 18.14).
  const h = response.headers as unknown as { getSetCookie?: () => string[] };
  const rawCookies: string[] = typeof h.getSetCookie === 'function'
    ? h.getSetCookie()
    : (() => { const r = response.headers.get('set-cookie'); return r ? [r] : []; })();

  for (const raw of rawCookies) {
    responseHeaders.append('set-cookie', raw);
  }

  const responseBody = await response.arrayBuffer();

  return new NextResponse(responseBody, {
    status: response.status,
    headers: responseHeaders,
  });
}

export const GET    = handler;
export const POST   = handler;
export const PUT    = handler;
export const PATCH  = handler;
export const DELETE = handler;
