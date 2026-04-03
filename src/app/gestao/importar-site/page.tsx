'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, Globe, Search, CheckCircle, AlertCircle, Loader2, Tag } from 'lucide-react';
import { saveProperties, getCampaigns } from '@/lib/propertyStorage';
import { Property, AuctionCampaign } from '@/types/property';

const SUPPORTED_SITES = [
  { name: 'Portal ZUK', host: 'portalzuk.com.br', example: 'https://www.portalzuk.com.br/leilao-de-imoveis' },
  { name: 'Mega Leilões', host: 'megaleiloes.com.br', example: 'https://www.megaleiloes.com.br/imoveis' },
  { name: 'Leilões Judiciais BR', host: 'leiloesjudiciaisbrasil.com.br', example: 'https://www.leiloesjudiciaisbrasil.com.br/imoveis' },
];

const MEGA_QUICK_FILTERS = [
  { label: 'Todos os imóveis', url: 'https://www.megaleiloes.com.br/imoveis' },
  { label: 'Casas', url: 'https://www.megaleiloes.com.br/imoveis/casas' },
  { label: 'Apartamentos', url: 'https://www.megaleiloes.com.br/imoveis/apartamentos' },
  { label: 'Terrenos', url: 'https://www.megaleiloes.com.br/imoveis/terrenos-e-lotes' },
  { label: 'Comercial', url: 'https://www.megaleiloes.com.br/imoveis/comerciais' },
  { label: 'Rural', url: 'https://www.megaleiloes.com.br/imoveis/areas-rurais' },
];

const ZUK_QUICK_FILTERS = [
  { label: 'Todos os imóveis', url: 'https://www.portalzuk.com.br/leilao-de-imoveis' },
  { label: 'Desocupados', url: 'https://www.portalzuk.com.br/leilao-de-imoveis/tl/todos-imoveis/desocupados' },
  { label: 'Próximos leilões', url: 'https://www.portalzuk.com.br/leilao-de-imoveis/tl/proximos-leiloes' },
  { label: 'Leilão judicial', url: 'https://www.portalzuk.com.br/leilao-de-imoveis/tl/todos-imoveis/leilao-judicial' },
  { label: 'Leilão extrajudicial', url: 'https://www.portalzuk.com.br/leilao-de-imoveis/tl/todos-imoveis/leilao-extra-judicial' },
  { label: 'Alienação fiduciária', url: 'https://www.portalzuk.com.br/leilao-de-imoveis/tl/todos-imoveis/alienacao-fiduciaria' },
  { label: 'Maior desconto', url: 'https://www.portalzuk.com.br/leilao-de-imoveis?order=maior_desconto' },
  { label: 'Menor valor', url: 'https://www.portalzuk.com.br/leilao-de-imoveis?order=menor_valor' },
];

