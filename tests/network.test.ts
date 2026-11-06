import { describe, it, expect, vi, beforeEach } from 'vitest';
vi.mock('node:dns/promises', () => ({ default: { lookup: vi.fn() } }));
vi.mock('undici', () => ({ Agent: class {
        close = vi.fn();
    }, fetch: vi.fn() }));
import dns from 'node:dns/promises';
import { fetch } from 'undici';
import { safeGet, permittedPage } from '../src/lib/safe-fetch';
beforeEach(() => vi.clearAllMocks());
describe('fetch safety', () => {
    it('rejects credentials and disallowed protocols before resolving', async () => { await expect(safeGet('https://user:pass@example.com')).rejects.toThrow(); await expect(safeGet('file:///etc/passwd')).rejects.toThrow(); expect(dns.lookup).not.toHaveBeenCalled(); });
    it('rejects mixed DNS answers without making a request', async () => { vi.mocked(dns.lookup).mockResolvedValue([{ address: '8.8.8.8', family: 4 }, { address: '127.0.0.1', family: 4 }] as never); await expect(safeGet('https://example.com')).rejects.toThrow('Private'); expect(fetch).not.toHaveBeenCalled(); });
    it('revalidates redirected addresses', async () => { vi.mocked(dns.lookup).mockResolvedValueOnce([{ address: '8.8.8.8', family: 4 }] as never).mockResolvedValueOnce([{ address: '169.254.169.254', family: 4 }] as never); vi.mocked(fetch).mockResolvedValue({ status: 302, headers: new Headers({ location: 'http://169.254.169.254/' }), body: { cancel: vi.fn() } } as never); await expect(safeGet('https://example.com')).rejects.toThrow('Private'); expect(fetch).toHaveBeenCalledTimes(1); });
    it('honors robots exclusion', async () => { vi.mocked(dns.lookup).mockResolvedValue([{ address: '8.8.8.8', family: 4 }] as never); const body = new ReadableStream({ start(c) { c.enqueue(new TextEncoder().encode('User-agent: *\nDisallow: /')); c.close(); } }); vi.mocked(fetch).mockResolvedValue({ status: 200, headers: new Headers(), body } as never); await expect(permittedPage('https://example.com/')).rejects.toThrow('robots'); expect(fetch).toHaveBeenCalledTimes(1); });
});
