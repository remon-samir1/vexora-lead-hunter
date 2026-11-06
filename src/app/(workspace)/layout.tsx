import { configured } from '@/lib/supabase';
import { Shell } from '@/components/shell';

export default function Layout({ children }: { children: React.ReactNode }) {
    return <Shell configured={configured()}>{children}</Shell>;
}
