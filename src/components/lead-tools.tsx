'use client';
import { useEffect, useState } from 'react';
export function LeadTools({ id, blocked }: {
    id: string;
    blocked: boolean;
}) { const [data, setData] = useState<{
    id: string;
    payload: Record<string, string>;
}[]>([]); const [notice, setNotice] = useState(''); const [message, setMessage] = useState(''); async function request(op: string, body?: unknown) { const r = await fetch('/api/' + op + (body ? '' : '/' + id), body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lead_id: id, ...body }) } : undefined); const d = await r.json(); if (!r.ok)
    throw new Error(d.error); return d; } async function run(fn: () => Promise<void>) { setNotice('Working…'); try {
    await fn();
    setNotice('Saved');
}
catch (e) {
    setNotice((e as Error).message);
} } useEffect(() => { fetch('/api/sources/' + id).then(r => r.json()).then(d => { if (Array.isArray(d))
    setData(d); }); }, [id]); return <div className="panel"><h2>Research & verification</h2><p>Fetch only the official website you are permitted to access. Robots restrictions are checked; you must also respect its terms.</p><button onClick={() => run(async () => { await request('enrich', { terms_confirmed: true }); setData(await request('sources')); })}>I have permission · Enrich from official site</button><p role="status">{notice}</p>{data.map(s => <div className="integration" key={s.id}><b>{s.payload.field ?? 'CRM source'}: {s.payload.value ?? s.payload.source_url}</b><p>{s.payload.verification} · {s.payload.source_type} · {s.payload.discovered_at}</p><a className="text-link" href={s.payload.source_url} target="_blank" rel="noreferrer">Source ↗</a>{s.payload.field && <button onClick={() => run(async () => { await request('verify-source', { source_id: s.id }); setData(await request('sources')); })}>Mark verified</button>}{!blocked && s.payload.field === 'whatsapp' && s.payload.verification === 'Verified' && <a className="button" href={whatsapp(s.payload.value, message)} target="_blank" rel="noreferrer">Review WhatsApp message ↗</a>}</div>)}<textarea placeholder="WhatsApp message to review and send manually" value={message} onChange={e => setMessage(e.target.value)}/><h3>Add independent contact source</h3><form onSubmit={e => { e.preventDefault(); const f = Object.fromEntries(new FormData(e.currentTarget)); void run(async () => { await request("manual-source", f); setData(await request("sources")); }); }}><label>Field<select name="field">{["email", "phone", "whatsapp", "instagram", "linkedin", "facebook"].map(f => <option key={f}>{f}</option>)}</select></label><label>Value<input name="value" required/></label><label>Source URL<input name="source_url" type="url" required placeholder="https://official-company.example/contact"/></label><label>Verification<select name="verification"><option>Unverified</option><option>Verified</option></select></label><button>Save source</button></form><h3>Manual score adjustment</h3><form onSubmit={e => { e.preventDefault(); const f = Object.fromEntries(new FormData(e.currentTarget)); void run(async () => { await request('adjust-score', f); location.reload(); }); }}><input type="number" name="score" min={0} max={100} required aria-label="Adjusted score"/><input name="reason" required placeholder="Reason and evidence for adjustment"/><button>Save adjustment with audit log</button></form></div>; }
function whatsapp(value: string, message: string) { try {
    const u = new URL(value);
    let phone = u.hostname === 'wa.me' ? u.pathname.slice(1) : u.searchParams.get('phone') ?? '';
    phone = phone.replace(/\D/g, '');
    return phone ? 'https://wa.me/' + phone + '?text=' + encodeURIComponent(message) : '#';
}
catch {
    return '#';
} }
