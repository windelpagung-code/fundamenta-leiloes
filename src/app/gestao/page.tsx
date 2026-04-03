'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Upload, PlusSquare, BarChart2, Database, ExternalLink, Tag, Globe } from 'lucide-react';
import { getProperties, getImportMeta, getCampaigns } from '@/lib/propertyStorage';

export default function GestaoDashboard() {
  const [totalProps, setTotalProps] = useState(0);
  const [totalCampaigns, setTotalCampaigns] = useState(0);
  const [lastImport, setLastImport] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getProperties(), getImportMeta(), getCampaigns()]).then(([props, meta, campaigns]) => {
      setTotalProps(props.length);
      setTotalCampaigns(campaigns.length);
      if (meta.importedAt) setLastImport(new Date(meta.importedAt).toLocaleString('pt-BR'));
    }).finally(() => setLoading(false));
  }, []);

  const cards = [
    {
      title: 'Importar CSV da Caixa',
      description: 'Importe a lista oficial de imóveis da Caixa Econômica Federal via URL ou upload de arquivo.',
      href: '/gestao/importar',
      icon: Upload,
      color: '#1E6BB8',
      bg: 'rgba(30,107,184,0.08)',
    },
    {
      title: 'Importar de Site de Leilões',
      description: 'Cole a URL de uma página do Portal ZUK (e outros em breve) para extrair imóveis automaticamente.',
      href: '/gestao/importar-site',
      icon: Globe,
      color: '#8B5CF6',
      bg: 'rgba(139,92,246,0.08)',
    },
    {
      title: 'Cadastrar Imóvel Manualmente',
      description: 'Adicione imóveis de qualquer banco, leiloeiro ou fonte, preenchendo os dados manualmente.',
      href: '/gestao/imoveis/novo',
      icon: PlusSquare,
      color: '#2ECC71',
      bg: 'rgba(46,204,113,0.08)',
    },
    {
      title: 'Grupos de Leilão',
      description: 'Crie grupos temáticos com banners que aparecem no carrossel do dashboard. Usuários podem filtrar por grupo.',
      href: '/gestao/campanhas',
      icon: Tag,
      color: '#FFD700',
      bg: 'rgba(255,215,0,0.1)',
    },
  ];

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '2rem 1.5rem 5rem' }}>

      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontFamily: 'var(--font-montserrat, Montserrat, sans-serif)', fontSize: '1.625rem', fontWeight: 800, color: '#0A2E50', margin: '0 0 0.375rem' }}>
          Painel de Gestão
        </h1>
        <p style={{ color: '#666', margin: 0, fontSize: '0.9rem' }}>
          Gerencie imóveis, importações e configurações da plataforma.
        </p>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        {[
          {
            label: 'Imóveis cadastrados',
            value: loading ? '...' : totalProps.toLocaleString('pt-BR'),
            icon: Database,
            color: '#0A2E50',
          },
          {
            label: 'Última importação',
            value: loading ? '...' : (lastImport || 'Nunca'),
            icon: Upload,
            color: '#1E6BB8',
            small: true,
          },
          {
            label: 'Grupos de leilão',
            value: loading ? '...' : totalCampaigns.toString(),
            icon: Tag,
            color: '#FFD700',
          },
        ].map((stat) => (
          <div key={stat.label} style={{ backgroundColor: 'white', borderRadius: '12px', padding: '1.25rem', boxShadow: '0 1px 6px rgba(10,46,80,0.07)', borderLeft: `4px solid ${stat.color}`, display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <stat.icon size={24} color={stat.color} style={{ flexShrink: 0, opacity: 0.7 }} />
            <div>
              <div style={{ fontSize: stat.small ? '0.875rem' : '1.75rem', fontWeight: 800, color: stat.color, fontFamily: 'var(--font-montserrat, Montserrat, sans-serif)', lineHeight: 1.2 }}>{stat.value}</div>
              <div style={{ fontSize: '0.75rem', color: '#666', marginTop: '0.2rem' }}>{stat.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Action cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.25rem', marginBottom: '2rem' }}>
        {cards.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            style={{
              backgroundColor: 'white',
              borderRadius: '14px',
              padding: '1.625rem',
              boxShadow: '0 1px 8px rgba(10,46,80,0.07)',
              textDecoration: 'none',
              display: 'block',
              border: `1.5px solid transparent`,
              transition: 'box-shadow 0.2s, border-color 0.2s',
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = card.color; (e.currentTarget as HTMLElement).style.boxShadow = `0 4px 20px rgba(10,46,80,0.12)`; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'transparent'; (e.currentTarget as HTMLElement).style.boxShadow = '0 1px 8px rgba(10,46,80,0.07)'; }}
          >
            <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: card.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem' }}>
              <card.icon size={22} color={card.color} />
            </div>
            <h3 style={{ margin: '0 0 0.5rem', fontSize: '1rem', fontWeight: 700, color: '#0A2E50', fontFamily: 'var(--font-montserrat, Montserrat, sans-serif)' }}>{card.title}</h3>
            <p style={{ margin: 0, fontSize: '0.85rem', color: '#666', lineHeight: 1.6 }}>{card.description}</p>
            <div style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '0.3rem', color: card.color, fontSize: '0.825rem', fontWeight: 600 }}>
              Acessar <ExternalLink size={13} />
            </div>
          </Link>
        ))}
      </div>

      {/* Info */}
      <div style={{ backgroundColor: 'rgba(10,46,80,0.04)', borderRadius: '12px', padding: '1.25rem 1.5rem', border: '1px solid rgba(10,46,80,0.1)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
          <BarChart2 size={16} color="#0A2E50" />
          <strong style={{ color: '#0A2E50', fontSize: '0.875rem', fontFamily: 'var(--font-montserrat, Montserrat, sans-serif)' }}>Área restrita</strong>
        </div>
        <p style={{ margin: 0, color: '#666', fontSize: '0.825rem', lineHeight: 1.65 }}>
          Esta área é exclusiva para administradores. As alterações feitas aqui afetam os dados visíveis para todos os usuários da plataforma.
        </p>
      </div>
    </div>
  );
}
