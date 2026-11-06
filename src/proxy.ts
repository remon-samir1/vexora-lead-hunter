import { createServerClient } from '@supabase/ssr';
import { NextRequest, NextResponse } from 'next/server';
import {localMode,localHost} from './lib/storage-mode';
export async function proxy(request: NextRequest) {
    let response = NextResponse.next({ request });
    response.headers.set('Cache-Control', 'private, no-store');
    if(localMode()){
        if(!localHost(request.headers.get('host')) || (request.headers.has('x-forwarded-host')&&!localHost(request.headers.get('x-forwarded-host'))))return NextResponse.json({error:'Local workspace is accessible on this device only'},{status:403});
        return response;
    }
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
        return response;
    const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { cookies: { getAll: () => request.cookies.getAll(), setAll: items => { items.forEach(({ name, value }) => request.cookies.set(name, value)); response = NextResponse.next({ request }); response.headers.set('Cache-Control', 'private, no-store'); items.forEach(({ name, value, options }) => response.cookies.set(name, value, options)); } } });
    await supabase.auth.getUser();
    return response;
}
export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] };
