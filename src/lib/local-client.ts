import type {SupabaseClient} from '@supabase/supabase-js';
import {localStore,type LocalStore,type DataRow} from './local-store';

type Result={data:unknown;error:null|{message:string;code?:string}};
class Query implements PromiseLike<Result>{
    private operation='select';private values:DataRow[]=[];private filters:[string,unknown][]=[];private orders:{key:string;ascending:boolean}[]=[];private start=0;private count=Infinity;private cardinality='many';private fields='*';private conflict?:string;
    constructor(private store:LocalStore,private table:string,private owner:string|null){}
    select(fields='*'){this.fields=fields;return this;}
    insert(values:DataRow|DataRow[]){this.operation='insert';this.values=Array.isArray(values)?values:[values];return this;}
    update(values:DataRow){this.operation='update';this.values=[values];return this;}
    upsert(values:DataRow,options?:{onConflict?:string}){this.operation='upsert';this.values=[values];this.conflict=options?.onConflict;return this;}
    eq(key:string,value:unknown){this.filters.push([key,value]);return this;}
    order(key:string,options?:{ascending?:boolean}){this.orders.push({key,ascending:options?.ascending!==false});return this;}
    range(start:number,end:number){this.start=start;this.count=end-start+1;return this;}
    limit(count:number){this.count=count;return this;}
    single(){this.cardinality='one';return this;}
    maybeSingle(){this.cardinality='optional';return this;}
    private execute():Result{
        try{
            if(!this.owner)throw new Error('Authentication required');
            let rows=this.operation==='select'?this.store.rows(this.table,this.owner).filter(r=>this.filters.every(([k,v])=>r[k]===v)):this.store.mutate(this.table,this.owner,this.operation,this.values,this.filters,this.conflict);
            rows.sort((a,b)=>{for(const order of this.orders){const cmp=String(a[order.key]??'').localeCompare(String(b[order.key]??''));if(cmp)return order.ascending?cmp:-cmp;}return 0;});rows=rows.slice(this.start,Number.isFinite(this.count)?this.start+this.count:undefined);
            if(this.fields.includes('lead_records(')){const leads=this.store.rows('lead_records',this.owner);rows=rows.map(r=>({...r,lead_records:leads.find(l=>l.id===r.lead_id)?{business_name:leads.find(l=>l.id===r.lead_id)!.business_name}:null}));}
            if(this.cardinality==='one'&&rows.length!==1)throw new Error('Expected one record');
            if(this.cardinality==='optional'&&rows.length>1)throw new Error('Expected at most one record');
            return {data:this.cardinality==='many'?rows:rows[0]??null,error:null};
        }catch(e){const message=(e as Error).message;return {data:null,error:{message,code:message.includes('UNIQUE constraint')?'23505':undefined}};}
    }
    then<T=Result,U=never>(resolve?:((value:Result)=>T|PromiseLike<T>)|null,reject?:((reason:unknown)=>U|PromiseLike<U>)|null):PromiseLike<T|U>{return Promise.resolve(this.execute()).then(resolve,reject);}
}
export function localClient(token?:string,store=localStore()):SupabaseClient{
    const user=store.userForSession(token);
    const client={
        from:(table:string)=>new Query(store,table,user?.id??null),
        rpc:async(name:string)=>{try{if(!user)throw new Error('Authentication required');return {data:store.rpc(name,user.id),error:null};}catch(e){return {data:null,error:{message:(e as Error).message}};}},
        auth:{getUser:async()=>({data:{user},error:null}),signOut:async()=>{if(token)store.revokeSession(token);return {error:null};}},
    };
    // Compatibility boundary, deliberately restricted to the server query methods above.
    return client as unknown as SupabaseClient;
}
