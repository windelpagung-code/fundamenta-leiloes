'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { MapPin, Calendar, Building2, Bookmark, BookmarkCheck, TrendingUp, ExternalLink, Loader2, Gavel, Check } from 'lucide-react';
import { Property, PROPERTY_TYPE_LABELS, OCCUPATION_STATUS_LABELS } from '@/types/property';
import { formatCurrency, formatDate, daysUntilAuction } from '@/lib/utils';
import { updatePropertyDate } from '@/lib/propertyStorage';

interface PropertyCardProps {
  property: Property;
  isSaved?: boolean;
  onSave?: (id: string) => void;
}

const occupationColors = {
  VACANT:  { bg: 'rgba(46,204,113,0.12)',  color: '#27ae60' },
  OCCUPIED:{ bg: 'rgba(231,76,60,0.12)',   color: '#c0392b' },
  UNKNOWN: { bg: 'rgba(153,153,153,0.12)', color: '#666'    },
};

const PAYMENT_COLORS: Record<string, { bg: string; color: string }> = {
  'À Vista':      { bg: 'rgba(46,204,113,0.12)',  color: '#1e8449' },
  'FGTS':         { bg: 'rgba(30,107,184,0.12)',  color: '#1a5276' },
  'Financiamento':{ bg: 'rgba(30,107,184,0.10)',  color: '#1E6BB8' },
  'Parcelamento': { bg: 'rgba(243,156,18,0.12)',  color: '#9a6200' },
  'default':      { bg: 'rgba(153,153,153,0.12)', color: '#555'    },
};

function getPaymentMethods(property: { paymentMethods?: string[]; sourceBank?: string; auction?: { modalidade?: string } }): string[] {
  if (property.paymentMethods && property.paymentMethods.length > 0) return property.paymentMethods;
  const bank = (property.sourceBank ?? '').toLowerCase();
  const modalidade = (property.auction?.modalidade ?? '').toLowerCase();
  const isDirect = ['venda direta', 'compra direta', 'venda online'].some((m) => modalidade.includes(m));
  if (bank.includes('caixa')) return ['À Vista', 'FGTS', 'Financiamento'];
  if (bank.includes('brasil') || bank.includes('bb')) return ['À Vista', 'Financiamento'];
  if (isDirect) return ['À Vista', 'Parcelamento'];
  if (bank.includes('itaú') || bank.includes('bradesco') || bank.includes('santander') || bank.includes('btg')) return ['À Vista'];
  return ['À Vista'];
}

// Derive the direct Caixa photo URL from the property registration number
function caixaPhotoUrl(registrationNumber: string): string {
  return `https://venda-imoveis.caixa.gov.br/fotos/F${registrationNumber}21.jpg`;
}

