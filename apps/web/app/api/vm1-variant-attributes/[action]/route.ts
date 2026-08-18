import { NextRequest, NextResponse } from 'next/server';

const backendUrl = (
  process.env.BACKEND_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  'http://localhost:3333/api/v1'
).replace(/\/$/, '');

const actions = new Set(['dry-run', 'apply', 'status']);

// TEMPORARY VM1 HOMOLOGATION ENDPOINT — REMOVE AFTER VALIDATION
async function proxy(request: NextRequest, context: { params: Promise<{ action: string }> }) {
  const { action } = await context.params;
  if (!actions.has(action)) {
    return NextResponse.json({ message: 'Rota nao encontrada.' }, { status: 404 });
  }
  if (action === 'apply' && request.method !== 'POST') {
    return NextResponse.json({ message: 'Metodo nao permitido.' }, { status: 405 });
  }
  if (action !== 'apply' && request.method !== 'GET') {
    return NextResponse.json({ message: 'Metodo nao permitido.' }, { status: 405 });
  }

  const headers = new Headers();
  const authorization = request.headers.get('authorization');
  if (authorization) headers.set('authorization', authorization);

  try {
    const response = await fetch(`${backendUrl}/admin/diagnostics/vm1-variant-attributes/${action}`, {
      method: request.method,
      headers,
      cache: 'no-store',
    });
    const responseHeaders = new Headers();
    const contentType = response.headers.get('content-type');
    if (contentType) responseHeaders.set('content-type', contentType);
    return new NextResponse(response.body, { status: response.status, headers: responseHeaders });
  } catch {
    return NextResponse.json({ message: 'Nao foi possivel conectar ao backend.' }, { status: 502 });
  }
}

export const GET = proxy;
export const POST = proxy;
export const dynamic = 'force-dynamic';
