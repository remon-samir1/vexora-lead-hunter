import {z} from 'zod';
import {sectorFor,type Service} from './catalog';
import type {Check} from './scoring';
const state=z.enum(['unknown','yes','no']);
export const qualificationSchema=z.object({
 website_state:z.enum(['unknown','present','confirmed_absent']).default('unknown'),
 fit:state.default('unknown'),portfolio:state.default('unknown'),official_contact:state.default('unknown'),decision_maker:state.default('unknown'),interest:state.default('unknown'),
 need:z.enum(['unknown','website','ecommerce','software','app','marketing','design']).default('unknown'),
 evidence:z.string().trim().max(4000).default(''),source_url:z.union([z.url().refine(v=>/^https?:\/\//i.test(v)),z.literal('')]).default(''),
 contact_person:z.string().max(150).default(''),timing:z.string().max(200).default(''),budget:z.string().max(200).default(''),scope:z.string().max(3000).default(''),
 company_type:z.enum(['unknown','independent','branch']).default('unknown'),parent_company:z.string().max(200).default(''),
 excluded:z.boolean().default(false),exclusion_reason:z.string().max(1000).default(''),next_step:z.string().max(1000).default(''),
}).superRefine((v,c)=>{
 const asserted=v.website_state==='confirmed_absent'||[v.fit,v.portfolio,v.official_contact,v.decision_maker,v.interest].some(s=>s!=='unknown')||v.need!=='unknown';
 if(asserted&&v.evidence.length<5)c.addIssue({code:'custom',path:['evidence'],message:'أضف دليلًا أو ملخص محادثة يبرر المعلومات المثبتة.'});
 if(v.excluded&&!v.exclusion_reason.trim())c.addIssue({code:'custom',path:['exclusion_reason'],message:'اذكر سبب الاستبعاد.'});
 if(v.company_type==='branch'&&!v.parent_company.trim())c.addIssue({code:'custom',path:['parent_company'],message:'حدد الشركة الأم لمنع التواصل المكرر.'});
});
export type Qualification=z.infer<typeof qualificationSchema>;
export const emptyQualification=()=>qualificationSchema.parse({});
export function readQualification(value:unknown){const result=qualificationSchema.safeParse(value);return result.success?result.data:emptyQualification();}
export function assess(q:Qualification,checks:Check[]=[],blocked=false){
 const signals=[{key:'fit',label:'ملاءمة الخدمة',weight:25,value:q.fit},
 {key:'need',label:'احتياج صرّح به العميل',weight:30,value:q.need==='unknown'?'unknown':'yes'},
 {key:'contact',label:'قناة رسمية موثقة',weight:15,value:q.official_contact},
 {key:'decision',label:'الشخص المسؤول معروف',weight:10,value:q.decision_maker},
 {key:'interest',label:'اهتمام مثبت',weight:20,value:q.interest}];
 const confirmed=signals.filter(s=>s.value!=='unknown');const coverage=confirmed.reduce((s,r)=>s+r.weight,0);const points=signals.reduce((s,r)=>s+(r.value==='yes'?r.weight:0),0);
 const disqualified=blocked||q.excluded||q.fit==='no'||q.interest==='no';
 return {points,coverage,maximum:points+100-coverage,label:disqualified?'مستبعد':coverage<70?'يحتاج تحقق':points>=75?'أولوية مرتفعة':points>=45?'أولوية متوسطة':'أولوية منخفضة',signals,
 confidence:coverage>=80?'مرتفعة':coverage>=50?'متوسطة':'محدودة',observedIssues:checks.filter(c=>c.passed===false).map(c=>({key:c.key,evidence:c.evidence})),
 nextStep:disqualified?'أوقف التواصل وسجّل السبب':q.next_step||(q.official_contact==='unknown'?'تحقق من وسيلة التواصل الرسمية':q.need==='unknown'?'اسأل عن الأولوية واحتياج العمل':q.interest==='yes'?'اتفق على مكالمة لفهم النطاق والتوقيت':'أرسل رسالة تعريفية قصيرة واطلب الإذن بمشاركة تصور')};
}
export function recommend(category:string,q:Qualification,proposedService?:Service){
 const sector=sectorFor(category);const chosen:Service=q.need==='unknown'?(proposedService??(category==='Local Retail Brands'?'ecommerce':'website')):q.need;
 const offers:Record<Service,string>={website:sector?.offer??'موقع شركة واضح للخدمات والأعمال وطلبات التواصل',ecommerce:'متجر إلكتروني للمنتجات والطلبات والتكاملات المطلوبة',software:'نظام داخلي أو بوابة عملاء بعد دراسة سير العمل والصلاحيات والتكاملات',app:'دراسة جدوى تطبيق بعد إثبات الحاجة للاستخدام المتكرر ووظائف الجهاز',marketing:'خطة تسويق مرتبطة بهدف واضح وصفحات هبوط قابلة للقياس',design:'هوية ومواد تصميم تدعم عرض الخدمة وتجربة الموقع'};
 const serviceGoals:Partial<Record<Service,string>>={software:'تنظيم سير العمل والصلاحيات ومتابعة الطلبات وفق احتياج الشركة',app:'تقييم تجربة الاستخدام المتكرر والوظائف التي تبرر تطوير تطبيق',marketing:'تحديد هدف تسويقي قابل للقياس وربطه برحلة العميل',design:'دعم وضوح الهوية وعرض الخدمات وتجربة العميل',ecommerce:'تنظيم عرض المنتجات ورحلة الطلب والتكاملات اللازمة'};
 return {service:chosen,offer:offers[chosen],goal:serviceGoals[chosen]??sector?.goal??'توضيح الخدمات وتنظيم رحلة العميل',question:sector?.question??'ما أهم خطوة تريدون تحسينها في استقبال ومتابعة العملاء؟',basis:q.need==='unknown'?'فرضية من نوع النشاط تحتاج تأكيد العميل':'احتياج مسجل مع دليل؛ راجع مصدره قبل تقديم العرض',complement:'التسويق والتصميم خدمات مكملة عند الحاجة، بدون افتراض أنها مطلوبة لكل عميل.'};
}
