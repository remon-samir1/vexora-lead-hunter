export function localMode() {
    if (process.env.STORAGE_PROVIDER) return process.env.STORAGE_PROVIDER === 'local';
    return !process.env.NEXT_PUBLIC_SUPABASE_URL && !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
}
export function localHost(host: string | null) {
    return !!host && /^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/.test(host.toLowerCase());
}
