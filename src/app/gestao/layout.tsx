import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import GestaoHeader from '@/components/layout/GestaoHeader';

export default async function GestaoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect('/auth/login');
  if (session.user.role !== 'ADMIN') redirect('/dashboard');

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#F0F4F8', display: 'flex', flexDirection: 'column' }}>
      <GestaoHeader user={session.user} />
      <main style={{ flex: 1, paddingTop: '64px' }}>
        {children}
      </main>
    </div>
  );
}
