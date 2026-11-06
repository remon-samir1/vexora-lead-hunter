import { load } from 'cheerio';
import { permittedPage } from './safe-fetch';
export async function enrich(url: string) {
    const page = await permittedPage(url);
    if (page.status >= 400)
        throw new Error('Official website unavailable');
    const $ = load(page.body);
    const values: {
        field: string;
        value: string;
        source_url: string;
        source_type: string;
        verification: string;
        discovered_at: string;
    }[] = [];
    $('a[href]').each((_, a) => { const href = $(a).attr('href') ?? ''; let field = ''; let value = ''; if (href.startsWith('mailto:')) {
        field = 'email';
        value = href.slice(7).split('?')[0];
    }
    else if (href.startsWith('tel:')) {
        field = 'phone';
        value = href.slice(4);
    }
    else {
        try {
            const target = new URL(href, page.url);
            if (!['https:', 'http:'].includes(target.protocol))
                return;
            const host = target.hostname.toLowerCase();
            field = host === 'wa.me' || host === 'api.whatsapp.com' ? 'whatsapp' : host === 'instagram.com' || host === 'www.instagram.com' ? 'instagram' : host === 'linkedin.com' || host === 'www.linkedin.com' ? 'linkedin' : host === 'facebook.com' || host === 'www.facebook.com' ? 'facebook' : '';
            value = target.href;
        }
        catch {
            return;
        }
    } if (field && value && !values.some(v => v.field === field && v.value === value))
        values.push({ field, value, source_url: page.url, source_type: 'official website', verification: 'Unverified', discovered_at: new Date().toISOString() }); });
    return values.slice(0, 30);
}
