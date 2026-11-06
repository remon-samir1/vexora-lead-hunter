import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/supabase';
import { leadSchema, searchSchema, settingsSchema } from '@/lib/schemas';
import { auditWebsite } from '@/lib/audit';
import { score, csvCell } from '@/lib/scoring';
import { GooglePlaces, draft } from '@/lib/providers';
import { z } from 'zod';
import { enrich } from '@/lib/enrichment';
import { allLeads,allRows,leadIntelligence } from '@/lib/repository';
import {isSameOrigin} from '@/lib/request-origin';
import {placeIds} from '@/lib/discovery-types';
import {qualificationSchema,readQualification,assess,recommend} from '@/lib/qualification';
import {draftKinds,salesProfileSchema} from '@/lib/sales-playbook';
import {searchPlanSchema,buildSearchQuery} from '@/lib/search-plan';
import {parseCsv} from '@/lib/csv-import';
import {variantAnalytics} from '@/lib/sales-analytics';
export const runtime = 'nodejs';
async function handler(req: NextRequest, { params }: {
    params: Promise<{
        path: string[];
    }>;
}) {
    try {
        if (req.method !== 'GET' && !isSameOrigin(req))
            return NextResponse.json({ error: 'Invalid request origin' }, { status: 403 });
        const client = await db();
        const { data: { user } } = await client.auth.getUser();
        if (!user)
            return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
        const limited = await client.rpc('check_rate_limit');
        if (limited.error)
            return NextResponse.json({ error: 'Request limit reached or security migration missing' }, { status: 429 });
        const path = (await params).path;
        const body = req.method === 'GET' ? {} : await req.json();
        if (req.method === 'GET' && !['sales-analytics','sales-profile','saved-searches','qualification','discovery-status','usage-summary','recent', 'profile', 'leads', 'settings', 'usage', 'discover', 'follow-ups', 'audits', 'timeline', 'sources'].includes(path[0]))
            return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
        const checked = <T,>(r: {
            data: T;
            error: unknown;
        }) => { if (r.error) {
            if (typeof r.error === 'object' && r.error !== null && 'code' in r.error && r.error.code === '23505')
                throw new Error('A matching business already exists in this city. Edit the existing record.');
            throw new Error('Database operation failed. Check migrations and permissions.');
        } return r.data; };
        if(path[0]==='discovery-status')return NextResponse.json({configured:Boolean(process.env.GOOGLE_PLACES_API_KEY),enabled:process.env.GOOGLE_REQUESTS_ENABLED==='true'},{headers:{'Cache-Control':'private, no-store'}});
        if(path[0]==='usage-summary')return NextResponse.json(checked(await client.rpc('usage_summary')));
        if(path[0]==='sales-analytics'){const [drafts,activities]=await Promise.all([allRows(client,'ai_generations'),allRows(client,'lead_activities')]);return NextResponse.json({variants:variantAnalytics(drafts,activities)});}
        if(path[0]==='sales-profile'){
            if(req.method==='GET'){const result=await client.from('sales_profiles').select('data').eq('owner_id',user.id).maybeSingle();if(result.error){if(['PGRST205','42P01'].includes(result.error.code))return NextResponse.json({data:salesProfileSchema.parse({}),requires_migration:true});checked(result);}return NextResponse.json({data:result.data?.data??salesProfileSchema.parse({}),requires_migration:false});}
            const data=salesProfileSchema.parse(body);const result=await client.from('sales_profiles').upsert({owner_id:user.id,data},{onConflict:'owner_id'});if(result.error)throw new Error('احفظ ملف خدمات Vexora بعد تشغيل تحديث قاعدة البيانات 008 من SQL Editor.');return NextResponse.json({ok:true});
        }
        if(path[0]==='saved-searches'){
            if(req.method==='GET'){const rows=await allRows(client,'search_jobs');return NextResponse.json(rows.filter(r=>r.status==='saved').map(r=>{try{const plan=searchPlanSchema.parse(JSON.parse(String(r.query)));return {id:r.id,plan};}catch{return null;}}).filter(Boolean));}
            if(body.archive_id){checked(await client.from('search_jobs').update({status:'archived'}).eq('id',z.uuid().parse(body.archive_id)).eq('status','saved'));return NextResponse.json({ok:true});}
            const plan=searchPlanSchema.parse(body);const serialized=JSON.stringify(plan);const existing=(await allRows(client,'search_jobs')).find(r=>r.status==='saved'&&r.query===serialized);if(existing)return NextResponse.json({...existing,deduplicated:true});return NextResponse.json(checked(await client.from('search_jobs').insert({query:serialized,status:'saved',place_ids:[]}).select().single()));
        }
        if (path[0] === 'recent')
            return NextResponse.json(checked(await client.from('lead_activities').select('*,lead_records(business_name)').order('created_at', { ascending: false }).limit(10)));
        if (path[0] === 'profile') {
            if (req.method === 'GET')
                return NextResponse.json({ email: user.email, profile: checked(await client.from('profiles').select('*').eq('id', user.id).maybeSingle()) });
            const display_name = z.string().trim().min(1).max(100).parse(body.display_name);
            return NextResponse.json(checked(await client.from('profiles').upsert({ id: user.id, display_name }).select().single()));
        }
        if(path[0]==='import-leads'){
            if(req.method!=='POST'||body.licensed!==true)throw new Error('أكد حق استخدام مصدر الملف قبل الاستيراد.');
            const records=parseCsv(z.string().max(524288).parse(body.text));let created=0,duplicates=0,failed=0;const errors:string[]=[];
            for(const [index,record] of records.entries()){
                const inserted=await client.from('lead_records').insert({...record,score:0,score_reasons:[]}).select().single();
                if(inserted.error){if(inserted.error.code==='23505')duplicates++;else{failed++;errors.push(`الصف ${index+2}: تعذر الحفظ.`);}continue;}
                created++;const provenance=await client.from('lead_sources').insert({lead_id:inserted.data.id,payload:{kind:'import',source_type:'user-provided licensed CSV',source_url:record.source_url,verification:'Unverified',discovered_at:new Date().toISOString()}});
                if(provenance.error)errors.push(`الصف ${index+2}: حُفظ العميل لكن تعذر حفظ المصدر؛ راجعه يدويًا.`);
            }
            return NextResponse.json({created,duplicates,failed,errors});
        }
        if (path[0] === 'leads') {
            if (req.method === 'GET') {
                const rows = await allLeads(client); // RLS scopes every query.
                if (path[1] === 'export') {
                    const fields = ['business_name', 'city', 'category', 'email', 'phone', 'status', 'score', 'deal_value'] as const;
                    return new NextResponse([fields.join(','), ...rows.map(row => fields.map(f => csvCell(row[f])).join(','))].join('\r\n'), { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="vexora-leads.csv"' } });
                }
                return NextResponse.json(await leadIntelligence(client,rows));
            }
            const data = leadSchema.parse(body);
            const initial = score(data.website, []);
            const row = path[1] ? checked(await client.from('lead_records').update(data).eq('id', z.uuid().parse(path[1])).select().single()) : checked(await client.from('lead_records').insert({ ...data, score: initial.score, score_reasons: initial.reasons }).select().single());
            checked(await client.from('lead_sources').insert(['business_name', 'city', 'category', 'website', 'email', 'phone'].map(field => ({ lead_id: row.id, payload: { field, value: data[field as keyof typeof data], source_url: data.source_url, source_type: 'user supplied', verification: data[field as keyof typeof data] ? data.verification : 'Not found', discovered_at: new Date().toISOString() } }))));
            checked(await client.from('lead_activities').insert({ lead_id: row.id, payload: { action: path[1] ? 'Lead updated' : 'Lead created' } }));
            return NextResponse.json(row);
        }
        if (path[0] === 'settings') {
            if (req.method === 'GET')
                return NextResponse.json(checked(await client.from('app_settings').select('*').maybeSingle()));
            return NextResponse.json(checked(await client.from('app_settings').upsert({ ...settingsSchema.parse(body), owner_id: user.id }, { onConflict: 'owner_id' }).select().single()));
        }
        if (path[0] === 'usage')
            return NextResponse.json(checked(await client.from('api_usage').select('*').order('created_at', { ascending: false }).limit(1000)));
        if (path[0] === 'discover') {
            if (req.method === 'GET')
                return NextResponse.json(checked(await client.from('search_jobs').select('*').order('created_at', { ascending: false }).limit(50)));
            if(process.env.GOOGLE_REQUESTS_ENABLED!=='true')throw new Error('البحث التلقائي متوقف بطلبك لمنع أي طلب مدفوع. يمكنك البحث اليدوي في خرائط Google، أو تحديد ميزانية لتفعيله لاحقًا.');
            const input = searchSchema.parse(body);
            if (!process.env.GOOGLE_PLACES_API_KEY)
                throw new Error('Configure the Google Places API key first');
            const settings = checked(await client.from('app_settings').select('*').maybeSingle());
            if(!settings)throw new Error('حدد حدود الاستخدام والميزانية من Settings → Usage قبل البحث.');
            if (input.maximum > settings.max_results)
                throw new Error('Maximum results exceeds configured limit');
            const reservation = await client.rpc(input.mode==='preview'?'reserve_google_pro_call':'reserve_google_call');
            if (reservation.error)
                throw new Error(input.mode==='preview'?'عرض الأسماء يحتاج تشغيل التحديث 007 وحدود استخدام وميزانية مفعلة.':'البحث متوقف أو تم الوصول لحد الاستخدام أو الميزانية. راجع Settings → Usage.');
            const query = buildSearchQuery({category:input.category,keywords:input.keywords,specialty:input.specialty,district:input.district},input.city);
            const job = checked(await client.from('search_jobs').insert({ query }).select().single());
            try {
                const places = await new GooglePlaces().search(query, input.maximum,input.mode);
                const ids=placeIds(places);
                checked(await client.from('search_jobs').update({ status: 'completed', place_ids: ids }).eq('id', job.id));
                return NextResponse.json({ ids,places,mode:input.mode,queried_at:new Date().toISOString() },{headers:{'Cache-Control':'private, no-store, max-age=0','Pragma':'no-cache'}});
            }
            catch (e) {
                await client.from('search_jobs').update({ status: 'failed' }).eq('id', job.id);
                throw e;
            }
        }
        if (path[0] === 'follow-ups') {
            if (req.method === 'GET')
                return NextResponse.json(checked(await client.from('follow_ups').select('*,lead_records(business_name)').order('due_at')));
            if (body.id) {
                return NextResponse.json(checked(await client.from('follow_ups').update({ completed: true }).eq('id', z.uuid().parse(body.id))));
            }
            const input = z.object({ lead_id: z.uuid(), due_at: z.iso.datetime(), stage: z.enum(['First follow-up', 'Second follow-up', 'Final follow-up']) }).parse(body);
            const target = checked(await client.from('lead_records').select('do_not_contact,status').eq('id', input.lead_id).single());
            if (!target || target.do_not_contact || target.status === 'Not Interested')
                throw new Error('This lead has opted out');
            const followupResearch=checked(await client.from('lead_sources').select('payload').eq('lead_id',input.lead_id).order('created_at',{ascending:false}));
            const followupQualification=readQualification((followupResearch??[]).find(r=>r.payload?.kind==='qualification')?.payload?.data);
            if(followupQualification.excluded||followupQualification.interest==='no'||followupQualification.fit==='no')throw new Error('العميل مستبعد من المتابعة بناء على التأهيل.');
            return NextResponse.json(checked(await client.from('follow_ups').insert({ lead_id: input.lead_id, due_at: input.due_at, payload: { stage: input.stage } })));
        }
        if (path[0] === 'audits' && req.method === 'GET')
            return NextResponse.json(checked(await client.from('website_audits').select('*,lead_records(business_name)').order('created_at', { ascending: false })));
        const leadId = z.uuid().parse(body.lead_id ?? path[1]);
        const lead = checked(await client.from('lead_records').select('*').eq('id', leadId).single());
        if(path[0]==='outreach-outcome'){
            const event=z.object({variant:z.enum(['A','B']),outcome:z.enum(['contacted','replied','meeting','opt_out']),note:z.string().max(2000).default('')}).parse(body);
            const research=checked(await client.from('lead_sources').select('payload').eq('lead_id',leadId).order('created_at',{ascending:false}));const q=readQualification((research??[]).find(r=>r.payload?.kind==='qualification')?.payload?.data);
            if(event.outcome!=='opt_out'&&(lead.do_not_contact||lead.status==='Not Interested'||q.excluded||q.interest==='no'||q.fit==='no'))throw new Error('لا تسجل تواصلًا جديدًا مع عميل مستبعد أو طلب عدم التواصل.');
            checked(await client.from('lead_activities').insert({lead_id:leadId,payload:{event:'outreach',...event,recorded_at:new Date().toISOString()}}));
            if(event.outcome==='opt_out')checked(await client.from('lead_records').update({do_not_contact:true,status:'Not Interested'}).eq('id',leadId));
            return NextResponse.json({ok:true});
        }
        if(path[0]==='qualification'){
            const rows=checked(await client.from('lead_sources').select('*').eq('lead_id',leadId).order('created_at',{ascending:false}));
            const latest=(rows??[]).find(r=>r.payload?.kind==='qualification');
            if(req.method==='GET'){const q=readQualification(latest?.payload?.data);return NextResponse.json({data:q,assessment:assess(q,[],lead.do_not_contact||lead.status==='Not Interested'),plan:recommend(lead.category,q)});}
            const data=qualificationSchema.parse(body.data);if(data.website_state==='confirmed_absent'&&lead.website)throw new Error('يوجد موقع مسجل للشركة. راجع الموقع قبل تأكيد عدم وجوده.');if(data.website_state==='present'&&!lead.website)throw new Error('سجل رابط الموقع الرسمي في بيانات الشركة أولًا.');
            checked(await client.from('lead_sources').insert({lead_id:leadId,payload:{kind:'qualification',data,discovered_at:new Date().toISOString(),source_type:'user verified research'}}));
            checked(await client.from('lead_activities').insert({lead_id:leadId,payload:{action:'تحديث تأهيل العميل',qualification:data}}));
            const calculated=score(lead.website,data.website_state==='confirmed_absent'?[{key:'website_absent',passed:false,evidence:data.evidence}]:[]);
            if(!lead.score_reasons?.some((r:string)=>r.startsWith('Manual:')))checked(await client.from('lead_records').update({score:calculated.score,score_reasons:calculated.reasons}).eq('id',leadId));
            return NextResponse.json({ok:true,data,assessment:assess(data,[],lead.do_not_contact||lead.status==='Not Interested')});
        }
        if (path[0] === 'sources')
            return NextResponse.json((checked(await client.from('lead_sources').select('*').eq('lead_id', leadId).order('created_at', { ascending: false }))??[]).filter(r=>r.payload?.kind!=='qualification'));
        if (path[0] === 'manual-source') {
            const input = z.object({ field: z.enum(['email', 'phone', 'whatsapp', 'instagram', 'linkedin', 'facebook']), value: z.string().min(1).max(500), source_url: z.url().refine(v => new URL(v).protocol === 'https:'), verification: z.enum(['Verified', 'Unverified']) }).parse(body);
            if (input.field === 'email')
                z.email().parse(input.value);
            if (['whatsapp', 'instagram', 'linkedin', 'facebook'].includes(input.field)) {
                const u = new URL(input.value);
                if (u.protocol !== 'https:')
                    throw new Error('Social links must use HTTPS');
                if (input.field === 'whatsapp' && !['wa.me', 'api.whatsapp.com'].includes(u.hostname))
                    throw new Error('Use an official WhatsApp link');
            }
            return NextResponse.json(checked(await client.from('lead_sources').insert({ lead_id: leadId, payload: { ...input, source_type: 'user supplied', discovered_at: new Date().toISOString() } })));
        }
        if (path[0] === 'enrich') {
            if (body.terms_confirmed !== true)
                throw new Error('Confirm website access permission first');
            const sources = await enrich(lead.website);
            if (sources.length)
                checked(await client.from('lead_sources').insert(sources.map(payload => ({ lead_id: leadId, payload }))));
            return NextResponse.json({ found: sources.length });
        }
        if (path[0] === 'verify-source') {
            const source = checked(await client.from('lead_sources').select('*').eq('id', z.uuid().parse(body.source_id)).eq('lead_id', leadId).single());
            checked(await client.from('lead_sources').update({ payload: { ...source.payload, verification: 'Verified', verified_at: new Date().toISOString() } }).eq('id', source.id));
            return NextResponse.json({ ok: true });
        }
        if (path[0] === 'adjust-score') {
            const input = z.object({ score: z.coerce.number().int().min(0).max(100), reason: z.string().min(5).max(2000) }).parse(body);
            checked(await client.from('lead_scores').insert({ lead_id: leadId, payload: { before: lead.score, after: input.score, reason: input.reason, manual: true } }));
            checked(await client.from('lead_records').update({ score: input.score, score_reasons: [...lead.score_reasons, 'Manual: ' + input.reason] }).eq('id', leadId));
            return NextResponse.json({ ok: true });
        }
        if (path[0] === 'audit') {
            if (!lead.website)
                throw new Error('Add an official website first');
            const checks = await auditWebsite(lead.website);
            const result = score(lead.website, checks);
            checked(await client.from('website_audits').insert({ lead_id: leadId, payload: { url: lead.website, checks } }));
            checked(await client.from('lead_scores').insert({ lead_id: leadId, payload: result }));
            checked(await client.from('lead_records').update({ score: result.score, score_reasons: result.reasons }).eq('id', leadId));
            return NextResponse.json({ checks, ...result });
        }
        if (path[0] === 'draft') {
            if (lead.do_not_contact || lead.status === 'Not Interested')
                throw new Error('This lead has opted out');
            const language = z.enum(['en', 'ar']).parse(body.language);
            const kind = z.enum(draftKinds).parse(body.kind);
            const variant=z.enum(['A','B']).default('A').parse(body.variant);
            const qRows=checked(await client.from('lead_sources').select('payload').eq('lead_id',leadId).order('created_at',{ascending:false}));
            const qualification=readQualification((qRows??[]).find(r=>r.payload?.kind==='qualification')?.payload?.data);
            if(qualification.excluded||qualification.interest==='no'||qualification.fit==='no')throw new Error('العميل مستبعد أو لا يرغب في التواصل.');
            const audits = checked(await client.from('website_audits').select('payload').eq('lead_id', leadId).order('created_at', { ascending: false }).limit(1));
            const useAI=body.use_ai===true;
            if (useAI&&process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_MODEL) {
                const reserve = await client.rpc('reserve_ai_call');
                if (reserve.error)
                    throw new Error('AI usage is disabled or its budget limit is reached');
            }
            const storedProfile=await client.from('sales_profiles').select('data').eq('owner_id',user.id).maybeSingle();
            const profile=salesProfileSchema.safeParse(storedProfile.data?.data);const result = await draft({ lead, audits,qualification,profile:profile.success?profile.data:undefined }, language, kind,useAI,variant);
            checked(await client.from('ai_generations').insert({ lead_id: leadId, payload: { ...result, language, kind,variant } }));
            return NextResponse.json(result);
        }
        if (path[0] === 'activity') {
            const note = z.string().min(1).max(2000).parse(body.note);
            return NextResponse.json(checked(await client.from('lead_activities').insert({ lead_id: leadId, payload: { note } })));
        }
        if (path[0] === 'timeline')
            return NextResponse.json(checked(await client.from('lead_activities').select('*').eq('lead_id', leadId).order('created_at', { ascending: false })));
        return NextResponse.json({ error: 'Unknown operation' }, { status: 404 });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Request failed';
        return NextResponse.json({ error: message }, { status: 400 });
    }
}
export { handler as GET, handler as POST };