export default function PropertyCard({ property, isSaved = false, onSave }: PropertyCardProps) {
  const isCaixa = property.id.startsWith('caixa-') && !!property.registrationNumber;

  // Photo: explicit mainImage first, then derived Caixa URL, else null
  const initialPhoto = property.mainImage
    || (isCaixa ? caixaPhotoUrl(property.registrationNumber!) : null);

  const [photo, setPhoto] = useState<string | null>(initialPhoto);
  const [arrematado, setArrematado] = useState(false);

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('fundamenta_arrematacoes') || '[]');
      setArrematado(stored.some((e: { propertyId: string }) => e.propertyId === property.id));
    } catch { /* ignore */ }
  }, [property.id]);

  function handleArrematou() {
    try {
      const stored = JSON.parse(localStorage.getItem('fundamenta_arrematacoes') || '[]');
      if (stored.some((e: { propertyId: string }) => e.propertyId === property.id)) {
        setArrematado(true);
        return;
      }
      const entry = {
        id: `arr-${Date.now()}`,
        propertyId: property.id,
        property: {
          title: property.title,
          address: property.address || '',
          city: property.city,
          state: property.state,
          mainImage: property.mainImage || null,
          propertyType: property.propertyType,
        },
        evictionStatus: property.occupationStatus === 'OCCUPIED' ? 'PENDING' : 'COMPLETED',
        acquiredAt: new Date().toISOString(),
        acquiredValue: property.initialBid,
        targetSaleValue: Math.round(property.marketValue * 1.05),
        actualEvictionCosts: property.occupationStatus === 'OCCUPIED' ? 15000 : 0,
        actualDocumentationCosts: Math.round(property.initialBid * 0.04),
        actualRenovationCosts: 0,
        notes: '',
        renovationLog: [],
        documents: [],
      };
      localStorage.setItem('fundamenta_arrematacoes', JSON.stringify([...stored, entry]));
      setArrematado(true);
    } catch { /* ignore */ }
  }

  // Auction date — may be empty on import; fetch lazily from Caixa detail page
  const [fetchedDate, setFetchedDate]         = useState<string | null>(null);
  const [fetchedTime, setFetchedTime]         = useState<string | null>(null);
  const [fetchingDate, setFetchingDate]       = useState(false);
  const [fetchedPayments, setFetchedPayments] = useState<string[] | null>(null);

  // Modalidades sem leilão programado — disponíveis para compra a qualquer momento
  const DIRECT_SALE_MODALITIES = [
    'compra direta', 'venda direta', 'venda online', 'venda direta online',
  ];
  const modalidade = (property.auction?.modalidade ?? '').toLowerCase();
  const isDirectSale = DIRECT_SALE_MODALITIES.some((m) => modalidade.includes(m));

  // An auctionDate with 'T' is an ISO datetime artifact from an old import
  // (e.g. "2025-03-24T10:30:45.123Z"). Treat it as missing and re-fetch.
  const dateIsArtifact   = property.auctionDate?.includes('T') ?? false;
  const needsDateFetch   = !isDirectSale && (!property.auctionDate || dateIsArtifact) && !!property.registrationNumber;
  // Fetch payment methods for any Caixa property that doesn't have them yet,
  // even if the date is already known (imported from CSV).
  const needsPaymentFetch = isCaixa && !property.paymentMethods?.length && !!property.registrationNumber && !needsDateFetch;

  // Date fetch (also picks up payment methods as a bonus)
  useEffect(() => {
    if (!needsDateFetch) return;
    let cancelled = false;
    setFetchingDate(true);
    fetch(`/api/caixa-date?numero=${encodeURIComponent(property.registrationNumber!)}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data.paymentMethods?.length) setFetchedPayments(data.paymentMethods);
        if (data.found) {
          setFetchedDate(data.auctionDate);
          setFetchedTime(data.auctionTime ?? null);
          updatePropertyDate(property.id, data.auctionDate, data.auctionTime, data.areaTotal ?? null, data.areaPrivate ?? null, data.paymentMethods ?? null).catch(() => {});
        } else if (data.areaTotal || data.areaPrivate || data.paymentMethods?.length) {
          updatePropertyDate(property.id, property.auctionDate ?? '', property.auctionTime, data.areaTotal ?? null, data.areaPrivate ?? null, data.paymentMethods ?? null).catch(() => {});
        }
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setFetchingDate(false); });
    return () => { cancelled = true; };
  }, [needsDateFetch, property.registrationNumber]);

  // Dedicated payment-method fetch for properties that already have a date
  useEffect(() => {
    if (!needsPaymentFetch) return;
    let cancelled = false;
    fetch(`/api/caixa-date?numero=${encodeURIComponent(property.registrationNumber!)}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data.paymentMethods?.length) {
          setFetchedPayments(data.paymentMethods);
          updatePropertyDate(property.id, property.auctionDate ?? '', property.auctionTime, data.areaTotal ?? null, data.areaPrivate ?? null, data.paymentMethods).catch(() => {});
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [needsPaymentFetch, property.registrationNumber]);

  const effectiveDate = (!property.auctionDate || dateIsArtifact) ? (fetchedDate ?? '') : property.auctionDate;
  const effectiveTime = dateIsArtifact ? (fetchedTime ?? undefined) : (property.auctionTime || fetchedTime || undefined);

  const hasDate  = !!effectiveDate;
  const days     = hasDate ? daysUntilAuction(effectiveDate) : NaN;
  const isUrgent = !isNaN(days) && days <= 7 && days >= 0;
  const isPast   = !isNaN(days) && days < 0;
  const ocColor  = occupationColors[property.occupationStatus];

  const caixaDetailLink = property.auction?.auctioneerWebsite || null;

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>

      {/* ── Image ─────────────────────────────────────────── */}
      <div style={{ position: 'relative', height: '200px', overflow: 'hidden', backgroundColor: '#e8edf2' }}>
        {photo ? (
          <Image
            src={photo}
            alt={property.title}
            fill
            loading="lazy"
            unoptimized
            style={{ objectFit: 'cover' }}
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            onError={() => setPhoto(null)}
          />
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <Building2 size={48} color="#ccc" />
          </div>
        )}

        {/* Discount badge */}
        <div className="discount-badge" style={{ position: 'absolute', top: '12px', left: '12px' }}>
          -{Math.min(90, property.discountPercentage).toFixed(0)}% OFF
        </div>

        {/* Save button */}
        {onSave && (
          <button
            onClick={() => onSave(property.id)}
            style={{
              position: 'absolute', top: '10px', right: '10px',
              background: 'rgba(255,255,255,0.9)', border: 'none', borderRadius: '50%',
              width: '36px', height: '36px', display: 'flex', alignItems: 'center',
              justifyContent: 'center', cursor: 'pointer',
              color: isSaved ? '#1E6BB8' : '#999', transition: 'all 0.2s',
              boxShadow: '0 1px 4px rgba(0,0,0,0.15)',
            }}
            title={isSaved ? 'Remover dos salvos' : 'Salvar imóvel'}
          >
            {isSaved ? <BookmarkCheck size={18} /> : <Bookmark size={18} />}
          </button>
        )}

        {/* Property type badge */}
        <div style={{
          position: 'absolute', bottom: '10px', right: '10px',
          backgroundColor: 'rgba(10,46,80,0.85)', color: 'white',
          padding: '0.2rem 0.6rem', borderRadius: '6px',
          fontSize: '0.75rem', fontWeight: 600,
          fontFamily: 'var(--font-montserrat, Montserrat, sans-serif)',
        }}>
          {PROPERTY_TYPE_LABELS[property.propertyType]}
        </div>

        {/* Modalidade badge */}
        {property.auction?.modalidade && (
          <div style={{
            position: 'absolute', bottom: '10px', left: '10px',
            backgroundColor: 'rgba(30,107,184,0.85)', color: 'white',
            padding: '0.2rem 0.55rem', borderRadius: '6px',
            fontSize: '0.68rem', fontWeight: 700,
            fontFamily: 'var(--font-montserrat, Montserrat, sans-serif)',
          }}>
            {property.auction.modalidade}
          </div>
        )}
      </div>

      {/* ── Content ───────────────────────────────────────── */}
      <div style={{ padding: '1rem', flex: 1, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>

        {/* Title */}
        <h3 style={{
          fontFamily: 'var(--font-montserrat, Montserrat, sans-serif)',
          fontSize: '0.95rem', fontWeight: 700, color: '#0A2E50', margin: 0,
          lineHeight: 1.3, display: '-webkit-box',
          WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}>
          {property.title}
        </h3>

        {/* Location */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', color: '#666', fontSize: '0.825rem' }}>
          <MapPin size={14} style={{ flexShrink: 0, color: '#1E6BB8' }} />
          <span>{property.city}/{property.state}</span>
          {property.areaTotal && (
            <span style={{ marginLeft: 'auto', fontWeight: 600, color: '#0A2E50', fontSize: '0.8rem' }}>
              {property.areaTotal.toLocaleString('pt-BR')} m²
            </span>
          )}
        </div>

        {/* Values */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', color: '#999' }}>Lance inicial</span>
            <span style={{ fontFamily: 'var(--font-montserrat, Montserrat, sans-serif)', fontSize: '1.1rem', fontWeight: 700, color: '#1E6BB8' }}>
              {formatCurrency(property.initialBid)}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', color: '#999' }}>Valor de mercado</span>
            <span style={{ fontSize: '0.825rem', color: '#666', textDecoration: 'line-through' }}>
              {formatCurrency(property.marketValue)}
            </span>
          </div>
        </div>

        {/* ROI estimate */}
        {(() => {
          // Cap discount at 90% to avoid absurd ROI from bad data
          const safeDiscount = Math.min(90, property.discountPercentage);
          const roi = safeDiscount * 0.65; // conservative ROI estimate from discount
          const { bg, color, label } =
            roi < 0    ? { bg: 'rgba(231,76,60,0.10)',   color: '#c0392b', label: 'Prejuízo potencial' } :
            roi < 10   ? { bg: 'rgba(230,126,34,0.10)',  color: '#d35400', label: 'ROI estimado' } :
            roi < 25   ? { bg: 'rgba(241,196,15,0.12)',  color: '#9a7d0a', label: 'ROI estimado' } :
            roi < 50   ? { bg: 'rgba(46,204,113,0.10)',  color: '#27ae60', label: 'ROI estimado' } :
                         { bg: 'rgba(30,107,184,0.10)',  color: '#1E6BB8', label: 'ROI estimado' };
          return (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '0.375rem',
              padding: '0.4rem 0.6rem', backgroundColor: bg,
              borderRadius: '6px', color, fontSize: '0.8rem', fontWeight: 600,
            }}>
              <TrendingUp size={14} />
              <span>{label}: ~{roi.toFixed(0)}%</span>
            </div>
          );
        })()}

        {/* Tags row */}
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <span className="badge" style={{ backgroundColor: ocColor.bg, color: ocColor.color, fontSize: '0.7rem' }}>
            {OCCUPATION_STATUS_LABELS[property.occupationStatus]}
          </span>
          {property.sourceBank && (
            <span className="badge badge-info" style={{ fontSize: '0.7rem' }}>
              {property.sourceBank.split(' ')[0]}
            </span>
          )}
        </div>

        {/* Payment methods row */}
        {(() => {
          // Priority: persisted on property > freshly fetched > derived (non-Caixa fallback)
          const methods = property.paymentMethods?.length
            ? property.paymentMethods
            : fetchedPayments?.length
              ? fetchedPayments
              : isCaixa
                ? null   // Caixa: wait for real data, show nothing until fetched
                : getPaymentMethods(property);
          if (!methods) return null;
          return (
            <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: '0.68rem', color: '#999', fontWeight: 600, letterSpacing: '0.02em', textTransform: 'uppercase' }}>Pagamento:</span>
              {methods.map((m) => {
                const s = PAYMENT_COLORS[m] ?? PAYMENT_COLORS['default'];
                return (
                  <span key={m} style={{ display: 'inline-flex', alignItems: 'center', padding: '0.2rem 0.5rem', borderRadius: '5px', fontSize: '0.7rem', fontWeight: 700, backgroundColor: s.bg, color: s.color, border: `1px solid ${s.color}30` }}>
                    {m}
                  </span>
                );
              })}
            </div>
          );
        })()}

        {/* Auction date / availability */}
        {isDirectSale ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.75rem', backgroundColor: 'rgba(46,204,113,0.07)', borderRadius: '8px', borderLeft: '3px solid #27ae60' }}>
            <Calendar size={14} style={{ color: '#27ae60', flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '0.75rem', color: '#666' }}>Disponibilidade</div>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#27ae60' }}>Disponível para compra</div>
            </div>
            {caixaDetailLink && (
              <a href={caixaDetailLink} target="_blank" rel="noopener noreferrer"
                style={{ fontSize: '0.7rem', color: '#1E6BB8', fontWeight: 700, textDecoration: 'none', whiteSpace: 'nowrap' }}>
                Ver site ↗
              </a>
            )}
          </div>
        ) : hasDate ? (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '0.5rem',
            padding: '0.5rem 0.75rem',
            backgroundColor: isPast ? 'rgba(153,153,153,0.1)' : isUrgent ? 'rgba(231,76,60,0.08)' : 'rgba(10,46,80,0.06)',
            borderRadius: '8px',
            borderLeft: `3px solid ${isPast ? '#999' : isUrgent ? '#e74c3c' : '#0A2E50'}`,
          }}>
            <Calendar size={14} style={{ color: isPast ? '#999' : isUrgent ? '#e74c3c' : '#0A2E50', flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '0.75rem', color: '#666' }}>
                {property.auction?.modalidade ?? 'Data do leilão'}
              </div>
              <div style={{ fontSize: '0.825rem', fontWeight: 700, color: isPast ? '#999' : isUrgent ? '#e74c3c' : '#0A2E50', fontFamily: 'var(--font-montserrat, Montserrat, sans-serif)' }}>
                {formatDate(effectiveDate)}
                {effectiveTime && ` às ${effectiveTime}`}
              </div>
            </div>
            {!isPast && !isNaN(days) && (
              <span style={{ fontSize: '0.7rem', fontWeight: 700, color: isUrgent ? '#e74c3c' : '#0A2E50' }}>
                {days === 0 ? 'HOJE' : `${days}d`}
              </span>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.75rem', backgroundColor: 'rgba(153,153,153,0.07)', borderRadius: '8px', borderLeft: '3px solid #ccc' }}>
            {fetchingDate ? (
              <Loader2 size={14} style={{ color: '#1E6BB8', flexShrink: 0, animation: 'spin 1s linear infinite' }} />
            ) : (
              <Calendar size={14} style={{ color: '#aaa', flexShrink: 0 }} />
            )}
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '0.75rem', color: '#999' }}>Data do leilão</div>
              <div style={{ fontSize: '0.8rem', color: '#aaa', fontStyle: 'italic' }}>
                {fetchingDate ? 'Buscando data...' : 'Não encontrada'}
              </div>
            </div>
            {!fetchingDate && caixaDetailLink && (
              <a href={caixaDetailLink} target="_blank" rel="noopener noreferrer"
                style={{ fontSize: '0.7rem', color: '#1E6BB8', fontWeight: 700, textDecoration: 'none', whiteSpace: 'nowrap' }}>
                Ver site ↗
              </a>
            )}
          </div>
        )}

        {/* CTAs */}
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <Link
            href={`/dashboard/analise/${property.id}`}
            className="btn-primary"
            style={{ flex: 1, justifyContent: 'center', fontSize: '0.875rem', padding: '0.625rem 1rem' }}
          >
            Analisar
          </Link>
          <button
            onClick={handleArrematou}
            title={arrematado ? 'Já adicionado às arrematações' : 'Registrar como arrematado'}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem',
              padding: '0.625rem 0.75rem', borderRadius: '8px', border: '2px solid',
              borderColor: arrematado ? '#2ECC71' : '#e0e0e0',
              backgroundColor: arrematado ? 'rgba(46,204,113,0.08)' : 'white',
              color: arrematado ? '#27ae60' : '#666',
              cursor: arrematado ? 'default' : 'pointer',
              fontSize: '0.75rem', fontWeight: 600, flexShrink: 0,
              transition: 'all 0.2s',
            }}
          >
            {arrematado ? <Check size={14} /> : <Gavel size={14} />}
          </button>
          {caixaDetailLink && (
            <a
              href={caixaDetailLink}
              target="_blank"
              rel="noopener noreferrer"
              title="Ver no site da Caixa"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: '38px', borderRadius: '8px', border: '2px solid #e0e0e0',
                backgroundColor: 'white', color: '#666', textDecoration: 'none',
                flexShrink: 0, transition: 'border-color 0.2s',
              }}
            >
              <ExternalLink size={15} />
            </a>
          )}
        </div>

      </div>
    </div>
  );
}
