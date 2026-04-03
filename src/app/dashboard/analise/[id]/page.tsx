'use client';

import { useEffect, useState, use, useRef, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useSession } from 'next-auth/react';
import {
  ArrowLeft, MapPin, Calendar, Home, Building2,
  AlertTriangle, FileText, CheckCircle, XCircle,
  HelpCircle, ExternalLink, Sparkles, BookOpen, Landmark, Link2,
  Gavel, Check, Lock,
} from 'lucide-react';
import { getPropertyById } from '@/lib/propertyStorage';
import { Property, PROPERTY_TYPE_LABELS, OCCUPATION_STATUS_LABELS } from '@/types/property';
import { formatCurrency, formatDate } from '@/lib/utils';
import FinancialCalculator from '@/components/financial/FinancialCalculator';
import PropertyChecklist from '@/components/checklist/PropertyChecklist';

type AnalysisState = 'idle' | 'loading' | 'done' | 'error';
interface AnalysisData {
  analysisHtml: string;
  riskLevel: string;
  cached: boolean;
}

const ANALYSIS_STEPS = [
  'Acessando dados do imóvel na Caixa Econômica Federal...',
  'Verificando matrícula e documentação registral...',
  'Lendo condições e restrições do edital...',
  'Pesquisando imóveis similares no ZAP Imóveis...',
  'Consultando anúncios no Viva Real e OLX...',
  'Calculando preço médio por m² da região...',
  'Avaliando ônus, gravames e pendências jurídicas...',
  'Calculando ITBI, honorários e custos totais de aquisição...',
  'Projetando cenários de retorno sobre investimento...',
  'Analisando localização e potencial de valorização...',
  'Elaborando parecer da equipe Fundamenta...',
  'Finalizando laudo técnico completo...',
];

interface Props {
  params: Promise<{ id: string }>;
}

function caixaPhotoUrl(registrationNumber: string) {
  return `https://venda-imoveis.caixa.gov.br/fotos/F${registrationNumber}21.jpg`;
}

