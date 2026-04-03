'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, PlusCircle, Trash2, Edit3, Tag, Calendar } from 'lucide-react';
import { getCampaigns, deleteCampaign } from '@/lib/propertyStorage';
import { AuctionCampaign } from '@/types/property';

export default function CampanhasPage() {
  const [campaigns, setCampaigns] = useState<AuctionCampaign[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    const list = await getCampaigns();
    setCampaigns(list.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Remover o grupo "${name}"? Os imóveis vinculados não serão apagados.`)) return;
    await deleteCampaign(id);
    load();
  }

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '2rem 1.5rem 5rem' }}>

      <Link href="/gestao" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', color: '#1E6BB8', textDecoration: 'none', fontSize: '0.875rem', fontWeight: 600, marginBottom: '1.75rem' }}>
        <ArrowLeft size={16} /> Voltar ao Painel de Gestão
      </Link>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.75rem' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-montserrat, Montserrat, sans-serif)', fontSize: '1.625rem', fontWeight: 800, color: '#0A2E50', margin: '0 0 0.375rem' }}>
            Grupos de Leilão
          </h1>
          <p style={{ color: '#666', margin: 0, fontSize: '0.9rem' }}>
            Crie grupos temáticos com banner para destacar leilões especiais no dashboard.
          </p>
        </div>
        <Link
          href="/gestao/campanhas/nova"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1.25rem', borderRadius: '9px', backgroundColor: '#1E6BB8', color: 'white', fontWeight: 700, fontSize: '0.875rem', textDecoration: 'none', fontFamily: 'var(--font-montserrat, Montserrat, sans-serif)' }}
        >
          <PlusCircle size={16} /> Novo Grupo
        </Link>
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#888' }}>Carregando...</div>
      )}

      {!loading && campaigns.length === 0 && (
        <div style={{ backgroundColor: 'white', borderRadius: '14px', padding: '3rem 2rem', textAlign: 'center', boxShadow: '0 1px 8px rgba(10,46,80,0.07)' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🏷️</div>
          <h3 style={{ color: '#0A2E50', marginBottom: '0.5rem', fontFamily: 'var(--font-montserrat, Montserrat, sans-serif)' }}>Nenhum grupo criado</h3>
          <p style={{ color: '#666', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
            Crie grupos para destacar leilões especiais — ex.: &quot;Leilão Dia das Mães&quot;, &quot;Especial Fim de Ano&quot;.
          </p>
          <Link href="/gestao/campanhas/nova" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1.5rem', borderRadius: '8px', backgroundColor: '#1E6BB8', color: 'white', fontWeight: 700, fontSize: '0.875rem', textDecoration: 'none' }}>
            <PlusCircle size={16} /> Criar primeiro grupo
          </Link>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {campaigns.map((c) => (
          <div key={c.id} style={{ backgroundColor: 'white', borderRadius: '14px', boxShadow: '0 1px 8px rgba(10,46,80,0.07)', overflow: 'hidden', display: 'flex', alignItems: 'stretch' }}>
            {/* Banner preview */}
            {c.bannerImage ? (
              <div style={{ width: '140px', flexShrink: 0, backgroundImage: `url(${c.bannerImage})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
            ) : (
              <div style={{ width: '140px', flexShrink: 0, backgroundColor: 'rgba(30,107,184,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Tag size={32} color="#1E6BB8" style={{ opacity: 0.4 }} />
              </div>
            )}

            {/* Info */}
            <div style={{ flex: 1, padding: '1.125rem 1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.3rem' }}>
                  <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#0A2E50', fontFamily: 'var(--font-montserrat, Montserrat, sans-serif)' }}>
                    {c.name}
                  </h3>
                  <span style={{
                    fontSize: '0.65rem', fontWeight: 700, padding: '0.1rem 0.45rem', borderRadius: '4px',
                    backgroundColor: c.active ? 'rgba(46,204,113,0.12)' : 'rgba(153,153,153,0.12)',
                    color: c.active ? '#1a7a43' : '#888',
                  }}>
                    {c.active ? 'ATIVO' : 'INATIVO'}
                  </span>
                </div>
                {c.bank && <p style={{ margin: '0 0 0.25rem', fontSize: '0.8rem', color: '#1E6BB8', fontWeight: 600 }}>{c.bank}</p>}
                {c.description && <p style={{ margin: '0 0 0.25rem', fontSize: '0.8rem', color: '#666' }}>{c.description}</p>}
                {(c.startDate || c.endDate) && (
                  <p style={{ margin: 0, fontSize: '0.75rem', color: '#999', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    <Calendar size={12} />
                    {c.startDate && new Date(c.startDate).toLocaleDateString('pt-BR')}
                    {c.startDate && c.endDate && ' – '}
                    {c.endDate && new Date(c.endDate).toLocaleDateString('pt-BR')}
                  </p>
                )}
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                <Link
                  href={`/gestao/campanhas/${c.id}/editar`}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.45rem 0.875rem', borderRadius: '7px', border: '1.5px solid #1E6BB8', backgroundColor: 'transparent', color: '#1E6BB8', fontWeight: 600, fontSize: '0.8rem', textDecoration: 'none' }}
                >
                  <Edit3 size={14} /> Editar
                </Link>
                <button
                  onClick={() => handleDelete(c.id, c.name)}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.45rem 0.75rem', borderRadius: '7px', border: '1.5px solid rgba(231,76,60,0.4)', backgroundColor: 'transparent', color: '#e74c3c', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer' }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
