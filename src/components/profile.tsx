'use client';
import { useState, useEffect } from 'react';
import { Button } from './ui/button';
export function Profile() { const [name, setName] = useState(''); const [email, setEmail] = useState(''); const [status, setStatus] = useState(''); useEffect(() => { fetch('/api/profile').then(r => r.json()).then(d => { setName(d.profile?.display_name ?? ''); setEmail(d.email ?? ''); }); }, []); return <form onSubmit={async (e) => { e.preventDefault(); setStatus('Saving…'); try {
    const r = await fetch('/api/profile', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ display_name: name }) });
    const d = await r.json();
    if (!r.ok)
        throw new Error(d.error);
    setStatus('Profile saved');
}
catch (e) {
    setStatus((e as Error).message);
} }}><h3>Your profile</h3><p>{email}</p><label>Display name<input value={name} onChange={e => setName(e.target.value)} required maxLength={100}/></label><Button>Save profile</Button><p role="status">{status}</p></form>; }
