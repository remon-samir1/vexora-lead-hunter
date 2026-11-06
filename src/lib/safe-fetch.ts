import dns from 'node:dns/promises';
import ipaddr from 'ipaddr.js';
import { Agent, fetch } from 'undici';
import robotsParser from 'robots-parser';
export function publicAddress(address: string) { try {
    let ip = ipaddr.parse(address);
    if (ip.kind() === 'ipv6' && (ip as ipaddr.IPv6).isIPv4MappedAddress())
        ip = (ip as ipaddr.IPv6).toIPv4Address();
    return ip.range() === 'unicast';
}
catch {
    return false;
} }
export async function safeGet(input: string, depth = 0): Promise<{
    body: string;
    status: number;
    url: string;
}> {
    const url = new URL(input);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || (url.port && !['80', '443'].includes(url.port)) || depth > 3)
        throw new Error('URL is not permitted');
    const host = url.hostname.replace(/^\[|\]$/g, '');
    const addresses = await dns.lookup(host, { all: true });
    if (!addresses.length || addresses.some(a => !publicAddress(a.address)))
        throw new Error('Private or reserved network address blocked');
    const selected = addresses[0];
    const agent = new Agent({ connect: { lookup: (_hostname, options, callback) => { if (options.all)
                callback(null, [selected]);
            else
                callback(null, selected.address, selected.family); } } });
    try {
        const res = await fetch(url, { dispatcher: agent, redirect: 'manual', signal: AbortSignal.timeout(12000), headers: { 'User-Agent': 'VexoraAudit/1.0' } });
        if (res.status >= 300 && res.status < 400) {
            const location = res.headers.get('location');
            await res.body?.cancel();
            if (!location)
                throw new Error('Invalid redirect');
            return await safeGet(new URL(location, url).href, depth + 1);
        }
        const reader = res.body?.getReader();
        let body = '';
        let size = 0;
        if (reader) {
            while (true) {
                const chunk = await reader.read();
                if (chunk.done)
                    break;
                size += chunk.value.length;
                if (size > 1500000) {
                    await reader.cancel();
                    throw new Error('Page exceeds audit size limit');
                }
                body += Buffer.from(chunk.value).toString('utf8');
            }
        }
        return { body, status: res.status, url: url.href };
    }
    finally {
        await agent.close();
    }
}
export async function permittedPage(input: string) { const url = new URL(input); const robots = await safeGet(new URL('/robots.txt', url).href); if (robots.status !== 404 && (robots.status !== 200 || robotsParser(new URL('/robots.txt', url).href, robots.body).isAllowed(url.href, 'VexoraAudit') === false))
    throw new Error('Audit not permitted by robots policy'); return safeGet(url.href); }
