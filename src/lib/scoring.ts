export type Check = {
    key: string;
    passed: boolean | null;
    evidence: string;
};
export function score(website: string, checks: Check[]) {
    const weights: Record<string, number> = { available: 25, mobile: 15, portfolio: 10, contact: 10, arabic: 5, seo: 5 };
    const reasons: string[] = [];
    let value = 0;
    if (!website && checks.some(c=>c.key==='website_absent'&&c.passed===false&&c.evidence.trim().length>=5)) {
        value += 30;
        reasons.push('غياب موقع رسمي مؤكد بمصدر أو مراجعة موثقة (+30)');
    }
    for (const c of checks)
        if (c.passed === false && weights[c.key]) {
            value += weights[c.key];
            reasons.push(`${c.key}: ${c.evidence} (+${weights[c.key]})`);
        }
    return { score: Math.min(100, value), reasons, category: value >= 75 ? 'Hot' : value >= 45 ? 'Warm' : 'Cold' };
}
export function csvCell(value: unknown) { const s = String(value ?? ''); return '"' + (/^[\s]*[=+@\-\t\r]/.test(s) ? "'" : '') + s.replaceAll('"', '""') + '"'; }
