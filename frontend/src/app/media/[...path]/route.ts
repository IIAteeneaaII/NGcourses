import { NextRequest, NextResponse } from 'next/server';

// Leído en runtime (no en build) — funciona correctamente en Docker
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8000';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const targetUrl = `${BACKEND_URL}/media/${path.join('/')}`;

  let response: Response;
  try {
    response = await fetch(targetUrl, { cache: 'no-store' });
  } catch {
    return new NextResponse(null, { status: 502 });
  }

  const headers = new Headers();
  response.headers.forEach((value, key) => {
    const skip = ['transfer-encoding', 'connection', 'keep-alive'];
    if (!skip.includes(key.toLowerCase())) {
      headers.set(key, value);
    }
  });

  return new NextResponse(response.body, {
    status: response.status,
    headers,
  });
}
