import { load } from 'cheerio';
import { permittedPage } from './safe-fetch';
import type { Check } from './scoring';
export async function auditWebsite(url: string) {
    const page = await permittedPage(url);
    const $ = load(page.body);
    const text = $('body').text();
    const check = (key: string, passed: boolean | null, evidence: string): Check => ({ key, passed, evidence });
    return [check('available', page.status < 400, `HTTP ${page.status}`), check('https', page.url.startsWith('https:'), page.url), check('mobile', $('meta[name="viewport"]').length > 0, 'Viewport meta presence; visual mobile usability requires manual review'), check('seo', Boolean($('title').text().trim() && $('meta[name="description"]').attr('content')), 'Title: ' + $('title').text().slice(0, 200)), check('arabic', /[\u0600-\u06ff]/.test(text), 'Arabic characters in retrieved HTML'), check('english', /[a-zA-Z]{4}/.test(text), 'Latin text in retrieved HTML'), check('portfolio', null, 'Portfolio quality requires manual review'), check('services', null, 'Service clarity requires manual review'), check('contact', $('a[href^="mailto:"],a[href^="tel:"],a[href*="wa.me"],a[href*="contact"]').length > 0, 'Contact links in HTML'), check('form', $('form').length > 0, 'HTML form presence'), check('whatsapp', $('a[href*="wa.me"],a[href*="api.whatsapp.com"]').length > 0, 'WhatsApp link presence'), check('navigation', null, 'Navigation usability requires browser review'), check('performance', null, 'No performance measurement provider configured')];
}