export default function ImportarSitePage() {
  const [url, setUrl]               = useState('');
  const [campaignId, setCampaignId] = useState('');
  const [campaigns, setCampaigns]   = useState<AuctionCampaign[]>([]);
  const [status, setStatus]         = useState<'idle' | 'fetching' | 'preview' | 'saving' | 'done' | 'error'>('idle');
  const [errorMsg, setErrorMsg]     = useState('');
  const [preview, setPreview]       = useState<Property[]>([]);
  const [saveStats, setSaveStats] = useState({ added: 0, updated: 0, skipped: 0 });
  const [useBrowser, setUseBrowser] = useState(false);

  useEffect(() => {
    getCampaigns().then((list) => setCampaigns(list.filter((c) => c.active)));
  }, []);

  async function handleFetch() {
    if (!url.trim()) return;
    setStatus('fetching');
    setErrorMsg('');
    setPreview([]);
    setSaveStats({ added: 0, updated: 0, skipped: 0 });

    const isMega = url.includes('megaleiloes.com.br');
    const isLJB  = url.includes('leiloesjudiciaisbrasil.com.br');
    const endpoint = isMega ? '/api/importar-mega'
      : isLJB  ? '/api/importar-ljb'
      : useBrowser ? '/api/importar-site-browser' : '/api/importar-site';
    try {
      const res  = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim(), campaignId: campaignId || undefined }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Erro ao buscar imóveis');
      setPreview(data.properties as Property[]);
      setStatus('preview');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Erro desconhecido');
      setStatus('error');
    }
  }

  async function handleImport() {
    setStatus('saving');
    try {
      const stats = await saveProperties(preview);
      setSaveStats({ added: stats.added, updated: stats.updated, skipped: stats.skipped });
      setStatus('done');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Erro ao salvar');
      setStatus('error');
    }
  }

  const inputStyle = {
    width: '100%', padding: '0.625rem 0.875rem', borderRadius: '8px',
    border: '1.5px solid #e0e0e0', fontSize: '0.875rem', color: '#333',
    outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' as const,
  };

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '2rem 1.5rem 6rem' }}>

      <Link href="/gestao" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', color: '#1E6BB8', textDecoration: 'none', fontSize: '0.875rem', fontWeight: 600, marginBottom: '1.75rem' }}>
        <ArrowLeft size={16} /> Voltar ao Painel de Gestão
      </Link>

      <div style={{ marginBottom: '1.75rem' }}>
        <h1 style={{ fontFamily: 'var(--font-montserrat, Montserrat, sans-serif)', fontSize: '1.625rem', fontWeight: 800, color: '#0A2E50', margin: '0 0 0.5rem' }}>
          Importar de Site de Leilões
        </h1>
        <p style={{ color: '#666', margin: 0, lineHeight: 1.65, fontSize: '0.9rem' }}>
          Cole o link de uma página de leilões para extrair os imóveis automaticamente.
        </p>
      </div>

      {/* Supported sites */}
      <div style={{ backgroundColor: 'rgba(30,107,184,0.04)', borderRadius: '12px', padding: '1rem 1.25rem', border: '1px solid rgba(30,107,184,0.12)', marginBottom: '1rem' }}>
        <p style={{ margin: '0 0 0.5rem', fontSize: '0.75rem', fontWeight: 700, color: '#0A2E50', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Sites suportados</p>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {SUPPORTED_SITES.map((s) => (
            <button key={s.host} onClick={() => setUrl(s.example)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.3rem 0.75rem', borderRadius: '6px', border: '1.5px solid #1E6BB8', backgroundColor: url.includes(s.host) ? '#1E6BB8' : 'transparent', color: url.includes(s.host) ? 'white' : '#1E6BB8', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}>
              <Globe size={13} /> {s.name}
            </button>
          ))}
        </div>
      </div>

      {/* Mega Leilões quick filters */}
      {url.includes('megaleiloes.com.br') && (
        <div style={{ backgroundColor: 'rgba(46,204,113,0.05)', borderRadius: '12px', padding: '1rem 1.25rem', border: '1px solid rgba(46,204,113,0.25)', marginBottom: '1rem' }}>
          <p style={{ margin: '0 0 0.15rem', fontSize: '0.75rem', fontWeight: 700, color: '#1a7a43', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Mega Leilões — Filtros rápidos</p>
          <p style={{ margin: '0 0 0.625rem', fontSize: '0.75rem', color: '#888', lineHeight: 1.5 }}>
            Importa todas as páginas automaticamente (~1.200 imóveis em ~30s). Duplicatas são ignoradas.
          </p>
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            {MEGA_QUICK_FILTERS.map((f) => (
              <button key={f.url} onClick={() => setUrl(f.url)}
                style={{ padding: '0.25rem 0.625rem', borderRadius: '5px', border: '1px solid rgba(46,204,113,0.4)', backgroundColor: url === f.url ? '#2ECC71' : 'rgba(46,204,113,0.1)', color: url === f.url ? 'white' : '#1a7a43', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}>
                {f.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* LJB quick filters */}
      {url.includes('leiloesjudiciaisbrasil.com.br') && (
        <div style={{ backgroundColor: 'rgba(220,53,69,0.04)', borderRadius: '12px', padding: '1rem 1.25rem', border: '1px solid rgba(220,53,69,0.2)', marginBottom: '1rem' }}>
          <p style={{ margin: '0 0 0.15rem', fontSize: '0.75rem', fontWeight: 700, color: '#a71d2a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Leilões Judiciais BR — Filtros rápidos</p>
          <p style={{ margin: '0 0 0.625rem', fontSize: '0.75rem', color: '#888', lineHeight: 1.5 }}>
            Importa todas as subcategorias automaticamente. &quot;Todos os imóveis&quot; busca casas, aptos, terrenos, rurais e comerciais de uma vez.
          </p>
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            {[
              { label: 'Todos os imóveis', url: 'https://www.leiloesjudiciaisbrasil.com.br/imoveis' },
              { label: 'Casas', url: 'https://www.leiloesjudiciaisbrasil.com.br/imoveis/casas' },
              { label: 'Apartamentos', url: 'https://www.leiloesjudiciaisbrasil.com.br/imoveis/apartamentos' },
              { label: 'Terrenos', url: 'https://www.leiloesjudiciaisbrasil.com.br/imoveis/terrenos-e-lotes' },
              { label: 'Fazendas', url: 'https://www.leiloesjudiciaisbrasil.com.br/imoveis/fazendas' },
              { label: 'Comercial', url: 'https://www.leiloesjudiciaisbrasil.com.br/imoveis/imoveis-comerciais' },
            ].map((f) => (
              <button key={f.url} onClick={() => setUrl(f.url)}
                style={{ padding: '0.25rem 0.625rem', borderRadius: '5px', border: '1px solid rgba(220,53,69,0.3)', backgroundColor: url === f.url ? '#dc3545' : 'rgba(220,53,69,0.08)', color: url === f.url ? 'white' : '#a71d2a', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}>
                {f.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ZUK quick filters */}
      {url.includes('portalzuk.com.br') || !url ? (
        <div style={{ backgroundColor: 'rgba(255,215,0,0.06)', borderRadius: '12px', padding: '1rem 1.25rem', border: '1px solid rgba(255,215,0,0.3)', marginBottom: '1rem' }}>
          <p style={{ margin: '0 0 0.15rem', fontSize: '0.75rem', fontWeight: 700, color: '#7a6500', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Portal ZUK — Filtros rápidos</p>
          <p style={{ margin: '0 0 0.625rem', fontSize: '0.75rem', color: '#888', lineHeight: 1.5 }}>
            O ZUK carrega ~30 imóveis por página. Use diferentes filtros e importe várias vezes — duplicatas são ignoradas automaticamente.
          </p>
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            {ZUK_QUICK_FILTERS.map((f) => (
              <button key={f.url} onClick={() => setUrl(f.url)}
                style={{ padding: '0.25rem 0.625rem', borderRadius: '5px', border: '1px solid rgba(255,215,0,0.5)', backgroundColor: url === f.url ? '#FFD700' : 'rgba(255,215,0,0.12)', color: url === f.url ? '#0A2E50' : '#7a6500', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}>
                {f.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {/* Input form */}
      <div style={{ backgroundColor: 'white', borderRadius: '14px', padding: '1.5rem', boxShadow: '0 1px 8px rgba(10,46,80,0.07)', marginBottom: '1.25rem' }}>
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#0A2E50', marginBottom: '0.35rem' }}>
            URL da página de leilões
          </label>
          <div style={{ display: 'flex', gap: '0.625rem' }}>
            <input
              style={{ ...inputStyle, fontFamily: 'monospace', flex: 1 }}
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://www.portalzuk.com.br/leilao-de-imoveis"
              disabled={status === 'fetching' || status === 'saving'}
            />
            <button
              onClick={handleFetch}
              disabled={!url.trim() || status === 'fetching' || status === 'saving'}
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.625rem 1.25rem', borderRadius: '8px', border: 'none', backgroundColor: !url.trim() || status === 'fetching' ? '#ccc' : useBrowser ? '#8B5CF6' : '#1E6BB8', color: 'white', fontWeight: 700, fontSize: '0.875rem', cursor: !url.trim() || status === 'fetching' ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap', fontFamily: 'var(--font-montserrat, Montserrat, sans-serif)' }}
            >
              {status === 'fetching'
                ? <><Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> {url.includes('megaleiloes.com.br') ? 'Importando (~30s)...' : url.includes('leiloesjudiciaisbrasil.com.br') ? 'Importando leilões judiciais...' : useBrowser ? 'Abrindo browser...' : 'Buscando (aguarde)...'}</>
                : url.includes('megaleiloes.com.br')
                  ? <><Search size={15} /> Importar Tudo (Mega)</>
                  : url.includes('leiloesjudiciaisbrasil.com.br')
                    ? <><Search size={15} /> Importar Leilões Judiciais</>
                  : useBrowser
                    ? <><Search size={15} /> Buscar com Browser</>
                    : url.includes('portalzuk.com.br/leilao-de-imoveis') && !url.includes('/v/') && !url.includes('/tl/')
                      ? <><Search size={15} /> Importar Tudo (ZUK)</>
                      : <><Search size={15} /> Buscar Imóveis</>
              }
            </button>
          </div>
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>

        {/* Browser mode toggle */}
        {url.includes('portalzuk.com.br') && (
          <div style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem', borderRadius: '8px', backgroundColor: useBrowser ? 'rgba(139,92,246,0.06)' : 'rgba(10,46,80,0.03)', border: `1px solid ${useBrowser ? 'rgba(139,92,246,0.25)' : 'rgba(10,46,80,0.08)'}` }}>
            <button
              onClick={() => setUseBrowser(!useBrowser)}
              style={{ flexShrink: 0, width: '40px', height: '22px', borderRadius: '11px', border: 'none', backgroundColor: useBrowser ? '#8B5CF6' : '#ccc', position: 'relative', cursor: 'pointer', transition: 'background 0.2s' }}
            >
              <span style={{ position: 'absolute', top: '3px', left: useBrowser ? '21px' : '3px', width: '16px', height: '16px', borderRadius: '50%', backgroundColor: 'white', transition: 'left 0.2s' }} />
            </button>
            <div>
              <p style={{ margin: 0, fontSize: '0.8rem', fontWeight: 700, color: useBrowser ? '#6D28D9' : '#0A2E50' }}>
                Modo Browser (Puppeteer) — 100% dos imóveis
              </p>
              <p style={{ margin: 0, fontSize: '0.73rem', color: '#888', lineHeight: 1.4 }}>
                Abre um Chrome invisível e clica em &quot;Carregar mais&quot; automaticamente. Mais lento (~1–2 min) mas obtém todos os imóveis da página.
              </p>
            </div>
          </div>
        )}

        {campaigns.length > 0 && (
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#0A2E50', marginBottom: '0.35rem' }}>
              Vincular a um Grupo de Leilão (opcional)
            </label>
            <select style={inputStyle} value={campaignId} onChange={(e) => setCampaignId(e.target.value)}>
              <option value="">Sem grupo</option>
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>{c.name}{c.bank ? ` — ${c.bank}` : ''}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Error */}
      {status === 'error' && (
        <div style={{ backgroundColor: 'rgba(231,76,60,0.05)', borderRadius: '12px', padding: '1rem 1.25rem', border: '1.5px solid rgba(231,76,60,0.2)', marginBottom: '1.25rem', display: 'flex', alignItems: 'flex-start', gap: '0.625rem' }}>
          <AlertCircle size={18} color="#e74c3c" style={{ flexShrink: 0, marginTop: '2px' }} />
          <div>
            <p style={{ margin: '0 0 0.25rem', fontWeight: 700, color: '#a93226', fontSize: '0.875rem' }}>Erro ao buscar imóveis</p>
            <p style={{ margin: 0, color: '#666', fontSize: '0.82rem' }}>{errorMsg}</p>
          </div>
        </div>
      )}

      {/* Done */}
      {status === 'done' && (
        <div style={{ backgroundColor: 'rgba(46,204,113,0.06)', borderRadius: '12px', padding: '1.25rem 1.5rem', border: '1.5px solid rgba(46,204,113,0.3)', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
            <CheckCircle size={22} color="#2ECC71" style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              <p style={{ margin: '0 0 0.2rem', fontWeight: 700, color: '#1a7a43', fontSize: '0.95rem' }}>
                {saveStats.added} imóveis novos importados!
              </p>
              <p style={{ margin: 0, color: '#555', fontSize: '0.8rem' }}>
                {saveStats.updated > 0 && <span style={{ marginRight: '0.75rem' }}>🔄 {saveStats.updated} atualizados (praça mudou)</span>}
                {saveStats.skipped > 0 && <span style={{ color: '#888' }}>⏭ {saveStats.skipped} ignorados (já existiam)</span>}
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <Link href="/dashboard" style={{ padding: '0.5rem 1.25rem', borderRadius: '8px', backgroundColor: '#2ECC71', color: 'white', fontWeight: 700, fontSize: '0.875rem', textDecoration: 'none' }}>
              Ver no Dashboard
            </Link>
            <button onClick={() => { setStatus('idle'); setPreview([]); setUrl(''); }}
              style={{ padding: '0.5rem 1rem', borderRadius: '8px', border: '1.5px solid #ccc', backgroundColor: 'white', color: '#666', fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer' }}>
              Nova importação
            </button>
          </div>
        </div>
      )}

      {/* Preview */}
      {status === 'preview' && preview.length > 0 && (
        <div>
          {/* Header */}
          <div style={{ backgroundColor: 'white', borderRadius: '14px', padding: '1.125rem 1.5rem', boxShadow: '0 1px 8px rgba(10,46,80,0.07)', marginBottom: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <p style={{ margin: 0, fontWeight: 700, color: '#0A2E50', fontSize: '0.95rem' }}>
                {preview.length} imóveis encontrados
              </p>
              <p style={{ margin: '0.15rem 0 0', color: '#666', fontSize: '0.8rem' }}>
                Revise abaixo e confirme a importação.
                {campaignId && campaigns.find((c) => c.id === campaignId) && (
                  <> Serão vinculados ao grupo <strong>{campaigns.find((c) => c.id === campaignId)?.name}</strong>.</>
                )}
              </p>
            </div>
            <button
              onClick={handleImport}
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1.75rem', borderRadius: '9px', border: 'none', backgroundColor: '#2ECC71', color: 'white', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer', fontFamily: 'var(--font-montserrat, Montserrat, sans-serif)' }}
            >
              <CheckCircle size={16} /> Confirmar Importação
            </button>
          </div>

          {/* Property list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
            {preview.slice(0, 30).map((p, idx) => (
              <div key={p.id} style={{ backgroundColor: 'white', borderRadius: '11px', padding: '0.875rem 1.125rem', boxShadow: '0 1px 5px rgba(10,46,80,0.06)', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                {/* Number */}
                <span style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: 'rgba(30,107,184,0.1)', color: '#1E6BB8', fontSize: '0.72rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {idx + 1}
                </span>

                {/* Thumbnail */}
                {p.mainImage ? (
                  <img src={p.mainImage} alt="" style={{ width: '64px', height: '48px', objectFit: 'cover', borderRadius: '7px', flexShrink: 0 }} />
                ) : (
                  <div style={{ width: '64px', height: '48px', borderRadius: '7px', backgroundColor: '#f0f0f0', flexShrink: 0 }} />
                )}

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: '0 0 0.15rem', fontWeight: 700, color: '#0A2E50', fontSize: '0.85rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {p.title}
                  </p>
                  <p style={{ margin: 0, color: '#666', fontSize: '0.78rem' }}>
                    {p.city} / {p.state}
                    {p.auctionDate && ` · Leilão: ${new Date(p.auctionDate + 'T12:00:00').toLocaleDateString('pt-BR')}`}
                  </p>
                </div>

                {/* Bid */}
                {p.initialBid > 0 && (
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <p style={{ margin: 0, fontWeight: 800, color: '#1E6BB8', fontSize: '0.875rem', fontFamily: 'var(--font-montserrat, Montserrat, sans-serif)' }}>
                      {p.initialBid.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })}
                    </p>
                    {p.auctionDate && (
                      <p style={{ margin: 0, fontSize: '0.7rem', color: '#999' }}>lance mínimo</p>
                    )}
                  </div>
                )}

                {/* Campaign tag */}
                {p.campaignId && (
                  <span title="Vinculado ao grupo" style={{ flexShrink: 0 }}><Tag size={14} color="#FFD700" /></span>
                )}
              </div>
            ))}
            {preview.length > 30 && (
              <p style={{ textAlign: 'center', color: '#888', fontSize: '0.82rem', padding: '0.5rem' }}>
                + {preview.length - 30} imóveis adicionais serão importados
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
