import { z } from 'zod';
import {sectors} from './catalog';
import type {Qualification,assess} from './qualification';
export const statuses = ['New', 'Qualified', 'Contacted', 'Replied', 'Meeting Scheduled', 'Proposal Sent', 'Negotiation', 'Won', 'Lost', 'Not Interested'] as const;
export const categories:string[] = sectors.map(s=>s.id);
export const leadSchema = z.object({ business_name: z.string().trim().min(2).max(200), city: z.string().trim().min(2).max(100), category: z.string().min(2).max(100), website: z.union([z.url().refine(v => /^https?:\/\//i.test(v)), z.literal('')]), email: z.union([z.email(), z.literal('')]), phone: z.string().max(30), status: z.enum(statuses), notes: z.string().max(10000), deal_value: z.coerce.number().min(0).max(1e9), do_not_contact: z.boolean(), source_url: z.union([z.url().refine(v => /^https?:\/\//i.test(v)), z.literal('')]), verification: z.enum(['Verified', 'Unverified', 'Not found']) });
export type Lead = z.infer<typeof leadSchema> & {
    id: string;
    created_at: string;
    score: number;
    score_reasons: string[];
    qualification?:Qualification;
    quality?:ReturnType<typeof assess>;
    qualification_updated_at?:unknown;
};
export const searchSchema = z.object({ city: z.string().trim().min(2).max(100), category: z.string().trim().min(2).max(100), keywords: z.string().trim().max(200),specialty:z.string().max(100).default(''),district:z.string().max(100).default(''), maximum: z.coerce.number().int().min(1).max(20),mode:z.enum(['ids','preview']).default('ids'),approved_pro:z.boolean().default(false) }).refine(v=>v.mode!=='preview'||v.approved_pro,{message:'وافق على مستوى Text Search Pro قبل طلب الأسماء والعناوين',path:['approved_pro']});
export const settingsSchema = z.object({ daily_calls: z.coerce.number().int().min(0).max(1000), daily_searches: z.coerce.number().int().min(0).max(1000), max_results: z.coerce.number().int().min(1).max(20), monthly_budget: z.coerce.number().min(0).max(10000), google_unit_cost: z.coerce.number().min(0).max(100), ai_unit_cost: z.coerce.number().min(0).max(100).default(0), enabled: z.boolean() });
