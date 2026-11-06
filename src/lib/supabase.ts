import { createServerClient } from '@supabase/ssr';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import {localMode,localHost} from './storage-mode';
import {localClient} from './local-client';
export function configured() { return localMode() || Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY); }
export async function db() {
    if(localMode()){
        const requestHeaders=await headers();
        if(!localHost(requestHeaders.get('host')))throw new Error('Local workspace accepts loopback connections only');
        return localClient((await cookies()).get('vexora_session')?.value);
    }
    if (!configured())
        throw new Error('Configure Supabase environment variables first.');
    const jar = await cookies();
    return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { cookies: { getAll: () => jar.getAll(), setAll: items => { try {
                items.forEach(({ name, value, options }) => jar.set(name, value, options));
            }
            catch { /* Read-only server rendering; route handlers persist refreshed sessions. */ } } } });
}
export async function session() { const client = await db(); const { data: { user } } = await client.auth.getUser(); if (!user)
    redirect('/login'); return { client, user }; }
