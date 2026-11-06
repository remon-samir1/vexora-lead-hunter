import {describe,it,expect} from 'vitest';
import {isSameOrigin} from '../src/lib/request-origin';
const request=(origin:string|null,host='127.0.0.1:3107',extra:Record<string,string>={})=>({headers:new Headers({...origin?{origin}:{},host,...extra}),nextUrl:{protocol:'http:'}});
describe('same-origin mutation protection',()=>{
    it('accepts the actual loopback host even when Next normalizes the internal hostname',()=>expect(isSameOrigin(request('http://127.0.0.1:3107'))).toBe(true));
    it('accepts localhost when it is the requested host',()=>expect(isSameOrigin(request('http://localhost:3107','localhost:3107'))).toBe(true));
    it.each([null,'null','https://example.com','http://localhost:3107','http://127.0.0.1:9999','https://127.0.0.1:3107','http://127.0.0.1:3107/path'])('rejects mismatching or malformed origin %s',origin=>expect(isSameOrigin(request(origin))).toBe(false));
    it('rejects browser-reported cross-site requests',()=>expect(isSameOrigin(request('http://127.0.0.1:3107','127.0.0.1:3107',{'sec-fetch-site':'cross-site'}))).toBe(false));
    it('does not trust attacker-controlled forwarded headers',()=>expect(isSameOrigin(request('https://attacker.example','127.0.0.1:3107',{'x-forwarded-host':'attacker.example','x-forwarded-proto':'https'}))).toBe(false));
    it('supports an explicitly configured HTTPS origin behind a reverse proxy',()=>{expect(isSameOrigin(request('https://crm.example.com','internal:3000'),'https://crm.example.com')).toBe(true);expect(isSameOrigin(request('https://attacker.example','internal:3000'),'https://crm.example.com')).toBe(false);});
    it('fails closed on malformed configuration',()=>expect(isSameOrigin(request('http://127.0.0.1:3107'),'invalid')).toBe(false));
});
