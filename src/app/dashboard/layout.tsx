import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import DashboardHeader from '@/components/layout/DashboardHeader';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect('/auth/login');

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#F8F8F8', display: 'flex', flexDirection: 'column' }}>
      <DashboardHeader user={session.user} role={session.user.role} />
      <main style={{ flex: 1, paddingTop: '80px' }}>
        {children}
      </main>
    </div>
  );
}
