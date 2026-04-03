'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { Eye, EyeOff, Lock, Mail, AlertCircle } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError('Email ou senha inválidos. Verifique suas credenciais e tente novamente.');
        setLoading(false);
      } else if (result?.ok) {
        router.push('/dashboard');
        router.refresh();
      } else {
        setError('Erro ao entrar. Tente novamente.');
        setLoading(false);
      }
    } catch {
      setError('Erro de conexão. Tente novamente.');
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', backgroundColor: '#F8F8F8' }}>
      {/* Left side - branding */}
      <div
        style={{
          display: 'none',
          flex: 1,
          background: 'linear-gradient(135deg, #0A2E50 0%, #1E6BB8 100%)',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          padding: '3rem',
          gap: '2rem',
        }}
        className="md-flex"
      >
        <style>{`
          @media (min-width: 768px) { .md-flex { display: flex !important; } }
        `}</style>
        <Image src="/logo.png" alt="Fundamenta Leilões" width={200} height={200} style={{ objectFit: 'contain', filter: 'brightness(0) invert(1)' }} />
        <div style={{ textAlign: 'center', color: 'white' }}>
          <h1 style={{ fontFamily: 'var(--font-montserrat, Montserrat, sans-serif)', fontSize: '2rem', fontWeight: 700, margin: '0 0 1rem' }}>
            Fundamenta Leilões
          </h1>
          <p style={{ fontSize: '1.1rem', opacity: 0.85, maxWidth: '400px', lineHeight: 1.6 }}>
            Inteligência de mercado para investidores em leilões de imóveis no Brasil.
          </p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem', width: '100%', maxWidth: '360px' }}>
          {[
            { icon: '🔍', text: 'Análise de documentos por IA' },
            { icon: '📊', text: 'Calculadora financeira avançada' },
            { icon: '🗺️', text: 'Mapa interativo de oportunidades' },
            { icon: '📁', text: 'Diário do arrematante completo' },
          ].map((item) => (
            <div key={item.text} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'rgba(255,255,255,0.9)' }}>
              <span style={{ fontSize: '1.25rem' }}>{item.icon}</span>
              <span style={{ fontSize: '0.95rem' }}>{item.text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Right side - form */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
        <div style={{ width: '100%', maxWidth: '420px' }}>
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <Image
              src="/logo.png"
              alt="Fundamenta Leilões"
              width={120}
              height={120}
              style={{ objectFit: 'contain', marginBottom: '1rem' }}
            />
            <h2 style={{ fontFamily: 'var(--font-montserrat, Montserrat, sans-serif)', fontSize: '1.5rem', fontWeight: 700, color: '#0A2E50', margin: '0 0 0.5rem' }}>
              Bem-vindo de volta
            </h2>
            <p style={{ color: '#666', fontSize: '0.9rem', margin: 0 }}>
              Entre com sua conta para continuar
            </p>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {error && (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', padding: '0.875rem', backgroundColor: 'rgba(231, 76, 60, 0.1)', border: '1px solid rgba(231, 76, 60, 0.3)', borderRadius: '8px', color: '#c0392b', fontSize: '0.875rem' }}>
                <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.875rem', color: '#0A2E50' }}>
                Email
              </label>
              <div style={{ position: 'relative' }}>
                <Mail size={16} style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', color: '#999' }} />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com.br"
                  required
                  className="input-field"
                  style={{ paddingLeft: '2.5rem' }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.875rem', color: '#0A2E50' }}>
                Senha
              </label>
              <div style={{ position: 'relative' }}>
                <Lock size={16} style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', color: '#999' }} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="input-field"
                  style={{ paddingLeft: '2.5rem', paddingRight: '2.75rem' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{ position: 'absolute', right: '0.875rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#999', padding: 0 }}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary"
              style={{ justifyContent: 'center', width: '100%', opacity: loading ? 0.7 : 1, cursor: loading ? 'not-allowed' : 'pointer' }}
            >
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>

          <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
            <p style={{ color: '#666', fontSize: '0.875rem', margin: 0 }}>
              Não tem uma conta?{' '}
              <Link href="/auth/register" style={{ color: '#1E6BB8', fontWeight: 600, textDecoration: 'none' }}>
                Cadastre-se grátis
              </Link>
            </p>
          </div>

        </div>
      </div>
    </div>
  );
}
