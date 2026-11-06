import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { randomBytes, randomUUID, createHash, timingSafeEqual } from 'node:crypto';

export type DataRow = Record<string, unknown>;
const tables = ['profiles','lead_records','lead_sources','website_audits','lead_scores','lead_activities','follow_ups','sales_notes','search_jobs','api_usage','app_settings','ai_generations','sales_profiles'] as const;
const children = new Set(['lead_sources','website_audits','lead_scores','lead_activities','follow_ups','sales_notes','ai_generations']);
const leadDefaults = { website:'',email:'',phone:'',status:'New',notes:'',deal_value:0,do_not_contact:false,source_url:'',verification:'Unverified',score:0,score_reasons:[] };
const settingsDefaults = {daily_calls:0,daily_searches:0,max_results:10,monthly_budget:0,google_unit_cost:0,ai_unit_cost:0,enabled:false};
const digest=(value:string)=>createHash('sha256').update(value).digest('hex');

/** SQLite owns durable data; this adapter implements only the query subset used by our repositories. */
export class LocalStore {
    readonly sql: DatabaseSync;
    constructor(filename:string) {
        if(filename!==':memory:') mkdirSync(dirname(filename),{recursive:true});
        this.sql=new DatabaseSync(filename);
        this.sql.exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL;');
        this.sql.exec(`CREATE TABLE IF NOT EXISTS local_users(id TEXT PRIMARY KEY,email TEXT NOT NULL);
          CREATE TABLE IF NOT EXISTS local_sessions(token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES local_users(id),expires_at INTEGER NOT NULL);
          CREATE TABLE IF NOT EXISTS request_windows(owner_id TEXT NOT NULL REFERENCES local_users(id),bucket TEXT NOT NULL,calls INTEGER NOT NULL,PRIMARY KEY(owner_id,bucket));`);
        for(const table of tables) {
            this.sql.exec(`CREATE TABLE IF NOT EXISTS ${table} (
              id TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES local_users(id),
              lead_id TEXT, body TEXT NOT NULL CHECK(json_valid(body)), created_at TEXT NOT NULL,
              UNIQUE(id,owner_id)${children.has(table)?', FOREIGN KEY(lead_id,owner_id) REFERENCES lead_records(id,owner_id) ON DELETE CASCADE':''});
              CREATE INDEX IF NOT EXISTS ${table}_owner_created ON ${table}(owner_id,created_at);`);
        }
        this.sql.exec(`CREATE UNIQUE INDEX IF NOT EXISTS local_lead_dedupe ON lead_records(owner_id,lower(trim(json_extract(body,'$.business_name'))),lower(trim(json_extract(body,'$.city'))));
          CREATE UNIQUE INDEX IF NOT EXISTS local_settings_owner ON app_settings(owner_id);`);
        this.sql.exec('CREATE UNIQUE INDEX IF NOT EXISTS local_sales_profile_owner ON sales_profiles(owner_id);');
    }
    createUser(email='local@vexora.internal') {
        const existing=this.sql.prepare('SELECT id,email FROM local_users WHERE email=?').get(email);
        if(existing)return {id:String(existing.id),email:String(existing.email)};
        const user={id:randomUUID(),email};
        this.sql.prepare('INSERT INTO local_users(id,email) VALUES(?,?)').run(user.id,user.email);
        return user;
    }
    createSession(userId:string) {
        const token=randomBytes(32).toString('base64url');
        this.sql.prepare('DELETE FROM local_sessions WHERE expires_at<?').run(Date.now());
        this.sql.prepare('INSERT INTO local_sessions VALUES(?,?,?)').run(digest(token),userId,Date.now()+86400000);
        return token;
    }
    userForSession(token?:string) {
        if(!token)return null;
        const row=this.sql.prepare('SELECT u.id,u.email FROM local_sessions s JOIN local_users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?').get(digest(token),Date.now());
        return row?{id:String(row.id),email:String(row.email)}:null;
    }
    revokeSession(token:string){this.sql.prepare('DELETE FROM local_sessions WHERE token_hash=?').run(digest(token));}
    private table(table:string){if(!(tables as readonly string[]).includes(table))throw new Error('Unknown table');return table;}
    rows(table:string,owner:string):DataRow[]{
        return this.sql.prepare(`SELECT body FROM ${this.table(table)} WHERE owner_id=?`).all(owner).map(r=>JSON.parse(String(r.body)));
    }
    private write(table:string,row:DataRow,existing=false){
        this.sql.prepare(`INSERT INTO ${this.table(table)}(id,owner_id,lead_id,body,created_at) VALUES(?,?,?,?,?) ${existing?'ON CONFLICT(id) DO UPDATE SET body=excluded.body,lead_id=excluded.lead_id':''}`).run(String(row.id),String(row.owner_id),row.lead_id?String(row.lead_id):null,JSON.stringify(row),String(row.created_at));
    }
    transaction<T>(fn:()=>T):T{this.sql.exec('BEGIN IMMEDIATE');try{const value=fn();this.sql.exec('COMMIT');return value;}catch(e){this.sql.exec('ROLLBACK');throw e;}}
    mutate(table:string,owner:string,operation:string,values:DataRow[],filters:[string,unknown][],conflict?:string):DataRow[]{
        if(table==='api_usage')throw new Error('Usage reservations are read-only');
        return this.transaction(()=>{
            const all=this.rows(table,owner);
            const changed:DataRow[]=[];
            for(const input of values){
                if(input.owner_id&&input.owner_id!==owner)throw new Error('Ownership violation');
                if(table==='profiles'&&input.id&&input.id!==owner)throw new Error('Ownership violation');
                const matching=operation==='update'?all.filter(row=>filters.every(([k,v])=>row[k]===v)):operation==='upsert'?all.filter(row=>conflict==='owner_id'||row.id===input.id):[];
                if(operation==='update'&&!filters.length)throw new Error('Updates require a record filter');
                const targets=operation==='update'?matching:[matching[0]];
                for(const before of targets){
                    const now=new Date().toISOString();
                    const defaults=table==='lead_records'?leadDefaults:table==='app_settings'?settingsDefaults:table==='search_jobs'?{status:'pending',place_ids:[]}:children.has(table)?{payload:{},completed:false,due_at:null}:{};
                    const row={...defaults,...before,...input,id:before?.id??input.id??randomUUID(),owner_id:owner,created_at:before?.created_at??now,updated_at:now};
                    this.write(table,row,!!before);changed.push(row);
                    if(table==='lead_records')this.write('lead_activities',{id:randomUUID(),owner_id:owner,lead_id:row.id,created_at:now,payload:{action:before?'UPDATE':'INSERT',before:before??null,after:row}});
                }
            }
            return changed;
        });
    }
    rpc(name:string,owner:string){
        if(name==='usage_summary') {
            const now=new Date().toISOString();const usage=this.rows('api_usage',owner);const month=usage.filter(r=>String(r.created_at).slice(0,7)===now.slice(0,7));
            const settings=this.rows('app_settings',owner)[0];const groups=new Map<string,{provider:unknown;sku:unknown;requests:number}>();
            for(const row of month){const key=String(row.provider)+String(row.sku);const group=groups.get(key)??{provider:row.provider,sku:row.sku,requests:0};group.requests++;groups.set(key,group);}
            return {today:usage.filter(r=>String(r.created_at).slice(0,10)===now.slice(0,10)).length,month:month.length,cost:month.reduce((sum,r)=>sum+Number(r.estimated_cost),0),budget:Number(settings?.monthly_budget??0),by_sku:[...groups.values()]};
        }
        return this.transaction(()=>{
            const now=new Date().toISOString();
            if(name==='check_rate_limit'){
                const bucket=now.slice(0,16);
                const row=this.sql.prepare('SELECT calls FROM request_windows WHERE owner_id=? AND bucket=?').get(owner,bucket);
                if(Number(row?.calls??0)>=30)throw new Error('Rate limit reached');
                this.sql.prepare('INSERT INTO request_windows VALUES(?,?,1) ON CONFLICT(owner_id,bucket) DO UPDATE SET calls=calls+1').run(owner,bucket);
                this.sql.prepare('DELETE FROM request_windows WHERE bucket<?').run(now.slice(0,10));return null;
            }
            if(!['reserve_google_call','reserve_google_pro_call','reserve_ai_call'].includes(name))throw new Error('Unknown operation');
            const settings=this.rows('app_settings',owner)[0];
            if(!settings?.enabled)throw new Error('Provider usage disabled');
            const usage=this.rows('api_usage',owner);const today=usage.filter(r=>String(r.created_at).slice(0,10)===now.slice(0,10));
            const cost=usage.filter(r=>String(r.created_at).slice(0,7)===now.slice(0,7)).reduce((s,r)=>s+Number(r.estimated_cost),0);
            const google=name!=='reserve_ai_call';const unit=Number(settings[google?'google_unit_cost':'ai_unit_cost']);
            if(today.length>=Number(settings.daily_calls)||(google&&today.filter(r=>r.provider==='google').length>=Number(settings.daily_searches))||unit<=0||Number(settings.monthly_budget)<=0||cost+unit>Number(settings.monthly_budget))throw new Error('Configured usage limit reached');
            this.write('api_usage',{id:randomUUID(),owner_id:owner,provider:google?'google':'anthropic',sku:google?(name==='reserve_google_pro_call'?'Text Search Pro':'Text Search Essentials IDs Only'):'Messages reservation',estimated_cost:unit,created_at:now});return null;
        });
    }
    close(){this.sql.close();}
}

let instance:LocalStore|undefined;
export function localDirectory(){return join(process.cwd(),'.local-data');}
export function localStore(){return instance??=new LocalStore(join(localDirectory(),'vexora.sqlite'));}
export function launchToken(){const file=join(localDirectory(),'access-token');mkdirSync(dirname(file),{recursive:true});if(!existsSync(file))writeFileSync(file,randomBytes(32).toString('base64url'),{mode:0o600,flag:'wx'});return readFileSync(file,'utf8').trim();}
export function validLaunchToken(value:unknown){if(typeof value!=='string'||value.length>100)return false;const expected=digest(launchToken());return timingSafeEqual(Buffer.from(digest(value)),Buffer.from(expected));}
