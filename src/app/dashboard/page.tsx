'use client';

import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { Map, LayoutGrid, ChevronDown, Upload, ChevronLeft, ChevronRight, X, Lock } from 'lucide-react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import PropertyCard from '@/components/dashboard/PropertyCard';
import PropertyFiltersComponent from '@/components/dashboard/PropertyFilters';
import { filterProperties, mockProperties } from '@/lib/mockData';
import { getProperties, getCampaigns } from '@/lib/propertyStorage';
import { PropertyFilters, Property, AuctionCampaign, SortBy, PropertyType, OccupationStatus } from '@/types/property';

const PAGE_SIZE = 48;

/** Read filters persisted in the URL search string */
function parseFiltersFromURL(): PropertyFilters {
  if (typeof window === 'undefined') return {};
  const p = new URLSearchParams(window.location.search);
  const f: PropertyFilters = {};
  const search    = p.get('search');    if (search)    f.search    = search;
  const state     = p.get('state');     if (state)     f.state     = state;
  const sortBy    = p.get('sortBy');    if (sortBy)    f.sortBy    = sortBy as SortBy;
  const modalidade = p.get('modalidade'); if (modalidade) f.modalidade = modalidade;
  const paymentMethod = p.get('paymentMethod'); if (paymentMethod) f.paymentMethod = paymentMethod;
  const sourceBank = p.get('sourceBank'); if (sourceBank) f.sourceBank = sourceBank;
  const sourceAuctioneer = p.get('sourceAuctioneer'); if (sourceAuctioneer) f.sourceAuctioneer = sourceAuctioneer;
  const propertyType = p.get('propertyType'); if (propertyType) f.propertyType = propertyType as PropertyType;
  const occupationStatus = p.get('occupationStatus'); if (occupationStatus) f.occupationStatus = occupationStatus as OccupationStatus;
  const minValue  = p.get('minValue');  if (minValue)  f.minValue  = Number(minValue);
  const maxValue  = p.get('maxValue');  if (maxValue)  f.maxValue  = Number(maxValue);
  const campaignId = p.get('campaignId'); if (campaignId) f.campaignId = campaignId;
  if (p.get('searchAddress') === '1') f.searchAddress = true;
  return f;
}

/** Serialize filters to URL search string and update browser history (no reload) */
function persistFiltersToURL(filters: PropertyFilters) {
  const p = new URLSearchParams();
  if (filters.search)           p.set('search',           filters.search);
  if (filters.state)            p.set('state',            filters.state);
  if (filters.sortBy)           p.set('sortBy',           filters.sortBy);
  if (filters.modalidade)       p.set('modalidade',       filters.modalidade);
  if (filters.paymentMethod)    p.set('paymentMethod',    filters.paymentMethod);
  if (filters.sourceBank)       p.set('sourceBank',       filters.sourceBank);
  if (filters.sourceAuctioneer) p.set('sourceAuctioneer', filters.sourceAuctioneer);
  if (filters.propertyType)     p.set('propertyType',     filters.propertyType);
  if (filters.occupationStatus) p.set('occupationStatus', filters.occupationStatus);
  if (filters.minValue)         p.set('minValue',         String(filters.minValue));
  if (filters.maxValue)         p.set('maxValue',         String(filters.maxValue));
  if (filters.campaignId)       p.set('campaignId',       filters.campaignId);
  if (filters.searchAddress)    p.set('searchAddress',    '1');
  const qs = p.toString();
  window.history.replaceState(null, '', `/dashboard${qs ? '?' + qs : ''}`);
}

