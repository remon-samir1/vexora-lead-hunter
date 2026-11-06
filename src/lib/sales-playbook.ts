import {z} from 'zod';
import {categoryLabel,cityLabel,serviceLabels} from './catalog';
import {readQualification,recommend,assess} from './qualification';
export const draftKinds=['First contact','WhatsApp','Email','Follow-up','Final follow-up','Call points','Improvements','Package','Proposal','Price objection','Timing objection','Existing supplier'] as const;
export const draftLabels:Record<typeof draftKinds[number],string>={'First contact':'رسالة أولى',WhatsApp:'واتساب',Email:'إيميل','Follow-up':'متابعة تضيف قيمة','Final follow-up':'متابعة أخيرة','Call points':'أسئلة مكالمة اكتشاف',Improvements:'فرص تحسين موثقة',Package:'الخدمة والنطاق المبدئي',Proposal:'مسودة عرض مشروع','Price objection':'الرد على اعتراض السعر','Timing objection':'الرد على عدم مناسبة التوقيت','Existing supplier':'الرد عند وجود مورد حالي'};
export const salesProfileSchema=z.object({company:z.string().trim().min(1).max(100).default('Vexora'),sender:z.string().max(100).default(''),portfolio_url:z.union([z.url().refine(v=>/^https:\/\//i.test(v)),z.literal('')]).default(''),notes:z.string().max(3000).default(''),examples:z.array(z.object({title:z.string().min(1).max(150),category:z.string().max(100),url:z.url().refine(v=>/^https:\/\//i.test(v))})).max(20).default([])});
export type SalesProfile=z.infer<typeof salesProfileSchema>;
export function manualDraft(input:unknown,language:string,kind:string,variant='A'){
 const data=z.object({lead:z.object({business_name:z.string(),city:z.string(),category:z.string()}),proposed_service:z.enum(['website','ecommerce','software','app','marketing','design']).optional(),qualification:z.unknown().optional(),audits:z.array(z.object({payload:z.object({checks:z.array(z.object({key:z.string(),passed:z.boolean().nullable(),evidence:z.string()})).optional()}).passthrough()})).optional(),profile:salesProfileSchema.optional()}).parse(input);
 const lead=data.lead;const q=readQualification(data.qualification);const profile=data.profile??salesProfileSchema.parse({});const plan=recommend(lead.category,q,data.proposed_service);const checks=data.audits?.[0]?.payload.checks??[];const quality=assess(q,checks);
 const sender=profile.sender?`${profile.sender} من ${profile.company}`:`فريق ${profile.company}`;
 const example=profile.examples.find(e=>e.category===lead.category);
 const link=example?`\nمثال من أعمالنا المسجلة: ${example.title} — ${example.url}`:profile.portfolio_url?`\nيمكنكم الاطلاع على أعمالنا: ${profile.portfolio_url}`:'';
 const greeting=`السلام عليكم فريق ${lead.business_name}، معكم ${sender}.`;
 const observed=checks.find(c=>c.passed===false&&['available','seo','contact'].includes(c.key));
 const observations:Record<string,string>={available:'الفحص الأولي للموقع سجّل تعذر الوصول للصفحة وقت المراجعة؛ نقدر نراجع السبب معكم قبل اقتراح حل.',seo:'الفحص الأولي للصفحة رصد نقصًا في عنوانها أو وصفها التعريفي؛ دي نقطة نقدر نراجعها ضمن تصور الموقع.',contact:'الفحص الأولي للصفحة لم يرصد روابط تواصل واضحة فيها؛ نقدر نراجع معكم رحلة طلب الخدمة.'};
 const intro=`نطوّر ${plan.offer}، بهدف ${plan.goal}.${observed?'\n'+observations[observed.key]:''}`;
 const cta=variant==='B'?`هل أنتم الشخص المناسب لمناقشة ${serviceLabels[plan.service]}، أم أتواصل مع مسؤول آخر؟`:'هل يناسبكم أشارككم تصورًا مختصرًا مناسبًا لشركتكم؟';
 const knownIssues=checks.filter(c=>c.passed===false).map(c=>`${c.key}: ${c.evidence}`);
 const evidenceText=knownIssues.length?`ملاحظات مسجلة تحتاج مراجعة سياقها:\n${knownIssues.map(x=>'• '+x).join('\n')}`:'لا توجد ملاحظات تدقيق مثبتة حاليًا. نبدأ بفهم الهدف، بدون افتراض وجود مشكلة.';
 const ar:Record<string,string>={
 'First contact':`${greeting}\n${intro}\n${cta}${link}`,
 WhatsApp:`${greeting}\n${intro}\n${cta}`,
 Email:`الموضوع: تصور رقمي مناسب لـ${lead.business_name}\n\n${greeting}\n${intro}\n${cta}${link}\n\nتحياتي، ${profile.company}`,
 'Follow-up':`${greeting}\nمتابعة لرسالتي السابقة: ${plan.question}\nإجابتكم تساعدنا نحدد إن كان ${serviceLabels[plan.service]} مناسبًا فعلًا، بدل إرسال عرض عام. هل الأولوية دي مطروحة حاليًا؟`,
 'Final follow-up':`${greeting}\nدي آخر متابعة بخصوص ${serviceLabels[plan.service]}. لو الموضوع مش ضمن أولوياتكم، هوقف المتابعة. وإذا أحببتم مناقشته لاحقًا يسعدنا التواصل في الوقت المناسب.`,
 'Call points':`أسئلة مكالمة ${lead.business_name}:\n1. ${plan.question}\n2. مين المستخدمون ومسؤول القرار؟\n3. ما الخطوات الحالية التي تستغرق وقتًا أو تتكرر؟\n4. ما الهدف الذي تريدون قياسه؟\n5. ما التكاملات والمحتوى المطلوب؟\n6. ما التوقيت والميزانية المتاحة؟\n7. ما الخطوة التالية التي نتفق عليها؟\n\nالمسجل بالفعل: ${q.scope||'النطاق غير محدد'}؛ التوقيت: ${q.timing||'غير معروف'}؛ الميزانية: ${q.budget||'غير معروفة'}.`,
 Improvements:`${evidenceText}\n\nفرضية مناسبة للنشاط: ${plan.offer}.\nلا تُعرض كتشخيص مؤكد قبل المراجعة.`,
 Package:`الخدمة المقترحة: ${serviceLabels[plan.service]}\n${plan.offer}\nالهدف: ${plan.goal}\nأساس الاقتراح: ${plan.basis}\nنحدد المحتوى والصفحات والوظائف والتكاملات بعد مكالمة اكتشاف. لا توجد أسعار أو مواعيد تسليم معتمدة بعد.`,
 Proposal:`مسودة نطاق مشروع لـ${lead.business_name}\n\nالهدف: ${plan.goal}\nالحل المبدئي: ${plan.offer}\nالنطاق المسجل: ${q.scope||'يُحدد مع العميل'}\nالتوقيت: ${q.timing||'غير متفق عليه'}\nالميزانية المصرح بها: ${q.budget||'غير معلومة'}\n\nبنود للمناقشة: المحتوى، الصفحات، الوظائف، التصميم، التكاملات، الاختبار، التسليم والتدريب والدعم.\nالاستثناءات والتكلفة والدفعات والملكية ومعايير القبول تحتاج اتفاقًا مكتوبًا. المسودة ليست عرض سعر نهائيًا.`,
 'Price objection':`${greeting}\nمتفهمين أهمية الميزانية. ممكن نراجع الوظائف الأساسية ونقسم التنفيذ لمراحل، مع توضيح تكلفة ونطاق كل مرحلة قبل الاتفاق. ما النتيجة الأهم لكم في البداية؟`,
 'Timing objection':`${greeting}\nمتفهمين إن التوقيت مش مناسب. هل تفضلون إيقاف المتابعة، أم نحدد موعدًا لاحقًا يناسبكم؟ لن نرتب متابعة جديدة إلا بموافقتكم.`,
 'Existing supplier':`${greeting}\nجميل أن عندكم فريق أو مورد قائم. لو ظهر احتياج محدد في الويب أو الأنظمة خارج النطاق الحالي، يسعدنا دراسة التعاون بدون افتراض تغيير المورد. هل يوجد احتياج مطروح حاليًا؟`,
 };
 const enIntro=`Hello ${lead.business_name} team, this is ${profile.sender||'the team'} from ${profile.company}. We build business websites and software solutions. For your ${lead.category} business, we would like to understand your goals before recommending a scope.`;
 const en:Record<string,string>={
 'Follow-up':`${enIntro}\nFollowing up on our previous message: is improving your website or internal workflow a current priority? If not, we can stop following up.`,
 'Final follow-up':`${enIntro}\nThis is our final follow-up. We will stop here unless you would like to discuss the opportunity later.`,
 'Call points':`Discovery call for ${lead.business_name}:\n1. What are your goals and current workflow?\n2. Who are the users and decision maker?\n3. Which tasks are repetitive or slow?\n4. What integrations and content are needed?\n5. What timeline and budget have you allocated?\n6. What next step should we agree on?`,
 Improvements:knownIssues.length?`Recorded observations, for review:\n${knownIssues.join('\n')}`:'No verified audit issues are available. Start with discovery questions instead of claiming problems.',
 Package:`Provisional service: ${plan.service}. Scope, integrations, timeline and pricing require a discovery conversation; no performance or revenue guarantees are implied.`,
 Proposal:`Draft proposal for ${lead.business_name}\nObjective and scope: ${q.scope||'To be agreed'}\nTimeline: ${q.timing||'Not agreed'}\nClient-stated budget: ${q.budget||'Unknown'}\nConfirm deliverables, content, integrations, acceptance criteria, exclusions, support, price and payment terms before agreement.`,
 'Price objection':'We understand the budget matters. We can discuss the essential scope and phased delivery, with a written price for each phase. Which outcome is most important first?',
 'Timing objection':'Understood. Would you prefer us to stop following up, or agree on a later date? We will not schedule another follow-up without your agreement.',
 'Existing supplier':'It is good that you already have a provider. If a specific website or software need falls outside their scope, we can explore a complementary engagement. Is there a current requirement?',
 };
 const text=language==='ar'?(ar[kind]??ar['First contact']):(en[kind]??`${kind==='Email'?`Subject: A digital opportunity for ${lead.business_name}\n\n`:''}${enIntro}\n${variant==='B'?'Are you the right person for this conversation?':'May we share a short concept for your team?'}${profile.portfolio_url?'\nOur work: '+profile.portfolio_url:''}`);
 return {text,provider:'sector playbook',variant,service:plan.service,quality:quality.label,sector:categoryLabel(lead.category),city:cityLabel(lead.city)};
}
