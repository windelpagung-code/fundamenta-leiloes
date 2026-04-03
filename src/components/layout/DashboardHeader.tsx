'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { Home, BarChart2, BookOpen, User, LogOut, Bell, Settings } from 'lucide-react';

interface DashboardHeaderProps {
  user?: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
  role?: string;
}

const tabs = [
  { href: '/dashboard', label: 'Oportunidades', icon: Home },
  { href: '/dashboard/analise', label: 'Análise Especialista', icon: BarChart2 },
  { href: '/dashboard/diario', label: 'Arrematações', icon: BookOpen },
  { href: '/dashboard/perfil', label: 'Perfil', icon: User },
];

export default function DashboardHeader({ user, role }: DashboardHeaderProps) {
  const pathname = usePathname();

  return (
    <header
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        backgroundColor: '#0A2E50',
        boxShadow: '0 2px 12px rgba(0,0,0,0.2)',
      }}
    >
      <div
        style={{
          maxWidth: '1400px',
          margin: '0 auto',
          padding: '0 1.5rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: '64px',
        }}
      >
        {/* Logo */}
        <Link href="/dashboard" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', textDecoration: 'none' }}>
          <Image src="/logo.png" alt="Fundamenta" width={36} height={36} style={{ objectFit: 'contain', filter: 'brightness(0) invert(1)' }} />
          <span
            style={{
              fontFamily: 'var(--font-montserrat, Montserrat, sans-serif)',
              fontWeight: 700,
              fontSize: '1.1rem',
              color: 'white',
              display: 'none',
            }}
            className="logo-text"
          >
            Fundamenta Leilões
          </span>
          <style>{`@media(min-width:640px){.logo-text{display:block!important}}`}</style>
        </Link>

        {/* Desktop navigation */}
        <nav style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }} className="desktop-nav">
          <style>{`
            .desktop-nav { display: none; }
            @media(min-width:768px){ .desktop-nav { display: flex !important; } }
          `}</style>
          {tabs.map((tab) => {
            const isActive = tab.href === '/dashboard'
              ? pathname === '/dashboard'
              : pathname.startsWith(tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.5rem 1rem',
                  borderRadius: '8px',
                  textDecoration: 'none',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  fontFamily: 'var(--font-montserrat, Montserrat, sans-serif)',
                  transition: 'all 0.2s',
                  color: isActive ? '#0A2E50' : 'rgba(255,255,255,0.8)',
                  backgroundColor: isActive ? 'rgba(255,255,255,0.95)' : 'transparent',
                }}
              >
                <tab.icon size={16} />
                {tab.label}
              </Link>
            );
          })}
        </nav>

        {/* Right side actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {role === 'ADMIN' && (
            <Link
              href="/gestao"
              style={{
                display: 'flex', alignItems: 'center', gap: '0.4rem',
                padding: '0.4rem 0.75rem', borderRadius: '7px',
                backgroundColor: '#FFD700', color: '#0A2E50',
                fontWeight: 700, fontSize: '0.75rem',
                textDecoration: 'none',
                fontFamily: 'var(--font-montserrat, Montserrat, sans-serif)',
              }}
              title="Área de Gestão"
            >
              <Settings size={14} />
              <span>Gestão</span>
            </Link>
          )}
          <button
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.8)', padding: '0.5rem', borderRadius: '50%', transition: 'background 0.2s' }}
            title="Notificações"
          >
            <Bell size={20} />
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '50%',
                backgroundColor: '#1E6BB8',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontWeight: 700,
                fontSize: '0.875rem',
                fontFamily: 'var(--font-montserrat, Montserrat, sans-serif)',
              }}
            >
              {user?.name?.charAt(0).toUpperCase() || 'U'}
            </div>
            <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: '0.875rem', display: 'none' }} className="user-name">
              {user?.name?.split(' ')[0]}
            </span>
            <style>{`@media(min-width:640px){.user-name{display:block!important}}`}</style>
          </div>

          <button
            onClick={() => signOut({ callbackUrl: '/auth/login' })}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.7)', padding: '0.5rem', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.8rem', transition: 'color 0.2s' }}
            title="Sair"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>

      {/* Mobile bottom navigation */}
      <style>{`
        .mobile-nav { display: flex; }
        @media(min-width:768px){ .mobile-nav { display: none !important; } }
      `}</style>
      <nav
        className="mobile-nav"
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: '#0A2E50',
          borderTop: '1px solid rgba(255,255,255,0.1)',
          padding: '0.5rem 0',
          zIndex: 100,
          justifyContent: 'space-around',
        }}
      >
        {tabs.map((tab) => {
          const isActive = tab.href === '/dashboard'
            ? pathname === '/dashboard'
            : pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '0.25rem',
                padding: '0.5rem 1rem',
                textDecoration: 'none',
                color: isActive ? '#FFD700' : 'rgba(255,255,255,0.6)',
                fontSize: '0.7rem',
                fontWeight: 600,
              }}
            >
              <tab.icon size={20} />
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
