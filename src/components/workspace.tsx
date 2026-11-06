'use client';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { LeadTools } from './lead-tools';
import { Profile } from './profile';
import { Insights } from './insights';
import { UsageSummary } from './usage-summary';
import { Discovery } from './discovery';
import { LeadStrategy } from './lead-strategy';
import { SalesProfileEditor } from './sales-profile';
import { LeadFilters } from './lead-filters';
import { CsvImport } from './csv-import';
import { SalesInsights } from './sales-insights';
import {matchesLead,emptyFilters} from '@/lib/lead-filters';
import {categoryLabel,cityLabel,regions,sectors,statusLabels} from '@/lib/catalog';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowUpRight, Plus, Search, ArrowRight, Target, Globe, Flame, CheckCircle2 } from 'lucide-react';
import { leadSchema, statuses, categories, type Lead } from '@/lib/schemas';
type Row = {
    id: string;
    created_at: string;
    payload: Record<string, unknown>;
    due_at: string;
    completed: boolean;
    lead_records?: {
        business_name: string;
    };
    [key: string]: unknown;
};
async function api(path: string, body?: unknown) { const res = await fetch('/api/' + path, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : undefined); const data = await res.json(); if (!res.ok)
    throw new Error(data.error ?? 'Request failed'); return data; }
