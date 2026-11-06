'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { Lead } from '@/lib/schemas';
type RecordRow = {
    id: string;
    lead_id: string;
    created_at: string;
    due_at: string;
    completed: boolean;
    payload: Record<string, unknown>;
    lead_records?: {
        business_name: string;
    };
};
export function Insights({ leads }: {
    leads: Lead[];
}) { const [activity, setActivity] = useState<RecordRow[]>([]); const [followups, setFollowups] = useState<RecordRow[]>([]); useEffect(() => { for (const [endpoint, setter] of [['recent', setActivity], ['follow-ups', setFollowups]] as const)
    fetch('/api/' + endpoint).then(r => r.json()).then(d => { if (Array.isArray(d))
        setter(d); }); }, []); const months = Array.from({ length: 6 }, (_, i) => { const date = new Date(); date.setMonth(date.getMonth() - 5 + i); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`; }); return <><div className="panel"><h2>Monthly acquisition & wins</h2><p>Counts by lead creation month. Wins reflect current status of each cohort.</p>{months.map(m => { const cohort = leads.filter(l => l.created_at.startsWith(m)); return <div className="bar-row" key={m}><span>{m}</span><div><i style={{ width: cohort.length / Math.max(leads.length, 1) * 100 + '%' }}/></div><b>{cohort.length}</b><span>{cohort.filter(l => l.status === 'Won').length} won</span></div>; })}</div><div className="grid-two"><div className="panel"><h2>Recent activity</h2>{activity.map(a => <div className="list-row" key={a.id}><Link href={'/leads/' + a.lead_id}>{a.lead_records?.business_name}</Link><span>{String(a.payload.note ?? a.payload.action ?? 'Updated')}</span><small>{new Date(a.created_at).toLocaleDateString()}</small></div>)}{!activity.length && <p>No activity recorded.</p>}</div><div className="panel"><h2>Next follow-ups</h2>{followups.filter(f => !f.completed).slice(0, 6).map(f => <div className="list-row" key={f.id}><Link href={'/leads/' + f.lead_id}>{f.lead_records?.business_name}</Link><span>{new Date(f.due_at).toLocaleString()}</span></div>)}{!followups.some(f => !f.completed) && <p>No pending follow-ups.</p>}<Link className="text-link" href="/follow-ups">Manage follow-ups →</Link></div></div></>; }
