import { Workspace } from '@/components/workspace';
import { notFound } from 'next/navigation';
export default async function Page({ params }: {
    params: Promise<{
        page: string[];
    }>;
}) { const { page } = await params; if (!['dashboard', 'leads', 'discover', 'audits', 'follow-ups', 'analytics', 'settings'].includes(page[0]) || page.length > 2)
    notFound(); return <Workspace path={page}/>; }
