import { NextRequest, NextResponse } from 'next/server';
import { localMode, localHost } from './lib/storage-mode';

export function proxy(request: NextRequest) {
    if (localMode() && (!localHost(request.headers.get('host')) ||
        (request.headers.has('x-forwarded-host') && !localHost(request.headers.get('x-forwarded-host')))))
        return NextResponse.json({ error: 'Local workspace is accessible on this device only' }, { status: 403 });

    const response = NextResponse.next();
    response.headers.set('Cache-Control', 'private, no-store');
    return response;
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] };
