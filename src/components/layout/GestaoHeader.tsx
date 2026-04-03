'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { LayoutDashboard, Upload, PlusSquare, LogOut, ExternalLink, Tag, Globe } from 'lucide-react';

interface GestaoHeaderProps {
  user?: {
    name?: string | null;
    email?: string | null;
  };
}

const tabs = [
  { href: '/gestao', label: 'Painel', icon: LayoutDashboard },
  { href: '/gestao/importar', label: 'CSV Caixa', icon: Upload },
  { href: '/gestao/importar-site', label: 'Importar Site', icon: Globe },
  { href: '/gestao/imoveis/novo', label: 'Novo Imóvel', icon: PlusSquare },
  { href: '/gestao/campanhas', label: 'Grupos', icon: Tag },
];

export default function GestaoHeader({ user }: GestaoHeaderProps) {
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
        boxShadow: '0 2px 12px rgba(0,0,0,0.25)',
        borderBottom: '3px solid #FFD700',
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
        {/* Logo + badge */}
        <Link href="/gestao" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', textDecoration: 'none' }}>
          <Image src="/logo.png" alt="Fundamenta" width={32} height={32} style={{ objectFit: 'contain', filter: 'brightness(0) invert(1)' }} />
          <span
            style={{
              fontFamily: 'var(--font-montserrat, Montserrat, sans-serif)',
              fontWeight: 700,
              fontSize: '1rem',
              color: 'white',
            }}
          >
            Fundamenta
          </span>
          <span
            style={{
              backgroundColor: '#FFD700',
              color: '#0A2E50',
              fontSize: '0.65rem',
              fontWeight: 800,
              padding: '0.15rem 0.45rem',
              borderRadius: '4px',
              letterSpacing: '0.05em',
              fontFamily: 'var(--font-montserrat, Montserrat, sans-serif)',
            }}
          >
            GESTÃO
          </span>
        </Link>

        {/* Navigation */}
        <nav style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
          {tabs.map((tab) => {
            const isActive = tab.href === '/gestao'
              ? pathname === '/gestao'
              : pathname.startsWith(tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '0.45rem 0.875rem',
                  borderRadius: '7px',
                  textDecoration: 'none',
                  fontSize: '0.825rem',
                  fontWeight: 600,
                  fontFamily: 'var(--font-montserrat, Montserrat, sans-serif)',
                  color: isActive ? '#0A2E50' : 'rgba(255,255,255,0.8)',
                  backgroundColor: isActive ? '#FFD700' : 'transparent',
                  transition: 'all 0.15s',
                }}
              >
                <tab.icon size={15} />
                <span style={{ display: 'none' }} className="nav-label">{tab.label}</span>
                <style>{`@media(min-width:640px){.nav-label{display:inline!important}}`}</style>
              </Link>
            );
          })}
        </nav>

        {/* Right side */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Link
            href="/dashboard"
            style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'rgba(255,255,255,0.7)', fontSize: '0.78rem', fontWeight: 600, textDecoration: 'none', padding: '0.4rem 0.7rem', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.2)' }}
            title="Ver Dashboard do usuário"
          >
            <ExternalLink size={14} />
            <span style={{ display: 'none' }} className="dash-label">Dashboard</span>
            <style>{`@media(min-width:768px){.dash-label{display:inline!important}}`}</style>
          </Link>

          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              backgroundColor: '#FFD700',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#0A2E50',
              fontWeight: 800,
              fontSize: '0.825rem',
              fontFamily: 'var(--font-montserrat, Montserrat, sans-serif)',
            }}
            title={user?.name || 'Admin'}
          >
            {user?.name?.charAt(0).toUpperCase() || 'A'}
          </div>

          <button
            onClick={() => signOut({ callbackUrl: '/auth/login' })}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.6)', padding: '0.4rem', borderRadius: '6px', display: 'flex', alignItems: 'center' }}
            title="Sair"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </header>
  );
}
