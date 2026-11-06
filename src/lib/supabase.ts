import { createHmac } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { headers } from 'next/headers';
import { localHost, localMode } from './storage-mode';
import { localClientForOwner } from './local-client';
import { localStore } from './local-store';

const ownerId = () => process.env.WORKSPACE_OWNER_ID;
const validOwner = (id?: string) => !!id && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id);

export function configured() {
    return localMode() || Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL &&
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY && process.env.SUPABASE_JWT_SECRET && validOwner(ownerId()));
}

export async function db() {
    if (localMode()) {
        if (!localHost((await headers()).get('host')))
            throw new Error('Local workspace accepts loopback connections only');
        const store = localStore();
        const owner = store.createUser();
        return { client: localClientForOwner(owner.id, store), owner };
    }
    if (!configured()) throw new Error('Configure Supabase workspace storage first.');

    const owner = { id: ownerId()!, email: '' };
    const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
    const claims = encode({ sub: owner.id, role: 'authenticated', aud: 'authenticated', exp: Math.floor(Date.now() / 1000) + 300 });
    const unsigned = `${encode({ alg: 'HS256', typ: 'JWT' })}.${claims}`;
    const signature = createHmac('sha256', process.env.SUPABASE_JWT_SECRET!).update(unsigned).digest('base64url');
    const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
        accessToken: async () => `${unsigned}.${signature}`,
    });
    return { client, owner };
}
