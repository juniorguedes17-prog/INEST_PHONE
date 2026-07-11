import { NextRequest, NextResponse } from 'next/server';

const backendUrl = (
  process.env.BACKEND_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  'http://localhost:3333/api/v1'
).replace(/\/$/, '');

async function proxyRequest(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  const targetUrl = new URL(`${backendUrl}/${path.map(encodeURIComponent).join('/')}`);

  request.nextUrl.searchParams.forEach((value, key) => {
    targetUrl.searchParams.append(key, value);
  });

  const headers = new Headers();

  for (const headerName of ['accept', 'authorization', 'content-type', 'cookie', 'user-agent']) {
    const headerValue = request.headers.get(headerName);

    if (headerValue) {
      headers.set(headerName, headerValue);
    }
  }

  const hasBody = request.method !== 'GET' && request.method !== 'HEAD';
  let response: Response;

  try {
    response = await fetch(targetUrl, {
      method: request.method,
      headers,
      body: hasBody ? await request.arrayBuffer() : undefined,
      redirect: 'manual',
      cache: 'no-store',
    });
  } catch {
    return NextResponse.json(
      { message: 'Nao foi possivel conectar ao backend.' },
      { status: 502 },
    );
  }

  const responseHeaders = new Headers(response.headers);
  responseHeaders.delete('content-encoding');
  responseHeaders.delete('content-length');

  return new NextResponse(response.body, {
    status: response.status,
    headers: responseHeaders,
  });
}

export const dynamic = 'force-dynamic';

export const GET = proxyRequest;
export const POST = proxyRequest;
export const PUT = proxyRequest;
export const PATCH = proxyRequest;
export const DELETE = proxyRequest;