export default function AnalysisPage({ params }: Props) {
  const { id } = use(params);
  const { data: session } = useSession();
  const isFree = session?.user?.plan === 'FREE';
  const [property, setProperty] = useState<Property | null | undefined>(undefined);
  const [analysisState, setAnalysisState] = useState<AnalysisState>('idle');
  const [analysisData, setAnalysisData] = useState<AnalysisData | null>(null);
  const [analysisError, setAnalysisError] = useState<string>('');
  const [displayedHtml, setDisplayedHtml] = useState<string>('');
  const [currentStep, setCurrentStep] = useState(0);
  const [arrematado, setArrematado] = useState(false);
  const [arrematarModal, setArrematarModal] = useState<{
    uncheckedTotal: number;
    criticalUnchecked: { id: string; label: string }[];
  } | null>(null);
  const typewriterRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stepTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const runTypewriter = useCallback((html: string) => {
    let i = 0;
    setDisplayedHtml('');
    const step = () => {
      if (i <= html.length) {
        setDisplayedHtml(html.slice(0, i));
        i++;
        typewriterRef.current = setTimeout(step, 2);
      }
    };
    step();
  }, []);

  useEffect(() => {
    return () => {
      if (typewriterRef.current) clearTimeout(typewriterRef.current);
      if (stepTimerRef.current) clearInterval(stepTimerRef.current);
    };
  }, []);

  // Advance loading steps while analysisState === 'loading'
  useEffect(() => {
    if (analysisState !== 'loading') {
      if (stepTimerRef.current) clearInterval(stepTimerRef.current);
      return;
    }
    setCurrentStep(0);
    stepTimerRef.current = setInterval(() => {
      setCurrentStep((prev) => {
        if (prev < ANALYSIS_STEPS.length - 1) return prev + 1;
        clearInterval(stepTimerRef.current!);
        return prev;
      });
    }, 4500);
    return () => { if (stepTimerRef.current) clearInterval(stepTimerRef.current); };
  }, [analysisState]);

  const startAnalysis = useCallback(async () => {
    if (!property?.registrationNumber) return;
    setAnalysisState('loading');
    setAnalysisError('');
    setAnalysisData(null);
    setDisplayedHtml('');
    try {
      const res = await fetch('/api/analise-imovel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(120_000), // 2 min — laudo completo pode demorar
        body: JSON.stringify({
          registrationNumber: property.registrationNumber,
          uf: property.state,
          propertyData: property,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Erro ao gerar análise.');
      }
      // Se veio do cache (resposta instantânea), manter o spinner por pelo menos 2s
      // para não parecer que foi buscar dados prontos
      if (data.cached) {
        await new Promise((r) => setTimeout(r, 2000));
      }
      setAnalysisData(data);
      setAnalysisState('done');
      if (data.cached) {
        runTypewriter(data.analysisHtml);
      } else {
        setDisplayedHtml(data.analysisHtml);
      }
      // Persist to analysis history in localStorage
      try {
        const record = {
          id: `ana-${Date.now()}`,
          propertyId: property.id,
          title: property.title,
          address: property.address || '',
          city: property.city,
          state: property.state,
          mainImage: property.mainImage || null,
          riskLevel: data.riskLevel,
          analyzedAt: new Date().toISOString(),
        };
        const stored: unknown[] = JSON.parse(localStorage.getItem('fundamenta_ai_analyses') || '[]');
        const filtered = stored.filter((a) => (a as { propertyId: string }).propertyId !== property.id);
        localStorage.setItem('fundamenta_ai_analyses', JSON.stringify([record, ...filtered]));
      } catch { /* ignore */ }
    } catch (err) {
      setAnalysisError(err instanceof Error ? err.message : 'Erro desconhecido.');
      setAnalysisState('error');
    }
  }, [property, runTypewriter]);

  useEffect(() => {
    getPropertyById(id).then(setProperty);
  }, [id]);

  useEffect(() => {
    if (!property) return;
    try {
      const saved = JSON.parse(localStorage.getItem('fundamenta_arrematacoes') || '[]');
      setArrematado(saved.some((a: { propertyId: string }) => a.propertyId === property.id));
    } catch { /* ignore */ }
  }, [property]);

  // All PRE checklist critical + warning items used for the arrematação gate check
  const PRE_ITEMS_FOR_CHECK = [
    { id: 'e1', label: 'Li o edital completo do leilão', critical: true },
    { id: 'e3', label: 'Entendi as condições e prazo de pagamento após arrematação', critical: true },
    { id: 'j1', label: 'Consultei a matrícula do imóvel no Cartório de Registro de Imóveis', critical: true },
    { id: 'j2', label: 'Verifiquei ônus, penhoras, hipotecas e gravames na matrícula', critical: true },
    { id: 'j5', label: 'Confirmei e entendo o status de ocupação do imóvel', critical: true },
    { id: 'f3', label: 'Defini meu lance máximo e comprometo-me a não ultrapassá-lo', critical: true },
    { id: 'f4', label: 'Tenho capital disponível para o pagamento dentro do prazo exigido', critical: true },
    { id: 'i1', label: 'Localizei e identifiquei o imóvel fisicamente (mapa, Street View)', critical: false },
    { id: 'j3', label: 'Pesquisei débitos de IPTU junto à prefeitura municipal', critical: false },
    { id: 'j4', label: 'Pesquisei débitos de condomínio (se imóvel em condomínio)', critical: false },
    { id: 'f1', label: 'Calculei todos os custos: ITBI, cartório, comissão leiloeiro', critical: false },
    { id: 'e2', label: 'Anotei a data, horário e plataforma/local do leilão', critical: false },
    { id: 'e4', label: 'Verifiquei a modalidade: 1ª ou 2ª praça e o valor mínimo de lance', critical: false },
    { id: 'i2', label: 'Verifiquei o estado geral do imóvel (fotos, vistoria externa)', critical: false },
    { id: 'i3', label: 'Estimei o custo de reforma necessária', critical: false },
    { id: 'i4', label: 'Confirmei área real, número de quartos e características', critical: false },
    { id: 'i5', label: 'Pesquisei preços de imóveis similares na região', critical: false },
    { id: 'j6', label: 'Consultei ou fui orientado por advogado especializado em leilões', critical: false },
    { id: 'f2', label: 'Incluí custo de desocupação no planejamento (se imóvel ocupado)', critical: false },
    { id: 'f5', label: 'Analisei o ROI na calculadora de viabilidade e aprovei a operação', critical: false },
  ];

  function confirmArrematou() {
    if (!property || arrematado) return;
    try {
      const entry = {
        id: `arr-${Date.now()}`,
        propertyId: property.id,
        property: {
          title: property.title,
          address: property.address || '',
          city: property.city,
          state: property.state,
          mainImage: property.mainImage || null,
          propertyType: property.propertyType || 'HOUSE',
        },
        evictionStatus: property.occupationStatus === 'OCCUPIED' ? 'PENDING' : 'COMPLETED',
        acquiredAt: new Date().toISOString(),
        acquiredValue: property.initialBid,
        targetSaleValue: Math.round(property.marketValue * 1.05),
        actualEvictionCosts: 0,
        actualDocumentationCosts: 0,
        actualRenovationCosts: 0,
        notes: '',
        renovationLog: [],
        documents: [],
      };
      const saved = JSON.parse(localStorage.getItem('fundamenta_arrematacoes') || '[]');
      localStorage.setItem('fundamenta_arrematacoes', JSON.stringify([entry, ...saved]));
      setArrematado(true);
      setArrematarModal(null);
    } catch { /* ignore */ }
  }

  function handleArrematou() {
    if (!property || arrematado) return;
    try {
      const stored: Record<string, boolean> = JSON.parse(
        localStorage.getItem(`fundamenta_checklist_pre_${property.id}`) || '{}'
      );
      const uncheckedTotal = PRE_ITEMS_FOR_CHECK.filter((item) => !stored[item.id]).length;
      const criticalUnchecked = PRE_ITEMS_FOR_CHECK.filter((item) => item.critical && !stored[item.id]);
      if (uncheckedTotal > 0) {
        setArrematarModal({ uncheckedTotal, criticalUnchecked });
        return;
      }
    } catch { /* ignore */ }
    confirmArrematou();
  }

  /* ── Loading ──────────────────────────────────────── */
  if (property === undefined) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '50vh', flexDirection: 'column', gap: '1rem' }}>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        <div style={{ width: '40px', height: '40px', borderRadius: '50%', border: '4px solid #1E6BB8', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
        <p style={{ color: '#666', fontSize: '0.875rem' }}>Carregando imóvel...</p>
      </div>
    );
  }

  /* ── Not found ────────────────────────────────────── */
  if (!property) {
    return (
      <div style={{ maxWidth: '600px', margin: '4rem auto', textAlign: 'center', padding: '0 1.5rem' }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔍</div>
        <h2 style={{ fontFamily: 'var(--font-montserrat, Montserrat, sans-serif)', color: '#0A2E50', marginBottom: '0.5rem' }}>Imóvel não encontrado</h2>
        <p style={{ color: '#666', marginBottom: '1.5rem' }}>Este imóvel não está na base importada. Verifique se o arquivo foi importado corretamente.</p>
        <Link href="/dashboard" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1.5rem', borderRadius: '8px', backgroundColor: '#1E6BB8', color: 'white', fontWeight: 700, textDecoration: 'none' }}>
          <ArrowLeft size={16} /> Voltar ao dashboard
        </Link>
      </div>
    );
  }

  /* ── Derived values ───────────────────────────────── */
  const isCaixa    = property.id.startsWith('caixa-') && !!property.registrationNumber;
  const photoSrc   = property.mainImage || (isCaixa ? caixaPhotoUrl(property.registrationNumber!) : null);

  const officialNoticeUrl       = property.auction?.officialNoticeUrl;
  const registrationDocumentUrl = property.auction?.registrationDocumentUrl;
  const auctionPageUrl          = property.auction?.auctionWebsiteUrl;
  const auctioneerSiteUrl       = property.auction?.auctioneerWebsite;

  // Docs available for the Documents card
  const docs = [
    officialNoticeUrl       && { label: 'Edital do Leilão',    url: officialNoticeUrl,       icon: 'edital'    },
    registrationDocumentUrl && { label: 'Matrícula do Imóvel', url: registrationDocumentUrl, icon: 'matricula' },
    auctionPageUrl          && { label: 'Ver anúncio completo', url: auctionPageUrl,          icon: 'link'      },
    (!auctionPageUrl && auctioneerSiteUrl) && { label: 'Site do leiloeiro', url: auctioneerSiteUrl, icon: 'link' },
  ].filter(Boolean) as { label: string; url: string; icon: string }[];

  const occupationIcon = property.occupationStatus === 'VACANT'
    ? <CheckCircle size={16} color="#2ECC71" />
    : property.occupationStatus === 'OCCUPIED'
    ? <XCircle size={16} color="#e74c3c" />
    : <HelpCircle size={16} color="#999" />;

  const occupationColor = property.occupationStatus === 'VACANT' ? '#2ECC71'
    : property.occupationStatus === 'OCCUPIED' ? '#e74c3c' : '#999';

  /* ── Render ───────────────────────────────────────── */
  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '1.5rem 1.5rem 5rem' }}>

      {/* ── Checklist gate modal ────────────────────────── */}
      {arrematarModal && (
        <div
          onClick={() => setArrematarModal(null)}
          style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.55)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ backgroundColor: 'white', borderRadius: '16px', width: '100%', maxWidth: '500px', boxShadow: '0 24px 64px rgba(0,0,0,0.3)', overflow: 'hidden' }}
          >
            {/* Header */}
            <div style={{ backgroundColor: '#fff3cd', borderBottom: '2px solid #ffc107', padding: '1.25rem 1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <AlertTriangle size={26} color="#e67e22" />
              <div>
                <div style={{ fontFamily: 'var(--font-montserrat, Montserrat, sans-serif)', fontWeight: 800, fontSize: '1.05rem', color: '#7d4e00' }}>
                  Checklist incompleto!
                </div>
                <div style={{ fontSize: '0.82rem', color: '#8a5d00', marginTop: '0.15rem' }}>
                  {arrematarModal.uncheckedTotal} {arrematarModal.uncheckedTotal === 1 ? 'item não verificado' : 'itens não verificados'} no checklist pré-arrematação
                </div>
              </div>
            </div>

            <div style={{ padding: '1.25rem 1.5rem' }}>
              {arrematarModal.criticalUnchecked.length > 0 && (
                <div style={{ marginBottom: '1.25rem' }}>
                  <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#c0392b', marginBottom: '0.6rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <XCircle size={15} /> {arrematarModal.criticalUnchecked.length} {arrematarModal.criticalUnchecked.length === 1 ? 'item CRÍTICO pendente' : 'itens CRÍTICOS pendentes'}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    {arrematarModal.criticalUnchecked.map((item) => (
                      <div key={item.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', padding: '0.5rem 0.75rem', backgroundColor: 'rgba(231,76,60,0.06)', borderRadius: '8px', borderLeft: '3px solid #e74c3c' }}>
                        <XCircle size={14} color="#e74c3c" style={{ marginTop: '1px', flexShrink: 0 }} />
                        <span style={{ fontSize: '0.825rem', color: '#555', lineHeight: 1.4 }}>{item.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <p style={{ fontSize: '0.85rem', color: '#666', margin: '0 0 1.5rem', lineHeight: 1.6 }}>
                Itens não verificados aumentam o risco da operação. Recomendamos que você revise o checklist antes de confirmar a arrematação.
                <br />
                <strong style={{ color: '#0A2E50' }}>Deseja continuar mesmo assim?</strong>
              </p>

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                <button
                  onClick={() => setArrematarModal(null)}
                  style={{ padding: '0.65rem 1.25rem', borderRadius: '9px', border: '2px solid #1E6BB8', backgroundColor: 'white', color: '#1E6BB8', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                >
                  <ArrowLeft size={15} /> Revisar checklist
                </button>
                <button
                  onClick={confirmArrematou}
                  style={{ padding: '0.65rem 1.25rem', borderRadius: '9px', border: 'none', backgroundColor: '#0A2E50', color: 'white', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                >
                  <Gavel size={15} /> Confirmar arrematação
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Breadcrumb */}
      <div style={{ marginBottom: '1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
        <Link href="/dashboard" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', color: '#1E6BB8', textDecoration: 'none', fontWeight: 600, fontSize: '0.875rem' }}>
          <ArrowLeft size={16} /> Voltar para oportunidades
        </Link>
        {(auctionPageUrl || auctioneerSiteUrl) && (
          <a href={auctionPageUrl || auctioneerSiteUrl} target="_blank" rel="noopener noreferrer"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', color: '#1E6BB8', textDecoration: 'none', fontWeight: 600, fontSize: '0.8rem', border: '1.5px solid #1E6BB8', borderRadius: '7px', padding: '0.35rem 0.75rem' }}>
            Ver anúncio <ExternalLink size={13} />
          </a>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.5rem' }}>

        {/* ── Property header ───────────────────────── */}
        <div style={{ backgroundColor: 'white', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(10,46,80,0.08)' }}>
          <div style={{ position: 'relative', height: '320px', backgroundColor: '#e8edf2' }}>
            {photoSrc ? (
              <Image
                src={photoSrc}
                alt={property.title}
                fill
                unoptimized
                style={{ objectFit: 'cover' }}
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                <Building2 size={64} color="#ccc" />
              </div>
            )}
            <div style={{ position: 'absolute', top: '16px', left: '16px', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <span className="discount-badge" style={{ fontSize: '0.875rem' }}>
                -{property.discountPercentage.toFixed(0)}% OFF
              </span>
              <span className="badge badge-info" style={{ backgroundColor: 'rgba(10,46,80,0.85)', color: 'white' }}>
                {PROPERTY_TYPE_LABELS[property.propertyType]}
              </span>
              {property.auction?.modalidade && (
                <span className="badge" style={{ backgroundColor: 'rgba(30,107,184,0.85)', color: 'white' }}>
                  {property.auction.modalidade}
                </span>
              )}
            </div>
          </div>

          <div style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <h1 style={{ fontFamily: 'var(--font-montserrat, Montserrat, sans-serif)', fontSize: '1.5rem', fontWeight: 800, color: '#0A2E50', margin: '0 0 0.5rem' }}>
                  {property.title}
                </h1>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#666', fontSize: '0.875rem' }}>
                  <MapPin size={15} color="#1E6BB8" />
                  <span>{[property.address, property.city, property.state].filter(Boolean).join(', ')}</span>
                </div>
              </div>
              <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.75rem' }}>
                <div>
                  <div style={{ fontSize: '0.75rem', color: '#999', marginBottom: '0.25rem' }}>Lance inicial</div>
                  <div style={{ fontFamily: 'var(--font-montserrat, Montserrat, sans-serif)', fontSize: '2rem', fontWeight: 800, color: '#1E6BB8' }}>
                    {formatCurrency(property.initialBid)}
                  </div>
                  <div style={{ fontSize: '0.825rem', color: '#999', textDecoration: 'line-through' }}>
                    VM: {formatCurrency(property.marketValue)}
                  </div>
                </div>
                <button
                  onClick={handleArrematou}
                  disabled={arrematado}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '0.45rem',
                    padding: '0.6rem 1.25rem', borderRadius: '10px', fontWeight: 700, fontSize: '0.9rem',
                    cursor: arrematado ? 'default' : 'pointer', border: 'none',
                    backgroundColor: arrematado ? '#2ECC71' : '#0A2E50',
                    color: 'white',
                    boxShadow: arrematado ? 'none' : '0 3px 10px rgba(10,46,80,0.25)',
                    transition: 'all 0.2s',
                  }}
                >
                  {arrematado ? <Check size={16} /> : <Gavel size={16} />}
                  {arrematado ? 'Adicionado às Arrematações' : 'Arrematei este imóvel!'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ── Info grid ─────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.25rem' }}>

          {/* Property details */}
          <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '1.25rem', boxShadow: '0 2px 8px rgba(10,46,80,0.08)' }}>
            <h2 style={{ fontFamily: 'var(--font-montserrat, Montserrat, sans-serif)', fontSize: '1rem', fontWeight: 700, color: '#0A2E50', margin: '0 0 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Home size={18} /> Dados do Imóvel
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
              {[
                { label: 'Tipo',           value: PROPERTY_TYPE_LABELS[property.propertyType] },
                { label: 'Área total',     value: property.areaTotal ? `${property.areaTotal} m²` : 'Não informado' },
                { label: 'Área privativa', value: property.areaPrivate ? `${property.areaPrivate} m²` : 'Não informado' },
                { label: 'Nº do imóvel',   value: property.registrationNumber || 'Não informado' },
                { label: 'Banco',          value: property.sourceBank || 'Não informado' },
                { label: 'Leiloeiro',      value: property.sourceAuctioneer || property.auction?.auctioneerName || 'Não informado' },
              ].map((item) => (
                <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', fontSize: '0.875rem', paddingBottom: '0.5rem', borderBottom: '1px solid #f5f5f5' }}>
                  <span style={{ color: '#666' }}>{item.label}</span>
                  <span style={{ fontWeight: 600, color: '#0A2E50', textAlign: 'right' }}>{item.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Auction details */}
          <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '1.25rem', boxShadow: '0 2px 8px rgba(10,46,80,0.08)' }}>
            <h2 style={{ fontFamily: 'var(--font-montserrat, Montserrat, sans-serif)', fontSize: '1rem', fontWeight: 700, color: '#0A2E50', margin: '0 0 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Calendar size={18} /> Dados do Leilão
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ padding: '0.875rem', backgroundColor: 'rgba(10,46,80,0.05)', borderRadius: '8px', textAlign: 'center' }}>
                <div style={{ fontSize: '0.75rem', color: '#666', marginBottom: '0.25rem' }}>Data</div>
                <div style={{ fontFamily: 'var(--font-montserrat, Montserrat, sans-serif)', fontSize: '1.1rem', fontWeight: 700, color: '#0A2E50' }}>
                  {property.auctionDate && !property.auctionDate.includes('T')
                    ? `${formatDate(property.auctionDate)}${property.auctionTime ? ` às ${property.auctionTime}` : ''}`
                    : <span style={{ fontSize: '0.875rem', color: '#999', fontWeight: 400, fontStyle: 'italic' }}>Consultar site da Caixa</span>
                  }
                </div>
              </div>
              {property.auction && (
                <>
                  {[
                    { label: 'Modalidade',  value: property.auction.modalidade   || 'Não informado' },
                    { label: 'Leiloeiro',   value: property.auction.auctioneerName },
                    { label: 'Nº Leilão',   value: property.auction.auctionNumber || 'Não informado' },
                  ].map((item) => (
                    <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', paddingBottom: '0.5rem', borderBottom: '1px solid #f5f5f5' }}>
                      <span style={{ color: '#666' }}>{item.label}</span>
                      <span style={{ fontWeight: 600, color: '#0A2E50' }}>{item.value}</span>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>

          {/* Occupation */}
          <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '1.25rem', boxShadow: '0 2px 8px rgba(10,46,80,0.08)' }}>
            <h2 style={{ fontFamily: 'var(--font-montserrat, Montserrat, sans-serif)', fontSize: '1rem', fontWeight: 700, color: '#0A2E50', margin: '0 0 1rem' }}>
              Status de Ocupação
            </h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.875rem', backgroundColor: `${occupationColor}15`, borderRadius: '8px', marginBottom: '1rem' }}>
              {occupationIcon}
              <span style={{ fontWeight: 700, color: occupationColor, fontSize: '0.95rem', fontFamily: 'var(--font-montserrat, Montserrat, sans-serif)' }}>
                {OCCUPATION_STATUS_LABELS[property.occupationStatus]}
              </span>
            </div>
            {property.occupationStatus === 'OCCUPIED' && (
              <p style={{ fontSize: '0.825rem', color: '#666', lineHeight: 1.6, margin: 0 }}>
                Imóvel com ocupantes. Pode ser necessária ação judicial de reintegração de posse, com custos adicionais estimados de R$ 10.000 a R$ 30.000.
              </p>
            )}
            {property.occupationStatus === 'VACANT' && (
              <p style={{ fontSize: '0.825rem', color: '#27ae60', lineHeight: 1.6, margin: 0 }}>
                Imóvel desocupado. Menos riscos e custos adicionais. Pode ser imediatamente reformado após arrematação.
              </p>
            )}
          </div>

          {/* Documents & Links */}
          <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '1.25rem', boxShadow: '0 2px 8px rgba(10,46,80,0.08)' }}>
            <h2 style={{ fontFamily: 'var(--font-montserrat, Montserrat, sans-serif)', fontSize: '1rem', fontWeight: 700, color: '#0A2E50', margin: '0 0 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <FileText size={18} /> Documentos & Links
            </h2>

            {docs.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                {docs.map((doc) => (
                  <a
                    key={doc.url}
                    href={doc.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'flex', alignItems: 'center', gap: '0.75rem',
                      padding: '0.75rem 1rem', borderRadius: '8px',
                      border: '1.5px solid',
                      textDecoration: 'none',
                      transition: 'background 0.15s',
                      ...(doc.icon === 'edital'
                        ? { borderColor: 'rgba(30,107,184,0.35)', backgroundColor: 'rgba(30,107,184,0.04)', color: '#1E6BB8' }
                        : doc.icon === 'matricula'
                        ? { borderColor: 'rgba(46,204,113,0.35)', backgroundColor: 'rgba(46,204,113,0.04)', color: '#1a7a43' }
                        : { borderColor: 'rgba(10,46,80,0.15)', backgroundColor: 'rgba(10,46,80,0.02)', color: '#0A2E50' }),
                    }}
                  >
                    <span style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>
                      {doc.icon === 'edital'    && <BookOpen  size={17} />}
                      {doc.icon === 'matricula' && <Landmark  size={17} />}
                      {doc.icon === 'link'      && <Link2     size={17} />}
                    </span>
                    <span style={{ flex: 1, fontSize: '0.85rem', fontWeight: 600 }}>{doc.label}</span>
                    <ExternalLink size={13} style={{ flexShrink: 0, opacity: 0.6 }} />
                  </a>
                ))}
              </div>
            ) : (
              <div style={{ padding: '0.875rem', backgroundColor: 'rgba(10,46,80,0.03)', borderRadius: '8px', textAlign: 'center' }}>
                <p style={{ margin: 0, fontSize: '0.825rem', color: '#999', fontStyle: 'italic' }}>
                  Nenhum documento disponível para este imóvel.
                </p>
              </div>
            )}
          </div>

        </div>

        {/* Legal issues */}
        {property.legalIssues && property.legalIssues.length > 0 && (
          <div style={{ backgroundColor: 'rgba(231,76,60,0.06)', border: '1px solid rgba(231,76,60,0.2)', borderRadius: '12px', padding: '1.25rem' }}>
            <h2 style={{ fontFamily: 'var(--font-montserrat, Montserrat, sans-serif)', fontSize: '1rem', fontWeight: 700, color: '#c0392b', margin: '0 0 0.875rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <AlertTriangle size={18} /> Ônus e Riscos Jurídicos
            </h2>
            <ul style={{ margin: 0, paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {property.legalIssues.map((issue, i) => (
                <li key={i} style={{ fontSize: '0.875rem', color: '#c0392b' }}>{issue}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Description */}
        {property.description && (
          <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '1.25rem', boxShadow: '0 2px 8px rgba(10,46,80,0.08)' }}>
            <h2 style={{ fontFamily: 'var(--font-montserrat, Montserrat, sans-serif)', fontSize: '1rem', fontWeight: 700, color: '#0A2E50', margin: '0 0 0.875rem' }}>
              Descrição do Imóvel
            </h2>
            <p style={{ fontSize: '0.875rem', color: '#555', lineHeight: 1.7, margin: 0 }}>{property.description}</p>
          </div>
        )}

        {/* Checklist Pré-Arrematação */}
        <PropertyChecklist
          propertyId={property.id}
          type="PRE"
          occupationStatus={property.occupationStatus}
          isInCondominium={property.propertyType === 'APARTMENT'}
          basic={isFree}
        />

        {/* ROI Líquido Estimado */}
        {(() => {
          const discount = Math.min(90, property.discountPercentage);
          // Conservative: 4% documentation + 5% auction fee + 3% contingency = 12% overhead
          const overhead = property.initialBid * 0.12;
          const renovation = property.occupationStatus === 'OCCUPIED' ? 20000 : 30000;
          const sellingComm = property.marketValue * 0.06;
          const ir = Math.max(0, (property.marketValue - property.initialBid - overhead - renovation)) * 0.15;
          const netProfit = property.marketValue - property.initialBid - overhead - renovation - sellingComm - ir;
          const totalCost = property.initialBid + overhead + renovation;
          const roiLiq = totalCost > 0 ? (netProfit / totalCost) * 100 : 0;
          const roiColor = roiLiq >= 20 ? '#2ECC71' : roiLiq >= 0 ? '#f39c12' : '#e74c3c';
          return (
            <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '1.25rem', boxShadow: '0 2px 8px rgba(10,46,80,0.08)', borderLeft: `4px solid ${roiColor}` }}>
              <h2 style={{ fontFamily: 'var(--font-montserrat, Montserrat, sans-serif)', fontSize: '1rem', fontWeight: 700, color: '#0A2E50', margin: '0 0 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                💰 Estimativa de ROI Líquido
              </h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '0.75rem' }}>
                {[
                  { label: 'Desconto no leilão', value: `${discount.toFixed(0)}%`, color: '#1E6BB8' },
                  { label: 'Lucro bruto estimado', value: formatCurrency(property.marketValue - property.initialBid), color: '#0A2E50' },
                  { label: 'Custos totais (est.)', value: formatCurrency(overhead + renovation + sellingComm + ir), color: '#e74c3c' },
                  { label: 'ROI Líquido estimado', value: `${roiLiq.toFixed(1)}%`, color: roiColor, bold: true },
                ].map((item) => (
                  <div key={item.label} style={{ padding: '0.75rem', backgroundColor: '#f9f9f9', borderRadius: '8px' }}>
                    <div style={{ fontSize: '0.7rem', color: '#999', marginBottom: '0.3rem' }}>{item.label}</div>
                    <div style={{ fontSize: item.bold ? '1.2rem' : '0.95rem', fontWeight: item.bold ? 800 : 700, color: item.color, fontFamily: 'var(--font-montserrat, Montserrat, sans-serif)' }}>{item.value}</div>
                  </div>
                ))}
              </div>
              <p style={{ fontSize: '0.72rem', color: '#aaa', margin: '0.75rem 0 0', fontStyle: 'italic' }}>
                * Estimativa com: comissão leiloeiro 5%, documentação 4%, reforma, IR 15% sobre ganho e comissão venda 6%. Ajuste na calculadora abaixo.
              </p>
            </div>
          );
        })()}

        {/* Financial Calculator */}
        <div>
          <h2 style={{ fontFamily: 'var(--font-montserrat, Montserrat, sans-serif)', fontSize: '1.25rem', fontWeight: 700, color: '#0A2E50', margin: '0 0 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            📊 Calculadora de Viabilidade Financeira
          </h2>
          <FinancialCalculator property={property} isFree={isFree} />
        </div>

        {/* AI Analysis */}
        <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '1.5rem', boxShadow: '0 2px 8px rgba(10,46,80,0.08)', border: '2px solid #1E6BB8' }}>
          <style>{`
            @keyframes spin { to { transform: rotate(360deg); } }
            @keyframes pulse-glow {
              0%, 100% { box-shadow: 0 0 0 0 rgba(30,107,184,0.4); }
              50% { box-shadow: 0 0 0 8px rgba(30,107,184,0); }
            }
            @keyframes stepIn {
              from { opacity: 0; transform: translateY(10px); }
              to { opacity: 1; transform: translateY(0); }
            }
            @keyframes stepOut {
              from { opacity: 0.5; }
              to { opacity: 0; height: 0; margin: 0; padding: 0; }
            }
          `}</style>

          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.875rem' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'linear-gradient(135deg, #0A2E50, #1E6BB8)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Sparkles size={20} color="white" />
            </div>
            <div>
              <h2 style={{ fontFamily: 'var(--font-montserrat, Montserrat, sans-serif)', fontSize: '1.1rem', fontWeight: 700, color: '#0A2E50', margin: 0 }}>
                Laudo Técnico do Imóvel
              </h2>
              <p style={{ margin: 0, fontSize: '0.75rem', color: '#888' }}>Equipe Fundamenta Leilões</p>
            </div>
          </div>

          {/* Description (idle/error only) */}
          {(analysisState === 'idle' || analysisState === 'error') && (
            <p style={{ color: '#555', fontSize: '0.875rem', lineHeight: 1.7, marginBottom: '1.25rem' }}>
              Nossa IA irá analisar a matrícula e o edital do imóvel automaticamente, identificando ônus, dívidas, riscos jurídicos e oportunidades.
            </p>
          )}

          {/* Error message */}
          {analysisState === 'error' && (
            <div style={{ backgroundColor: 'rgba(231,76,60,0.08)', border: '1px solid rgba(231,76,60,0.3)', borderRadius: '8px', padding: '0.875rem', marginBottom: '1rem', fontSize: '0.875rem', color: '#c0392b' }}>
              {analysisError}
            </div>
          )}

          {/* Loading state */}
          {analysisState === 'loading' && (() => {
            const visibleStart = Math.max(0, currentStep - 2);
            const visibleSteps = ANALYSIS_STEPS.slice(visibleStart, currentStep + 1);
            return (
              <div style={{ padding: '1.25rem 0' }}>
                {/* Progress bar */}
                <div style={{ marginBottom: '1.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: '#999', marginBottom: '0.4rem' }}>
                    <span>Elaborando laudo técnico completo...</span>
                    <span>{Math.round(((currentStep + 1) / ANALYSIS_STEPS.length) * 100)}%</span>
                  </div>
                  <div style={{ height: '4px', backgroundColor: 'rgba(30,107,184,0.12)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', borderRadius: '4px',
                      background: 'linear-gradient(90deg, #0A2E50, #1E6BB8)',
                      width: `${((currentStep + 1) / ANALYSIS_STEPS.length) * 100}%`,
                      transition: 'width 0.6s ease',
                    }} />
                  </div>
                </div>

                {/* Steps list */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {visibleSteps.map((step, idx) => {
                    const globalIdx = visibleStart + idx;
                    const isDone = globalIdx < currentStep;
                    const isActive = globalIdx === currentStep;
                    return (
                      <div
                        key={step}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '0.75rem',
                          padding: '0.6rem 0.875rem',
                          borderRadius: '8px',
                          backgroundColor: isActive ? 'rgba(30,107,184,0.07)' : isDone ? 'transparent' : 'transparent',
                          border: isActive ? '1px solid rgba(30,107,184,0.2)' : '1px solid transparent',
                          opacity: isDone ? 0.45 : 1,
                          animation: 'stepIn 0.4s ease forwards',
                          transition: 'opacity 0.4s ease',
                        }}
                      >
                        {isActive ? (
                          <div style={{ width: '18px', height: '18px', borderRadius: '50%', border: '2.5px solid rgba(30,107,184,0.2)', borderTopColor: '#1E6BB8', animation: 'spin 0.8s linear infinite', flexShrink: 0 }} />
                        ) : (
                          <div style={{ width: '18px', height: '18px', borderRadius: '50%', backgroundColor: 'rgba(46,204,113,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1.5 5L4 7.5L8.5 2.5" stroke="#27ae60" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                          </div>
                        )}
                        <span style={{
                          fontSize: '0.8rem',
                          color: isActive ? '#0A2E50' : '#888',
                          fontWeight: isActive ? 600 : 400,
                          fontFamily: isActive ? 'var(--font-montserrat, Montserrat, sans-serif)' : 'inherit',
                        }}>
                          {step}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <p style={{ margin: '0.875rem 0 0', fontSize: '0.72rem', color: '#bbb', textAlign: 'center', fontStyle: 'italic' }}>
                  A análise completa pode levar até 60 segundos
                </p>
              </div>
            );
          })()}

          {/* Results */}
          {analysisState === 'done' && analysisData && (
            <div>
              {/* Risk badge */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1.25rem' }}>
                <span style={{ fontSize: '0.8rem', color: '#888' }}>
                  Análise profunda concluída
                </span>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                  padding: '0.35rem 1rem', borderRadius: '20px', fontWeight: 700,
                  fontSize: '0.85rem', color: 'white',
                  backgroundColor:
                    analysisData.riskLevel === 'BAIXO' ? '#2ECC71' :
                    analysisData.riskLevel === 'ALTO'  ? '#e74c3c' : '#f39c12',
                }}>
                  {analysisData.riskLevel === 'BAIXO' && <CheckCircle size={14} />}
                  {analysisData.riskLevel === 'ALTO'  && <AlertTriangle size={14} />}
                  {analysisData.riskLevel === 'MEDIO' && <HelpCircle size={14} />}
                  Risco {analysisData.riskLevel === 'MEDIO' ? 'MÉDIO' : analysisData.riskLevel}
                </span>
              </div>

              {/* Analysis HTML */}
              <div
                dangerouslySetInnerHTML={{ __html: displayedHtml }}
                style={{ fontSize: '0.875rem', lineHeight: 1.7 }}
              />

              {/* Disclaimer */}
              <p style={{ fontSize: '0.72rem', color: '#bbb', marginTop: '1.25rem', marginBottom: 0, textAlign: 'center', fontStyle: 'italic' }}>
                Este laudo é orientativo e não constitui recomendação de compra. Consulte sempre um advogado especializado antes de arrematar.
              </p>

              {/* Divider + secondary option */}
              <div style={{ marginTop: '1.5rem', paddingTop: '1.25rem', borderTop: '1px solid #f0f0f0' }}>
                <p style={{ fontSize: '0.8rem', color: '#999', margin: '0 0 0.75rem' }}>Upload de documentos adicionais (em breve)</p>
                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <button className="btn-outline" style={{ fontSize: '0.8rem', opacity: 0.6, cursor: 'not-allowed' }} disabled>
                    <FileText size={14} /> Upload de Matrícula
                  </button>
                  <button className="btn-outline" style={{ fontSize: '0.8rem', opacity: 0.6, cursor: 'not-allowed' }} disabled>
                    <FileText size={14} /> Upload de Edital
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Action buttons (idle / error) */}
          {(analysisState === 'idle' || analysisState === 'error') && (
            <div>
              {isFree ? (
                <div style={{ backgroundColor: 'rgba(10,46,80,0.04)', border: '1.5px solid rgba(10,46,80,0.15)', borderRadius: '12px', padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                  <div style={{ width: '44px', height: '44px', borderRadius: '50%', backgroundColor: '#0A2E50', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Lock size={20} color="#FFD700" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: 'var(--font-montserrat, Montserrat, sans-serif)', fontWeight: 700, color: '#0A2E50', fontSize: '0.95rem', marginBottom: '0.25rem' }}>
                      Análise Especialista — Recurso Premium
                    </div>
                    <p style={{ fontSize: '0.825rem', color: '#666', margin: 0 }}>
                      O laudo técnico completo com análise jurídica, avaliação de risco e projeção de ROI é exclusivo para assinantes.
                    </p>
                  </div>
                  <Link href="/dashboard/perfil" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.6rem 1.25rem', borderRadius: '9px', backgroundColor: '#FFD700', color: '#0A2E50', fontWeight: 800, fontSize: '0.875rem', textDecoration: 'none', whiteSpace: 'nowrap' }}>
                    Assinar Premium →
                  </Link>
                </div>
              ) : (
                <>
                  <button
                    className="btn-primary"
                    style={{ fontSize: '0.9rem', display: 'inline-flex', alignItems: 'center', gap: '0.5rem', animation: analysisState === 'idle' ? 'pulse-glow 2.5s ease-in-out infinite' : 'none' }}
                    onClick={startAnalysis}
                    disabled={!property?.registrationNumber}
                  >
                    <Sparkles size={16} />
                    {analysisState === 'error' ? 'Tentar novamente' : 'Iniciar Análise Profunda'}
                  </button>
                  {!property?.registrationNumber && (
                    <p style={{ fontSize: '0.75rem', color: '#e74c3c', marginTop: '0.5rem', marginBottom: 0 }}>
                      Este imóvel não possui número de registro (necessário para buscar documentos na Caixa).
                    </p>
                  )}
                </>
              )}

              {/* Secondary upload options */}
              <div style={{ marginTop: '1.25rem', paddingTop: '1.25rem', borderTop: '1px solid #f5f5f5' }}>
                <p style={{ fontSize: '0.8rem', color: '#999', margin: '0 0 0.75rem' }}>Upload de documentos adicionais (em breve)</p>
                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <button className="btn-outline" style={{ fontSize: '0.8rem', opacity: 0.6, cursor: 'not-allowed' }} disabled>
                    <FileText size={14} /> Upload de Matrícula
                  </button>
                  <button className="btn-outline" style={{ fontSize: '0.8rem', opacity: 0.6, cursor: 'not-allowed' }} disabled>
                    <FileText size={14} /> Upload de Edital
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
