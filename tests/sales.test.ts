import {describe,it,expect,vi,afterEach} from 'vitest';
import {regions,sectors,cityLabel,categoryLabel} from '../src/lib/catalog';
import {qualificationSchema,emptyQualification,assess,recommend} from '../src/lib/qualification';
import {manualDraft,draftKinds} from '../src/lib/sales-playbook';
import {draft} from '../src/lib/providers';
import {score} from '../src/lib/scoring';
import {parseCsv} from '../src/lib/csv-import';
import {matchesLead,emptyFilters} from '../src/lib/lead-filters';
import {searchPlanSchema,buildSearchQuery} from '../src/lib/search-plan';
import type {Lead} from '../src/lib/schemas';
import {duplicateHints} from '../src/lib/duplicate-hints';
import {variantAnalytics} from '../src/lib/sales-analytics';
const lead={id:'id',business_name:'شركة الاختبار',city:'Jeddah',category:'General Contractors',website:'',email:'',phone:'',status:'New',notes:'',deal_value:0,do_not_contact:false,verification:'Unverified',source_url:'',score:0,score_reasons:[],created_at:new Date().toISOString()} as Lead;
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals();});
describe('market catalogue',()=>{
 it('covers all 13 regions, translated activities and unique city identifiers',()=>{expect(regions).toHaveLength(13);const cities=regions.flatMap(r=>r.cities.map(c=>c[0]));expect(new Set(cities).size).toBe(cities.length);expect(cities.length).toBeGreaterThan(30);expect(sectors.length).toBeGreaterThan(15);expect(cityLabel('Jeddah')).toBe('جدة');expect(categoryLabel('MEP Contractors')).toContain('الكهرباء');});
 it('builds Arabic search plans without silently increasing API calls',()=>{const p=searchPlanSchema.parse({name:'تشطيب جدة',cities:['Jeddah','Khobar'],category:'Finishing Companies',specialty:'تجهيز محلات'});expect(buildSearchQuery(p,'Jeddah')).toContain('جدة');expect(buildSearchQuery(p,'Jeddah')).toContain('تجهيز محلات');expect(p.cities).toHaveLength(2);});
});
describe('evidence and qualification',()=>{
 it('does not equate missing data with an absent website',()=>{expect(score('',[]).score).toBe(0);expect(assess(emptyQualification())).toMatchObject({points:0,coverage:0,maximum:100,label:'يحتاج تحقق'});});
 it('only scores confirmed website absence with evidence',()=>{expect(score('',[{key:'website_absent',passed:false,evidence:'Official source review'}]).score).toBe(30);expect(score('',[{key:'website_absent',passed:false,evidence:''}]).score).toBe(0);});
 it('requires evidence for assertions and reasons for exclusions',()=>{expect(qualificationSchema.safeParse({fit:'yes'}).success).toBe(false);expect(qualificationSchema.safeParse({excluded:true}).success).toBe(false);expect(qualificationSchema.safeParse({company_type:'branch'}).success).toBe(false);});
 it('does not infer buying readiness from a broken website',()=>{const result=assess(emptyQualification(),[{key:'available',passed:false,evidence:'HTTP 503'}]);expect(result.label).toBe('يحتاج تحقق');expect(result.points).toBe(0);expect(result.observedIssues).toHaveLength(1);});
 it('supports a fully evidenced hot prospect and opt-out takes precedence',()=>{const q=qualificationSchema.parse({fit:'yes',need:'software',official_contact:'yes',decision_maker:'yes',interest:'yes',evidence:'Confirmed in a conversation with the owner'});expect(assess(q)).toMatchObject({points:100,coverage:100,label:'أولوية مرتفعة'});expect(assess(q,[],true).label).toBe('مستبعد');expect(recommend('General Contractors',q).service).toBe('software');});
 it('keeps unsupported service recommendations provisional',()=>expect(recommend('General Contractors',emptyQualification()).basis).toContain('فرضية'));
});
describe('sector-specific drafts without paid APIs',()=>{
 it.each(sectors.map(s=>s.id))('generates a meaningful offer for %s',category=>{const result=manualDraft({lead:{...lead,category}},'ar','First contact');expect(result.text).toContain('Vexora');expect(result.text).toContain('شركة الاختبار');expect(result.text).not.toContain('موقعكم ضعيف');expect(result.text).not.toContain('نضمن');});
 it.each(draftKinds)('supports %s in Arabic and English',kind=>{expect(manualDraft({lead},'ar',kind).text.length).toBeGreaterThan(40);expect(manualDraft({lead},'en',kind).text.length).toBeGreaterThan(40);});
 it('does not call a paid provider unless explicitly requested',async()=>{vi.stubEnv('ANTHROPIC_API_KEY','test-only');vi.stubEnv('ANTHROPIC_MODEL','test-model');const fetcher=vi.fn();vi.stubGlobal('fetch',fetcher);expect((await draft({lead},'ar','First contact')).provider).toBe('sector playbook');expect(fetcher).not.toHaveBeenCalled();});
 it('does not invent portfolio references, prices or delivery times',()=>{const result=manualDraft({lead},'ar','Proposal');expect(result.text).toContain('غير متفق عليه');expect(result.text).toContain('غير معلومة');expect(result.text).not.toContain('https://');});
 it('only adds a specific observation when an audit check actually failed',()=>{const audits=[{payload:{checks:[{key:'contact',passed:false,evidence:'No contact links in fetched homepage'}]}}];expect(manualDraft({lead,audits},'ar','First contact').text).toContain('لم يرصد روابط تواصل');expect(manualDraft({lead},'ar','First contact').text).not.toContain('لم يرصد روابط تواصل');});
 it('uses actual matching portfolio examples only when supplied',()=>{const result=manualDraft({lead,profile:{company:'Vexora',examples:[{title:'مشروع منشور',category:lead.category,url:'https://example.com/work'}]}},'ar','First contact');expect(result.text).toContain('https://example.com/work');});
});
describe('quality filters and CSV',()=>{
 it('distinguishes unknown sites from confirmed absent sites',()=>{expect(matchesLead(lead,{...emptyFilters,website:'absent'})).toBe(false);expect(matchesLead(lead,{...emptyFilters,website:'unknown'})).toBe(true);});
 it('does not surface unknown contacts as verified',()=>expect(matchesLead(lead,{...emptyFilters,verified:true})).toBe(false));
 it('imports quoted commas and Arabic category labels as unverified data',()=>{const csv='business_name,city,category,notes\n"Company, Ltd",Jeddah,شركات المقاولات العامة,"First line\nsecond line"';const rows=parseCsv(csv);expect(rows[0]).toMatchObject({business_name:'Company, Ltd',category:'General Contractors',verification:'Unverified',status:'New'});expect(rows[0].notes).toContain('\n');});
 it('rejects malformed rows and scripts before any writes',()=>{expect(()=>parseCsv('business_name,city,category\nCompany,Jeddah')).toThrow();expect(()=>parseCsv('business_name,city,category,website\nCompany,Jeddah,Contractor,javascript:alert(1)')).toThrow();});
 it('preserves imported opt-outs and never upgrades verification',()=>{const rows=parseCsv('business_name,city,category,do_not_contact,verification\nCompany,Jeddah,Contractors,true,Verified');expect(rows[0].do_not_contact).toBe(true);expect(rows[0].verification).toBe('Unverified');});
 it('flags shared contact details without merging records',()=>{const a={...lead,email:'team@example.com'};expect(duplicateHints(a,[{...a,id:'other'}])[0].reasons).toContain('نفس الإيميل المسجل');expect(duplicateHints(a,[a])).toHaveLength(0);});
 it('does not count drafts as contact attempts and deduplicates recorded results',()=>{const drafts=[{lead_id:'1',payload:{variant:'A'}}];const activities=[{lead_id:'1',payload:{event:'outreach',variant:'A',outcome:'replied'}},{lead_id:'1',payload:{event:'outreach',variant:'A',outcome:'replied'}}];expect(variantAnalytics(drafts,activities)[0]).toMatchObject({drafts:1,attempts:0,replies:1,meetings:0});});
});
