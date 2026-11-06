import type { SupabaseClient } from '@supabase/supabase-js';
import type { Lead } from './schemas';
import {readQualification,assess} from './qualification';
import {score,type Check} from './scoring';
export async function allRows(client:SupabaseClient,table:string){
 const rows:Record<string,unknown>[]=[];
 for(let offset=0;;offset+=1000){const {data,error}=await client.from(table).select('*').order('created_at',{ascending:false}).order('id').range(offset,offset+999);if(error)throw new Error('تعذر قراءة البيانات. راجع الاتصال والصلاحيات.');rows.push(...data);if(data.length<1000)break;}
 return rows;
}
export async function leadIntelligence(client:SupabaseClient,leads:Lead[]){
 const [sources,audits]=await Promise.all([allRows(client,'lead_sources'),allRows(client,'website_audits')]);
 return leads.map(lead=>{
  const source=sources.find(s=>s.lead_id===lead.id&&(s.payload as Record<string,unknown>)?.kind==='qualification');
  const qualification=readQualification((source?.payload as Record<string,unknown>)?.data);
  const audit=audits.find(a=>a.lead_id===lead.id);const payload=audit?.payload as {checks?:Check[]}|undefined;
  const checks=Array.isArray(payload?.checks)?payload.checks:[];
  const effective=qualification.website_state==='confirmed_absent'&&!lead.website?[...checks,{key:'website_absent',passed:false,evidence:qualification.evidence}]:checks;
  const computed=score(lead.website,effective);const manual=lead.score_reasons?.some(r=>r.startsWith('Manual:'));
  return {...lead,...manual?{}:{score:computed.score,score_reasons:computed.reasons},qualification,qualification_updated_at:source?.created_at,quality:assess(qualification,checks,lead.do_not_contact||lead.status==='Not Interested'),audit_checks:checks};
 });
}
export async function allLeads(client: SupabaseClient) { const result: Lead[] = []; for (let offset = 0;; offset += 1000) {
    const { data, error } = await client.from('lead_records').select('*').order('created_at', { ascending: false }).order('id').range(offset, offset + 999);
    if (error)
        throw new Error('Unable to load leads. Check database configuration.');
    result.push(...data as Lead[]);
    if (data.length < 1000)
        break;
} return result; }
