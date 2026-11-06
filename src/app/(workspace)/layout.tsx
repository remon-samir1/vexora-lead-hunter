import { configured, session } from '@/lib/supabase';
import { Shell } from '@/components/shell';
export default async function Layout({ children }: {
    children: React.ReactNode;
}) { let email = 'Configuration required'; if (configured()) {
    const { user } = await session();
    email = user.email ?? '';
} return <Shell email={email} configured={configured()}>{children}</Shell>; }
