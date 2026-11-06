import {localMode} from '@/lib/storage-mode';
import {LoginForm} from '@/components/login-form';
export const dynamic='force-dynamic';
export default function Login(){return <LoginForm local={localMode()}/>;}
