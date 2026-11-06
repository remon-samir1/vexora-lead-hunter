import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/supabase';
import { z } from 'zod';
import {localMode,localHost} from '@/lib/storage-mode';
import {localStore,validLaunchToken} from '@/lib/local-store';
import {cookies} from 'next/headers';
import {isSameOrigin} from '@/lib/request-origin';
export async function POST(req: NextRequest) { try {
    if (!isSameOrigin(req))
        return NextResponse.json({ error: 'Invalid origin' }, { status: 403 });
    const input = await req.json();
    if(localMode()){
        if(!localHost(req.headers.get('host')))return NextResponse.json({error:'Loopback access required'},{status:403});
        const store=localStore();const jar=await cookies();
        if(input.logout){const token=jar.get('vexora_session')?.value;if(token)store.revokeSession(token);jar.delete('vexora_session');return NextResponse.json({ok:true});}
        if(!validLaunchToken(input.local_token))return NextResponse.json({error:'Open the workspace using its private launch link.'},{status:401});
        const token=store.createSession(store.createUser().id);
        jar.set('vexora_session',token,{httpOnly:true,sameSite:'strict',secure:req.nextUrl.protocol==='https:',path:'/',maxAge:86400});
        return NextResponse.json({ok:true});
    }
    const client = await db();
    if (input.logout) {
        await client.auth.signOut();
        return NextResponse.json({ ok: true });
    }
    const credentials = z.object({ email: z.email(), password: z.string().min(8).max(200) }).parse(input);
    const { error } = await client.auth.signInWithPassword(credentials);
    if (error)
        return NextResponse.json({ error: 'Unable to sign in. Check your credentials.' }, { status: 401 });
    return NextResponse.json({ ok: true });
}
catch {
    return NextResponse.json({ error: 'Authentication unavailable. Configure Supabase or check your input.' }, { status: 400 });
} }
