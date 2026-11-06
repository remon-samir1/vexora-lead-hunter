import {leadSchema} from './schemas';
import {sectorFor} from './catalog';
const headerMap:Record<string,string>={'اسم الشركة':'business_name','المدينة':'city','النشاط':'category','الموقع':'website','الإيميل':'email','الهاتف':'phone','رابط المصدر':'source_url'};
export function parseCsv(text:string){
 if(Buffer.byteLength(text,'utf8')>524288)throw new Error('أقصى حجم للملف 512 كيلوبايت.');
 const rows:string[][]=[];let row:string[]=[];let cell='';let quoted=false;
 const source=text.replace(/^\uFEFF/,'');
 for(let i=0;i<source.length;i++){const c=source[i];if(c==='"'){if(quoted&&source[i+1]==='"'){cell+='"';i++;}else if(!quoted&&cell.length)throw new Error('تنسيق CSV غير صحيح.');else quoted=!quoted;}else if(c===','&&!quoted){row.push(cell);cell='';}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&source[i+1]==='\n')i++;row.push(cell);if(row.some(v=>v.trim()))rows.push(row);row=[];cell='';}else cell+=c;}
 if(quoted)throw new Error('يوجد حقل مقتبس غير مغلق.');row.push(cell);if(row.some(v=>v.trim()))rows.push(row);
 if(rows.length<2)throw new Error('الملف يحتاج صف عناوين وعميلًا واحدًا على الأقل.');if(rows.length>201)throw new Error('أقصى عدد 200 عميل في المرة الواحدة.');
 const headers=rows[0].map(x=>headerMap[x.trim()]??x.trim());if(new Set(headers).size!==headers.length)throw new Error('عناوين أعمدة مكررة.');for(const required of ['business_name','city','category'])if(!headers.includes(required))throw new Error('الأعمدة المطلوبة: business_name, city, category');
 return rows.slice(1).map((cells,index)=>{if(cells.length!==headers.length)throw new Error(`عدد أعمدة غير صحيح في الصف ${index+2}.`);const value=Object.fromEntries(headers.map((h,i)=>[h,cells[i].trim()]));const sector=sectorFor(value.category);return leadSchema.parse({business_name:value.business_name,city:value.city,category:sector?.id??value.category,website:value.website??'',email:value.email??'',phone:value.phone??'',source_url:value.source_url??'',status:value.status||'New',notes:value.notes??'',deal_value:0,do_not_contact:['true','yes','1','نعم'].includes((value.do_not_contact??'').toLowerCase())||value.status==='Not Interested',verification:'Unverified'});});
}
