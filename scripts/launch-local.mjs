import {spawn} from 'node:child_process';
import {existsSync} from 'node:fs';
import {launchToken} from '../src/lib/local-store.ts';
const port=3107;
if(existsSync('.env.local'))process.loadEnvFile('.env.local');
const environment={...process.env};
const local=environment.STORAGE_PROVIDER==='local'||(!environment.STORAGE_PROVIDER&&!environment.NEXT_PUBLIC_SUPABASE_URL&&!environment.NEXT_PUBLIC_SUPABASE_ANON_KEY);
if(!existsSync('.next/BUILD_ID')){
    const build=spawn(process.execPath,['node_modules/next/dist/bin/next','build'],{stdio:'inherit',env:environment,windowsHide:true});
    const code=await new Promise(resolve=>build.on('exit',resolve));
    if(code!==0)process.exit(Number(code??1));
}
const server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port',String(port)],{stdio:'inherit',env:environment,windowsHide:true});
let exited=false;server.on('exit',()=>{exited=true;});
for(let i=0;i<60;i++){
    if(exited)process.exit(1);
    try{const r=await fetch(`http://127.0.0.1:${port}/login`);if(r.ok)break;}catch{}
    await new Promise(resolve=>setTimeout(resolve,500));
}
// Fragment keeps the device credential out of HTTP request URLs and referrers.
const url=local?`http://127.0.0.1:${port}/login#access=${launchToken()}`:`http://127.0.0.1:${port}/login`;
if(process.platform==='win32')spawn('powershell.exe',['-NoProfile','-Command',`Start-Process '${url}' -WindowStyle Hidden`],{stdio:'ignore',windowsHide:true});
else console.log('Use the trusted local launcher integration to open this workspace.');
process.on('SIGINT',()=>server.kill());