const defaults = { business_name: '', city: 'Riyadh', category: categories[0], website: '', email: '', phone: '', status: 'New' as const, notes: '', deal_value: 0, do_not_contact: false, source_url: '', verification: 'Unverified' as const };
export function Workspace({ path }: {
    path: string[];
}) {
    const page = path[0];
    const [leads, setLeads] = useState<Lead[]>([]);
    const [rows, setRows] = useState<Row[]>([]);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const [query, setQuery] = useState('');
    const [filter, setFilter] = useState('');
    const [advanced,setAdvanced]=useState({...emptyFilters});
    const [sort, setSort] = useState('newest');
    const [index, setIndex] = useState(0);
    const [selected, setSelected] = useState<string[]>([]);
    const [editing, setEditing] = useState(false);
    
    const [result, setResult] = useState('');
    const load = useCallback(async () => { try {
        const data = await api('leads');
        setLeads(data);
        if (['audits', 'follow-ups'].includes(page))
            setRows(await api(page));
        if (page === 'settings' && path[1] === 'usage')
            setRows(await api('usage'));
    }
    catch (e) {
        setError((e as Error).message);
    } }, [page, path]);
    useEffect(() => { void Promise.resolve().then(load); }, [load]);
    const action = async (fn: () => Promise<void>) => { setBusy(true); setError(''); try {
        await fn();
    }
    catch (e) {
        setError((e as Error).message);
    }
    finally {
        setBusy(false);
    } };
    const lead = leads.find(l => l.id === path[1]);
    const title: Record<string, string> = { dashboard: 'نظرة على فرص Vexora', leads: lead?.business_name ?? 'عملاؤك وفرص البيع', discover: 'اكتشف فرصًا مناسبة لـVexora', audits: 'A clearer digital picture', 'follow-ups': 'Keep the conversation moving', analytics: 'See the bigger picture', settings: 'Make this workspace yours' };
    const hot = leads.filter(l => l.quality?.label === 'أولوية مرتفعة').length;
    const qualified = leads.filter(l => l.status === 'Qualified').length;
    const won = leads.filter(l => l.status === 'Won');
    const filtered = leads.filter(l => (l.business_name + ' ' + l.city + ' ' + l.category).toLowerCase().includes(query.toLowerCase()) && (!filter || l.status === filter) && matchesLead(l,advanced)).sort((a, b) => sort === 'quality' ? (b.quality?.points??0)-(a.quality?.points??0) : sort === 'score' ? b.score - a.score : sort === 'name' ? a.business_name.localeCompare(b.business_name) : b.created_at.localeCompare(a.created_at));
    return <><div className="page-heading"><div><div className="eyebrow">VEXORA INTELLIGENCE <span>/</span> {page.toUpperCase()}</div><h1>{title[page] ?? 'Workspace'}</h1><p>{page === 'dashboard' ? 'اكتشف الشركات المناسبة، تحقق من احتياجها، وحدد الخطوة التالية.' : 'بيانات موثقة، خدمة مناسبة، ومحادثة هدفها فهم احتياج العميل.'}</p></div><Link className="primary" href={page === 'discover' ? '/leads' : '/discover'}>{page === 'discover' ? 'إدارة العملاء' : 'اكتشاف العملاء'} <ArrowUpRight size={16}/></Link></div>
 {error && <div className="error" role="alert">{error}</div>}
 {(page === 'dashboard' || page === 'analytics') && <><div className="hero-card"><div><div className="eyebrow">BUILT FOR YOUR NEXT CHAPTER</div><h2>Great partnerships<br />begin with the right lead.</h2><p>Your pipeline. Your insights. One focused workspace.</p><Link href="/discover">Explore the Saudi market <ArrowRight size={16}/></Link></div><div className="radar"><div /><Target size={64}/><span>SAUDI ARABIA</span></div></div><div className="stats">{[['Total leads', leads.length, UsersIcon], ['Qualified', qualified, CheckCircle2], ['Hot opportunities', hot, Flame], ['Won value', won.reduce((s, l) => s + Number(l.deal_value), 0), Target]].map(([label, value, Icon]) => { const I = Icon as typeof Target; return <article key={String(label)}><div>{String(label)}<I size={18}/></div><strong>{Number(value).toLocaleString()}</strong><small>{label === 'Won value' ? 'SAR · recorded deal value' : 'From your private CRM'}</small></article>; })}</div><div className="grid-two"><div className="panel"><h2>Pipeline at a glance <span className="pill">LIVE RECORDS</span></h2>{statuses.map(s => <div className="bar-row" key={s}><span>{s}</span><div><i style={{ width: Math.max(0, leads.filter(l => l.status === s).length / Math.max(leads.length, 1) * 100) + '%' }}/></div><b>{leads.filter(l => l.status === s).length}</b></div>)}</div><div className="panel"><h2>Market coverage</h2>{[...new Set(leads.map(l => l.city))].map(city => <div className="list-row" key={city}><Globe size={16}/><span>{city}</span><b>{leads.filter(l => l.city === city).length}</b></div>)}{!leads.length && <Empty text="Your market insights start with your first lead."/>}<Link className="text-link" href="/leads">View all leads <ArrowRight size={15}/></Link></div></div><div className="panel"><h2>Business categories</h2>{categories.map(c => <div className="list-row" key={c}><span>{c}</span><b>{leads.filter(l => l.category === c).length}</b></div>)}<p>Conversion rate: {leads.length ? (won.length / leads.length * 100).toFixed(1) : '0'}%</p></div></>}
 {(page === 'dashboard' || page === 'analytics') && <><Insights leads={leads}/><SalesInsights leads={leads}/></>} 
 {page === 'leads' && !lead && <><LeadFilters leads={leads} value={advanced} onChange={v=>{setAdvanced(v);setIndex(0);}}/><CsvImport onImported={load}/><div className="toolbar"><div className="search"><Search size={16}/><input placeholder="ابحث عن شركة أو مدينة أو نشاط…" value={query} onChange={e => { setQuery(e.target.value); setIndex(0); }}/></div><select value={filter} onChange={e => { setFilter(e.target.value); setIndex(0); }}><option value="">كل المراحل</option>{statuses.map(s => <option key={s} value={s}>{statusLabels[s]??s}</option>)}</select><select value={sort} onChange={e => setSort(e.target.value)}><option value="newest">الأحدث أولًا</option><option value="score">فرص تحسين الموقع</option><option value="quality">نقاط التأهيل المثبتة</option><option value="name">اسم الشركة</option></select><a download className="button" href="/api/leads/export">تصدير CSV</a><button className="primary" onClick={() => setEditing(!editing)}><Plus size={16}/> إضافة عميل</button></div>{editing && <LeadForm onSave={async (data) => { await api('leads', data); setEditing(false); await load(); }}/>}<div className="panel table-panel"><div className="panel-heading"><h2>إدارة العملاء <span className="pill">{filtered.length}</span></h2><span>{selected.length} selected</span></div>{selected.length > 0 && <button disabled={busy} onClick={() => action(async () => { for (const id of selected) {
        const l = leads.find(x => x.id === id)!;
        await api('leads/' + id, { ...l, status: 'Qualified' });
    } setSelected([]); await load(); })}>تحديد المختارين كمؤهلين</button>}<div className="table-scroll"><table><thead><tr><th>Select</th><th>BUSINESS</th><th>CITY</th><th>STATUS</th><th>فرصة الويب</th><th>التأهيل / الأدلة</th><th>CONTACT</th></tr></thead><tbody>{filtered.slice(index * 15, index * 15 + 15).map(l => <tr key={l.id}><td><input type="checkbox" aria-label={'Select ' + l.business_name} checked={selected.includes(l.id)} onChange={e => setSelected(e.target.checked ? [...selected, l.id] : selected.filter(id => id !== l.id))}/></td><td><Link href={'/leads/' + l.id}><strong>{l.business_name}</strong><small>{categoryLabel(l.category)}</small></Link></td><td>{cityLabel(l.city)}</td><td><span className="pill">{statusLabels[l.status]??l.status}</span></td><td><span className={l.score >= 75 ? 'score hot' : 'score'}>{l.score}</span></td><td><span className="pill">{l.quality?.label??"يحتاج تحقق"}</span><small>{l.quality?.points??0} نقطة · أدلة {l.quality?.coverage??0}%</small></td><td>{l.verification}</td></tr>)}</tbody></table></div>{!filtered.length && <Empty text="A focused pipeline starts here. Add a verified business or discover Place ID references."/>}<div className="pagination"><button disabled={!index} onClick={() => setIndex(index - 1)}>السابق</button><span>Page {index + 1}</span><button disabled={(index + 1) * 15 >= filtered.length} onClick={() => setIndex(index + 1)}>التالي</button></div></div></>}
 {lead && page === 'leads' && <><LeadStrategy key={lead.id} lead={lead} leads={leads}/><div className="grid-two"><div className="panel"><h2>بيانات الشركة</h2><LeadTools id={lead.id} blocked={lead.do_not_contact || lead.status === 'Not Interested'||lead.qualification?.excluded||lead.qualification?.interest==='no'||lead.qualification?.fit==='no'}/><LeadForm initial={lead} onSave={async (data) => { await api('leads/' + lead.id, data); await load(); }}/></div><div><div className="panel"><h2>فرص تحسين الموقع <span className="score">{lead.score}/100</span></h2>{lead.score_reasons.map(r => <p key={r}>{r}</p>)}<p>Unknown checks add no points. Review evidence before outreach.</p><p>Recommended service: {lead.website ? 'Website improvement consultation' : 'Professional business website'}</p><button disabled={busy} onClick={() => action(async () => { setResult(JSON.stringify(await api('audit', { lead_id: lead.id }), null, 2)); await load(); })}>تدقيق الموقع الرسمي</button><pre>{result}</pre></div><div className="panel"><h2>جدولة متابعة</h2><form onSubmit={e => { e.preventDefault(); const f = Object.fromEntries(new FormData(e.currentTarget)); void action(async () => { await api('follow-ups', { ...f, lead_id: lead.id, due_at: new Date(String(f.due_at)).toISOString() }); setResult('Follow-up scheduled'); }); }}><input type="datetime-local" name="due_at" required/><select name="stage">{['First follow-up', 'Second follow-up', 'Final follow-up'].map(x => <option key={x}>{x}</option>)}</select><button disabled={busy || lead.do_not_contact}>Schedule</button></form></div><div className="panel"><h2>Activity log</h2><form onSubmit={e => { e.preventDefault(); const form = e.currentTarget; void action(async () => { await api('activity', { lead_id: lead.id, note: new FormData(form).get('note') }); setResult('Activity recorded'); form.reset(); }); }}><input name="note" placeholder="Record a contact attempt or response" required/><button disabled={busy}>تسجيل نشاط</button></form><button onClick={() => action(async () => setResult(JSON.stringify(await api('timeline/' + lead.id), null, 2)))}>عرض سجل النشاط</button></div></div></div></>}
 {page === 'discover' && <Discovery/>}
 {(page === 'audits' || page === 'follow-ups') && <div className="panel"><h2>{page === 'audits' ? 'Evidence library' : 'Upcoming conversations'}</h2>{rows.map(r => <div className="list-row" key={r.id}><Link href={'/leads/' + r.lead_id}>{r.lead_records?.business_name ?? 'Business'}</Link>{page === 'follow-ups' ? <><span>{String(r.payload.stage)} · {new Date(r.due_at).toLocaleString()}</span><button disabled={r.completed || busy} onClick={() => action(async () => { await api('follow-ups', { id: r.id }); await load(); })}>{r.completed ? 'Completed' : 'Mark complete'}</button></> : <details><summary>{new Date(r.created_at).toLocaleString()} · View evidence</summary><pre>{JSON.stringify(r.payload, null, 2)}</pre></details>}</div>)}{!rows.length && <Empty text={page === 'audits' ? 'Run an audit from a lead’s detail page to record real findings.' : 'Schedule your first follow-up from a lead’s detail page.'}/>}</div>}
 {page === 'settings' && <><div className="tabs"><Link href="/settings">Workspace</Link><Link href="/settings/integrations">Integrations</Link><Link href="/settings/usage">Usage & limits</Link></div>{path[1] === 'integrations' ? <div className="panel"><h2>Connect your tools</h2><p>Configure server environment variables, then restart the application. Keys are never accepted or displayed in the browser.</p>{[['Supabase', 'NEXT_PUBLIC_SUPABASE_URL · NEXT_PUBLIC_SUPABASE_ANON_KEY', 'Required for authentication and all private data. Apply the included migration and create an invited user.'], ['Google Places API (New)', 'GOOGLE_PLACES_API_KEY', 'Optional. Enable Places API (New), restrict the key, then configure Usage limits.'], ['Anthropic', 'ANTHROPIC_API_KEY · ANTHROPIC_MODEL', 'Optional. Without these, the sales assistant returns an editable manual template.']].map(([name, env, desc]) => <div className="integration" key={name}><h3>{name}</h3><code>{env}</code><p>{desc}</p></div>)}</div> : path[1] === 'usage' ? <><UsageSummary /><UsageSettings action={action}/><div className="panel"><h2>Request reservations</h2><p>Conservative cost estimates in USD, including failed requests. Not an invoice. Current view: latest 1,000 reservations.</p>{rows.map(r => <div className="list-row" key={r.id}><span>{String(r.provider)} / {String(r.sku)}</span><span>${Number(r.estimated_cost).toFixed(4)}</span><span>{new Date(r.created_at).toLocaleString()}</span></div>)}</div></> : <div className="panel"><h2>إعدادات مساحة Vexora</h2><Profile /><SalesProfileEditor/><p>Manage provider configuration and request budgets using the tabs above. Accounts are invitation-only through Supabase Auth; public signup is not part of this application.</p><p>CRM values are entered independently. Place references remain separate from CRM contact data.</p><Link href="/settings/integrations" className="text-link">Set up integrations →</Link></div>}</>}
 </>;
}
const UsersIcon = Target;
function Empty({ text }: {
    text: string;
}) { return <div className="empty"><Target size={28}/><h3>Room for your next opportunity</h3><p>{text}</p></div>; }
function LeadForm({ initial, onSave }: {
    initial?: Lead;
    onSave: (data: unknown) => Promise<void>;
}) { const { register, handleSubmit, formState: { errors, isSubmitting }, setError } = useForm({ resolver: zodResolver(leadSchema), defaultValues: initial ?? defaults }); return <form onSubmit={handleSubmit(async (data) => { try {
    await onSave(data);
}
catch (e) {
    setError('root', { message: (e as Error).message });
} })} className="lead-form">{['business_name', 'website', 'email', 'phone', 'source_url', 'deal_value'].map(k => <label key={k}>{{business_name:'اسم الشركة',website:'الموقع الرسمي',email:'الإيميل',phone:'الهاتف',source_url:'رابط المصدر',deal_value:'قيمة الصفقة المتوقعة'}[k]}<input {...register(k as keyof typeof defaults)} type={k==='deal_value'?'number':'text'}/>{errors[k as keyof typeof errors]&&<small className="error">راجع هذه القيمة</small>}</label>)}<label>المدينة<input {...register('city')} list="lead-city-list"/><datalist id="lead-city-list">{regions.map(r=>r.cities.map(([id,label])=><option key={id} value={label}/>))}</datalist></label><label>النشاط<select {...register('category')}>{initial&&!sectors.some(s=>s.id===initial.category)&&<option value={initial.category}>{categoryLabel(initial.category)}</option>}{sectors.map(s=><option key={s.id} value={s.id}>{s.ar}</option>)}</select></label><label>مرحلة العميل<select {...register('status')}>{statuses.map(s => <option key={s}>{s}</option>)}</select></label><label>حالة التحقق من التواصل<select {...register('verification')}>{['Verified', 'Unverified', 'Not found'].map(s => <option key={s}>{s}</option>)}</select></label><label className="full">ملاحظات<textarea {...register('notes')}/></label><label className="full check"><input type="checkbox" {...register('do_not_contact')}/> طلب عدم التواصل</label>{errors.root && <p className="error">{errors.root.message}</p>}<button className="primary" disabled={isSubmitting}>{isSubmitting ? 'Saving…' : 'حفظ العميل'}</button></form>; }
function UsageSettings({ action }: {
    action: (fn: () => Promise<void>) => Promise<void>;
}) { const [values, setValues] = useState<Record<string, unknown>>({ daily_calls: 0, daily_searches: 0, max_results: 10, monthly_budget: 0, google_unit_cost: 0, ai_unit_cost: 0, enabled: false }); useEffect(() => { api('settings').then(s => { if (s)
    setValues(s); }).catch(() => { }); }, []); return <div className="panel"><h2>API cost controls</h2><p>Requests remain blocked until enabled, with a positive budget and conservative per-call estimate. All costs are USD.</p><form onSubmit={e => { e.preventDefault(); void action(async () => { await api('settings', values); }); }}>{['daily_calls', 'daily_searches', 'max_results', 'monthly_budget', 'google_unit_cost', 'ai_unit_cost'].map(k => <label key={k}>{k.replaceAll('_', ' ')}<input type="number" min={0} step="any" value={Number(values[k])} onChange={e => setValues({ ...values, [k]: Number(e.target.value) })}/></label>)}<label className="check"><input type="checkbox" checked={Boolean(values.enabled)} onChange={e => setValues({ ...values, enabled: e.target.checked })}/> Enable discovery requests</label><button className="primary">Save limits</button></form></div>; }
