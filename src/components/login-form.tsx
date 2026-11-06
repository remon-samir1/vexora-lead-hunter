'use client';
import {useEffect,useState} from 'react';
import {useRouter} from 'next/navigation';
export function LoginForm({local}:{local:boolean}){
 const router=useRouter();const [error,setError]=useState('');const [busy,setBusy]=useState(false);
 useEffect(()=>{
    if(!local)return;
    const token=new URLSearchParams(location.hash.slice(1)).get('access');
    if(!token)return;
    history.replaceState(null,'','/login');
    fetch('/api/auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({local_token:token})}).then(async r=>{const d=await r.json();if(!r.ok)throw new Error(d.error);router.replace('/dashboard');router.refresh();}).catch(e=>setError(e.message));
 },[local,router]);
 return <div className="login"><div><div className="eyebrow">VEXORA / LEAD HUNTER</div><h1>Your next opportunity<br/>starts here.</h1><p>A focused workspace for meaningful business connections.</p>{local?<div className="panel"><h2 style={{color:'#182439'}}>Private local workspace</h2><p>Your data is saved on this device. Open the private launch link provided by the local launcher to sign in.</p><p>No Supabase account or subscription is required.</p>{error&&<p className="error" role="alert">{error}</p>}</div>:<form onSubmit={async e=>{e.preventDefault();setBusy(true);setError('');try{const r=await fetch('/api/auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(Object.fromEntries(new FormData(e.currentTarget)))});const d=await r.json();if(!r.ok)throw new Error(d.error);router.replace('/dashboard');router.refresh();}catch(e){setError((e as Error).message);}finally{setBusy(false);}}}><h2>Welcome back</h2><label>Email<input name="email" type="email" required autoComplete="email"/></label><label>Password<input name="password" type="password" required minLength={8} autoComplete="current-password"/></label><button className="primary" disabled={busy}>{busy?'Signing in...':'Sign in to workspace'}</button>{error&&<p className="error" role="alert">{error}</p>}<small>Private access. Ask your administrator for an account.</small></form>}</div></div>;
}
