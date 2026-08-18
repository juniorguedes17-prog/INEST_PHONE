import { NextRequest, NextResponse } from 'next/server';

const backendUrl = (
  process.env.BACKEND_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  'http://localhost:3333/api/v1'
).replace(/\/$/, '');

// TEMPORARY VM1 DIAGNOSTIC BRIDGE — REMOVE AFTER PRODUCTION VALIDATION
export async function GET(request: NextRequest) {
  const authorization = request.headers.get('authorization');
  const targetUrl = `${backendUrl}/admin/diagnostics/vm1-readiness`;

  const headers = new Headers();
  if (authorization) {
    headers.set('authorization', authorization);
  }

  try {
    const response = await fetch(targetUrl, {
      method: 'GET',
      headers,
      cache: 'no-store',
    });

    const responseHeaders = new Headers();
    const contentType = response.headers.get('content-type');
    if (contentType) {
      responseHeaders.set('content-type', contentType);
    }

    return new NextResponse(response.body, {
      status: response.status,
      headers: responseHeaders,
    });
  } catch {
    return NextResponse.json(
      { message: 'Nao foi possivel conectar ao backend.' },
      { status: 502 },
    );
  }
}

export const dynamic = 'force-dynamic';
