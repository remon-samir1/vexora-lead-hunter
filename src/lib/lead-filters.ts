import type {Lead} from './schemas';
import {categoryLabel,cityLabel} from './catalog';
import {emptyQualification,recommend} from './qualification';
export type LeadFilters={city:string;category:string;website:string;verified:boolean;coverage:number;priority:string;service:string;excludeOptouts:boolean;type:string};
export const emptyFilters:LeadFilters={city:'',category:'',website:'',verified:false,coverage:0,priority:'',service:'',excludeOptouts:false,type:''};
export function matchesLead(lead:Lead,filters:LeadFilters){const q=lead.qualification??emptyQualification();
 if(filters.city&&cityLabel(lead.city)!==filters.city)return false;
 if(filters.category&&categoryLabel(lead.category)!==filters.category)return false;
 if(filters.website==='present'&&!lead.website)return false;
 if(filters.website==='unknown'&&(lead.website||q.website_state==='confirmed_absent'))return false;
 if(filters.website==='absent'&&q.website_state!=='confirmed_absent')return false;
 if(filters.verified&&(lead.verification!=='Verified'||(!lead.email&&!lead.phone)))return false;
 if((lead.quality?.coverage??0)<filters.coverage)return false;
 if(filters.priority&&lead.quality?.label!==filters.priority)return false;
 if(filters.service&&recommend(lead.category,q).service!==filters.service)return false;
 if(filters.excludeOptouts&&(lead.do_not_contact||lead.status==='Not Interested'||q.excluded||q.interest==='no'))return false;
 if(filters.type&&q.company_type!==filters.type)return false;
 return true;
}