export default function DashboardPage() {
  const { data: session } = useSession();
  const isFree = session?.user?.plan === 'FREE';
  const [filters, setFilters]   = useState<PropertyFilters>({});
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'grid' | 'map'>('grid');
  const [MapView, setMapView]   = useState<React.ComponentType<{ properties: Property[] }> | null>(null);
  const [allProperties, setAllProperties] = useState<Property[]>([]);
  const [activeCampaigns, setActiveCampaigns] = useState<AuctionCampaign[]>([]);
  const [loadingDB, setLoadingDB]         = useState(true);
  const [visibleCount, setVisibleCount]   = useState(PAGE_SIZE);
  const [carouselIdx, setCarouselIdx]     = useState(0);
  const carouselTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Restore filters from URL on first mount
  useEffect(() => {
    setFilters(parseFiltersFromURL());
  }, []);

  // Load properties + campaigns from IndexedDB, merged with mockData
  useEffect(() => {
    Promise.all([getProperties(), getCampaigns()]).then(([props, campaigns]) => {
      // Merge IndexedDB with mockData (mockData fills in for demo when DB is empty)
      const merged = [
        ...props,
        ...mockProperties.filter((mp) => !props.some((p) => p.id === mp.id)),
      ];
      setAllProperties(merged);
      setActiveCampaigns(campaigns.filter((c) => c.active && c.bannerImage));
    }).finally(() => setLoadingDB(false));
  }, []);

  // Auto-advance carousel
  useEffect(() => {
    if (activeCampaigns.length <= 1) return;
    carouselTimer.current = setInterval(() => {
      setCarouselIdx((i) => (i + 1) % activeCampaigns.length);
    }, 5000);
    return () => { if (carouselTimer.current) clearInterval(carouselTimer.current); };
  }, [activeCampaigns.length]);

  function restartTimer() {
    if (carouselTimer.current) clearInterval(carouselTimer.current);
    if (activeCampaigns.length > 1) {
      carouselTimer.current = setInterval(() => {
        setCarouselIdx((i) => (i + 1) % activeCampaigns.length);
      }, 5000);
    }
  }

  function carouselPrev() { setCarouselIdx((i) => (i - 1 + activeCampaigns.length) % activeCampaigns.length); restartTimer(); }
  function carouselNext() { setCarouselIdx((i) => (i + 1) % activeCampaigns.length); restartTimer(); }

  // When filters change: persist to URL + reset pagination
  const handleFilterChange = useCallback((newFilters: PropertyFilters) => {
    setFilters(newFilters);
    persistFiltersToURL(newFilters);
    setVisibleCount(PAGE_SIZE);
  }, []);

  function applyCampaignFilter(campaign: AuctionCampaign) {
    const newFilters: PropertyFilters = { campaignId: campaign.id };
    handleFilterChange(newFilters);
  }

  function clearCampaignFilter() {
    const { campaignId: _, ...rest } = filters;
    handleFilterChange(rest);
  }

  const FREE_LIMIT = 52;

  const filtered = useMemo(() => {
    return filterProperties(allProperties, filters);
  }, [allProperties, filters]);

  const availableModalities = useMemo(
    () =>
      Array.from(
        new Set(allProperties.map((p) => p.auction?.modalidade).filter(Boolean) as string[])
      ).sort(),
    [allProperties]
  );

  const visible = useMemo(
    () => filtered.slice(0, visibleCount),
    [filtered, visibleCount]
  );

  function handleSave(id: string) {
    setSavedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function handleMapView() {
    if (viewMode === 'map') { setViewMode('grid'); return; }
    if (!MapView) {
      const { default: MV } = await import('@/components/dashboard/MapView');
      setMapView(() => MV as React.ComponentType<{ properties: Property[] }>);
    }
    setViewMode('map');
  }

  const activeCampaign = filters.campaignId
    ? activeCampaigns.find((c) => c.id === filters.campaignId)
    : null;

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '1.5rem 1.5rem 5rem' }}>

      {/* ── Campaign Carousel ─────────────────────────────── */}
      {!loadingDB && activeCampaigns.length > 0 && !filters.campaignId && (
        <div style={{ position: 'relative', marginBottom: '1.5rem', borderRadius: '14px', overflow: 'hidden', boxShadow: '0 2px 16px rgba(10,46,80,0.13)' }}>
          <style>{`@keyframes fadeIn{from{opacity:0}to{opacity:1}}`}</style>

          {activeCampaigns.map((c, idx) => (
            <div key={c.id} style={{ display: idx === carouselIdx ? 'block' : 'none', animation: 'fadeIn 0.4s ease' }}>
              {/* Banner */}
              <div
                style={{
                  position: 'relative', cursor: 'pointer',
                  backgroundImage: `url(${c.bannerImage})`,
                  backgroundSize: 'cover', backgroundPosition: 'center',
                  minHeight: '160px',
                }}
                onClick={() => applyCampaignFilter(c)}
                role="button"
                aria-label={`Ver imóveis do grupo ${c.name}`}
              >
                {/* Gradient overlay */}
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to right, rgba(10,46,80,0.82) 0%, rgba(10,46,80,0.3) 60%, transparent 100%)' }} />

                {/* Text */}
                <div style={{ position: 'relative', padding: '1.5rem 2rem', maxWidth: '520px' }}>
                  {c.bank && (
                    <span style={{ display: 'inline-block', backgroundColor: '#FFD700', color: '#0A2E50', fontSize: '0.65rem', fontWeight: 800, padding: '0.2rem 0.6rem', borderRadius: '4px', marginBottom: '0.5rem', fontFamily: 'var(--font-montserrat, Montserrat, sans-serif)', letterSpacing: '0.05em' }}>
                      {c.bank}
                    </span>
                  )}
                  <h2 style={{ color: 'white', fontFamily: 'var(--font-montserrat, Montserrat, sans-serif)', fontSize: '1.25rem', fontWeight: 800, margin: '0 0 0.375rem', textShadow: '0 1px 4px rgba(0,0,0,0.4)' }}>
                    {c.name}
                  </h2>
                  {c.description && (
                    <p style={{ color: 'rgba(255,255,255,0.88)', fontSize: '0.875rem', margin: '0 0 1rem', lineHeight: 1.5 }}>
                      {c.description}
                    </p>
                  )}
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', backgroundColor: 'rgba(255,255,255,0.15)', border: '1.5px solid rgba(255,255,255,0.4)', color: 'white', padding: '0.45rem 1rem', borderRadius: '7px', fontSize: '0.82rem', fontWeight: 700, backdropFilter: 'blur(4px)' }}>
                    Ver imóveis deste grupo →
                  </span>
                </div>
              </div>
            </div>
          ))}

          {/* Prev/Next arrows */}
          {activeCampaigns.length > 1 && (
            <>
              <button onClick={carouselPrev} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', width: '32px', height: '32px', borderRadius: '50%', backgroundColor: 'rgba(0,0,0,0.4)', border: 'none', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2 }}>
                <ChevronLeft size={18} />
              </button>
              <button onClick={carouselNext} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', width: '32px', height: '32px', borderRadius: '50%', backgroundColor: 'rgba(0,0,0,0.4)', border: 'none', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2 }}>
                <ChevronRight size={18} />
              </button>

              {/* Dots */}
              <div style={{ position: 'absolute', bottom: '10px', right: '14px', display: 'flex', gap: '5px', zIndex: 2 }}>
                {activeCampaigns.map((_, i) => (
                  <button key={i} onClick={() => { setCarouselIdx(i); restartTimer(); }}
                    style={{ width: i === carouselIdx ? '20px' : '8px', height: '8px', borderRadius: '4px', backgroundColor: i === carouselIdx ? '#FFD700' : 'rgba(255,255,255,0.5)', border: 'none', cursor: 'pointer', transition: 'all 0.25s', padding: 0 }} />
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Active campaign filter banner ─────────────────── */}
      {activeCampaign && (
        <div style={{ backgroundColor: 'rgba(255,215,0,0.1)', border: '1.5px solid rgba(255,215,0,0.4)', borderRadius: '10px', padding: '0.75rem 1.125rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
          <span style={{ fontSize: '0.875rem', fontWeight: 700, color: '#0A2E50' }}>
            Filtrando por grupo: <span style={{ color: '#1E6BB8' }}>{activeCampaign.name}</span>
          </span>
          <button onClick={clearCampaignFilter} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', background: 'none', border: 'none', color: '#666', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}>
            <X size={14} /> Remover filtro
          </button>
        </div>
      )}

      {/* ── Title row ─────────────────────────────────────── */}
      <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-montserrat, Montserrat, sans-serif)', fontSize: '1.625rem', fontWeight: 800, color: '#0A2E50', margin: '0 0 0.25rem' }}>
            Oportunidades de Leilão
          </h1>
          <p style={{ color: '#666', fontSize: '0.875rem', margin: 0 }}>
            Encontre e analise as melhores oportunidades de investimento
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          {allProperties.length > 0 && (
            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#2ECC71', backgroundColor: 'rgba(46,204,113,0.1)', border: '1.5px solid rgba(46,204,113,0.3)', borderRadius: '20px', padding: '0.2rem 0.6rem' }}>
              {allProperties.length.toLocaleString('pt-BR')} imóveis
            </span>
          )}
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button onClick={() => setViewMode('grid')} style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', padding: '0.5rem 0.875rem', borderRadius: '8px', border: `2px solid ${viewMode === 'grid' ? '#1E6BB8' : '#e0e0e0'}`, backgroundColor: viewMode === 'grid' ? 'rgba(30,107,184,0.08)' : 'white', color: viewMode === 'grid' ? '#1E6BB8' : '#666', fontWeight: 600, fontSize: '0.825rem', cursor: 'pointer' }}>
              <LayoutGrid size={16} /> Cards
            </button>
            <button onClick={handleMapView} style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', padding: '0.5rem 0.875rem', borderRadius: '8px', border: `2px solid ${viewMode === 'map' ? '#1E6BB8' : '#e0e0e0'}`, backgroundColor: viewMode === 'map' ? 'rgba(30,107,184,0.08)' : 'white', color: viewMode === 'map' ? '#1E6BB8' : '#666', fontWeight: 600, fontSize: '0.825rem', cursor: 'pointer' }}>
              <Map size={16} /> Mapa
            </button>
          </div>
        </div>
      </div>

      {/* ── Freemium banner ───────────────────────────────── */}
      {isFree && (
        <div style={{ backgroundColor: 'rgba(255,215,0,0.08)', border: '1.5px solid rgba(255,215,0,0.5)', borderRadius: '12px', padding: '1rem 1.25rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <Lock size={20} style={{ color: '#9a7d0a', flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: 'var(--font-montserrat, Montserrat, sans-serif)', fontWeight: 700, color: '#7a6200', fontSize: '0.9rem', marginBottom: '0.2rem' }}>
              Plano Gratuito — Visualizando {FREE_LIMIT} de {allProperties.length.toLocaleString('pt-BR')} imóveis disponíveis
            </div>
            <p style={{ color: '#9a7d0a', fontSize: '0.8rem', margin: 0 }}>
              Faça upgrade para Premium e acesse o banco completo, filtros avançados e análise por IA.
            </p>
          </div>
          <Link href="/dashboard/perfil" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1rem', borderRadius: '8px', backgroundColor: '#FFD700', color: '#0A2E50', fontWeight: 700, fontSize: '0.8rem', textDecoration: 'none', whiteSpace: 'nowrap' }}>
            Assinar Premium →
          </Link>
        </div>
      )}

      {/* ── Stats bar ─────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '0.875rem', marginBottom: '1.5rem' }}>
        {[
          { label: 'Total de oportunidades', value: allProperties.length.toLocaleString('pt-BR'), color: '#0A2E50' },
          { label: 'Resultados filtrados',   value: filtered.length.toLocaleString('pt-BR'),      color: '#1E6BB8' },
          { label: 'Desocupados',            value: allProperties.filter(p => p.occupationStatus === 'VACANT').length.toLocaleString('pt-BR'), color: '#2ECC71' },
          { label: 'Salvos',                 value: savedIds.size, color: '#FFD700' },
        ].map((stat) => (
          <div key={stat.label} style={{ backgroundColor: 'white', borderRadius: '10px', padding: '0.875rem 1rem', boxShadow: '0 1px 6px rgba(10,46,80,0.07)', borderLeft: `4px solid ${stat.color}` }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: stat.color, fontFamily: 'var(--font-montserrat, Montserrat, sans-serif)' }}>{stat.value}</div>
            <div style={{ fontSize: '0.75rem', color: '#666', marginTop: '0.125rem' }}>{stat.label}</div>
          </div>
        ))}
      </div>

      {/* ── Filters ───────────────────────────────────────── */}
      <PropertyFiltersComponent filters={filters} onChange={handleFilterChange} total={filtered.length} modalities={availableModalities} />

      {/* ── Loading state ─────────────────────────────────── */}
      {loadingDB && (
        <div style={{ textAlign: 'center', padding: '4rem 2rem' }}>
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          <div style={{ width: '40px', height: '40px', borderRadius: '50%', border: '4px solid #1E6BB8', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite', margin: '0 auto 1rem' }} />
          <p style={{ color: '#666', fontSize: '0.875rem' }}>Carregando imóveis...</p>
        </div>
      )}

      {/* ── Map view ──────────────────────────────────────── */}
      {!loadingDB && viewMode === 'map' && MapView && (
        <div style={{ height: '520px', marginBottom: '1.5rem', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 2px 12px rgba(10,46,80,0.1)' }}>
          <MapView properties={filtered} />
        </div>
      )}

      {/* ── Grid view ─────────────────────────────────────── */}
      {!loadingDB && viewMode === 'grid' && (
        allProperties.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '4rem 2rem', backgroundColor: 'white', borderRadius: '12px' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📂</div>
            <h3 style={{ color: '#0A2E50', marginBottom: '0.5rem' }}>Nenhum imóvel importado</h3>
            <p style={{ color: '#666', fontSize: '0.875rem', marginBottom: '1.5rem' }}>Importe o arquivo CSV da Caixa para começar.</p>
            <Link href="/gestao/importar" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1.5rem', borderRadius: '8px', backgroundColor: '#1E6BB8', color: 'white', fontWeight: 700, fontSize: '0.875rem', textDecoration: 'none' }}>
              <Upload size={16} /> Importar agora
            </Link>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '4rem 2rem', backgroundColor: 'white', borderRadius: '12px' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔍</div>
            <h3 style={{ color: '#0A2E50', marginBottom: '0.5rem' }}>Nenhum imóvel encontrado</h3>
            <p style={{ color: '#666', fontSize: '0.875rem' }}>Tente ajustar os filtros.</p>
          </div>
        ) : isFree ? (
          <>
            {/* FREE: show first FREE_LIMIT cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.25rem' }}>
              {filtered.slice(0, FREE_LIMIT).map((property) => (
                <PropertyCard key={property.id} property={property} isSaved={savedIds.has(property.id)} onSave={handleSave} />
              ))}
            </div>

            {/* Teaser: 3 blurred ghost cards + CTA overlay */}
            {filtered.length > FREE_LIMIT && (
              <div style={{ position: 'relative', marginTop: '1.25rem' }}>
                {/* Blurred ghost cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.25rem', filter: 'blur(6px)', opacity: 0.45, pointerEvents: 'none', userSelect: 'none' }}>
                  {filtered.slice(FREE_LIMIT, FREE_LIMIT + 3).map((property) => (
                    <PropertyCard key={property.id} property={property} />
                  ))}
                </div>

                {/* CTA overlay */}
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
                  <div style={{ backgroundColor: 'white', borderRadius: '20px', padding: '2.5rem 2rem', textAlign: 'center', maxWidth: '520px', width: '100%', boxShadow: '0 16px 48px rgba(10,46,80,0.18)', border: '2px solid rgba(255,215,0,0.4)' }}>
                    <div style={{ width: '60px', height: '60px', borderRadius: '50%', backgroundColor: '#0A2E50', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem' }}>
                      <Lock size={28} color="#FFD700" />
                    </div>
                    <h2 style={{ fontFamily: 'var(--font-montserrat, Montserrat, sans-serif)', fontSize: '1.3rem', fontWeight: 800, color: '#0A2E50', margin: '0 0 0.5rem' }}>
                      Mais {(filtered.length - FREE_LIMIT).toLocaleString('pt-BR')} imóveis disponíveis
                    </h2>
                    <p style={{ color: '#666', fontSize: '0.9rem', margin: '0 0 1.5rem', lineHeight: 1.6 }}>
                      Você está vendo apenas <strong>{FREE_LIMIT}</strong> de <strong>{filtered.length.toLocaleString('pt-BR')}</strong> oportunidades. Assine o plano Premium e tenha acesso completo.
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.75rem', textAlign: 'left' }}>
                      {[
                        'Acesso a todas as oportunidades do banco de dados',
                        'Filtros avançados por estado, banco, modalidade e mais',
                        'Análise completa por Especialista por imóvel',
                        'Calculadora com múltiplos cenários financeiros',
                        'Checklist completo pré e pós-arrematação',
                      ].map((feat) => (
                        <div key={feat} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.625rem', fontSize: '0.85rem', color: '#444' }}>
                          <span style={{ color: '#2ECC71', fontWeight: 800, flexShrink: 0, marginTop: '1px' }}>✓</span>
                          {feat}
                        </div>
                      ))}
                    </div>
                    <Link
                      href="/dashboard/perfil"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.875rem 2rem', borderRadius: '10px', backgroundColor: '#FFD700', color: '#0A2E50', fontWeight: 800, fontSize: '1rem', textDecoration: 'none', fontFamily: 'var(--font-montserrat, Montserrat, sans-serif)', boxShadow: '0 4px 16px rgba(255,215,0,0.4)' }}
                    >
                      Assinar Premium — Acesso Completo →
                    </Link>
                    <p style={{ marginTop: '0.75rem', fontSize: '0.75rem', color: '#aaa' }}>Sem fidelidade · Cancele quando quiser</p>
                  </div>
                </div>
              </div>
            )}
          </>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.25rem' }}>
              {visible.map((property) => (
                <PropertyCard key={property.id} property={property} isSaved={savedIds.has(property.id)} onSave={handleSave} />
              ))}
            </div>

            {/* Load more */}
            {visibleCount < filtered.length && (
              <div style={{ textAlign: 'center', marginTop: '2rem' }}>
                <p style={{ color: '#888', fontSize: '0.8rem', marginBottom: '0.75rem' }}>
                  Exibindo {visible.length.toLocaleString('pt-BR')} de {filtered.length.toLocaleString('pt-BR')} imóveis
                </p>
                <button
                  onClick={() => setVisibleCount((n) => n + PAGE_SIZE)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 2rem', borderRadius: '8px', border: '2px solid #1E6BB8', backgroundColor: 'white', color: '#1E6BB8', fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer', fontFamily: 'var(--font-montserrat, Montserrat, sans-serif)' }}
                >
                  <ChevronDown size={16} /> Carregar mais {PAGE_SIZE}
                </button>
              </div>
            )}
          </>
        )
      )}
    </div>
  );
}
