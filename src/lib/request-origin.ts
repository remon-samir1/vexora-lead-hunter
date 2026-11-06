type OriginRequest = { headers: Headers; nextUrl: { protocol: string } };

/** Compare against the browser-facing Host, not Next's normalized internal URL. */
export function isSameOrigin(request: OriginRequest, appOrigin = process.env.APP_ORIGIN): boolean {
    const origin = request.headers.get('origin');
    if (!origin || request.headers.get('sec-fetch-site') === 'cross-site') return false;
    try {
        const supplied = new URL(origin);
        if (!['http:', 'https:'].includes(supplied.protocol) || supplied.origin !== origin) return false;
        if (appOrigin) {
            const configured = new URL(appOrigin);
            return configured.origin === supplied.origin;
        }
        const host = request.headers.get('host');
        if (!host || /[\s,/@\\?#]/.test(host)) return false;
        const expected = new URL(`${request.nextUrl.protocol}//${host}`);
        return expected.origin === supplied.origin;
    } catch {
        return false;
    }
}
