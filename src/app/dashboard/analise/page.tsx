'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  BarChart2, Sparkles, AlertTriangle, CheckCircle, HelpCircle,
  Trash2, Building2, ArrowRight, Calendar,
} from 'lucide-react';
import { formatDate } from '@/lib/utils';

interface AnalysisRecord {
  id: string;
  propertyId: string;
  title: string;
  address: string;
  city: string;
  state: string;
  mainImage?: string | null;
  riskLevel: string;
  analyzedAt: string;
}

const riskConfig = {
  BAIXO:  { color: '#2ECC71', bg: 'rgba(46,204,113,0.1)',  icon: CheckCircle,    label: 'Risco Baixo' },
  MEDIO:  { color: '#f39c12', bg: 'rgba(243,156,18,0.1)',  icon: HelpCircle,     label: 'Risco Médio' },
  ALTO:   { color: '#e74c3c', bg: 'rgba(231,76,60,0.1)',   icon: AlertTriangle,  label: 'Risco Alto' },
};

export default function AnalisePage() {
  const [analyses, setAnalyses] = useState<AnalysisRecord[]>([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('fundamenta_ai_analyses');
      if (stored) setAnalyses(JSON.parse(stored));
    } catch { /* ignore */ }
  }, []);

  function deleteAnalysis(id: string) {
    const updated = analyses.filter((a) => a.id !== id);
    setAnalyses(updated);
    try {
      localStorage.setItem('fundamenta_ai_analyses', JSON.stringify(updated));
    } catch { /* ignore */ }
  }

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '1.5rem 1.5rem 5rem' }}>
      {/* Header */}
      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.375rem' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'linear-gradient(135deg, #0A2E50, #1E6BB8)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Sparkles size={18} color="white" />
          </div>
          <h1 style={{ fontFamily: 'var(--font-montserrat, Montserrat, sans-serif)', fontSize: '1.625rem', fontWeight: 800, color: '#0A2E50', margin: 0 }}>
            Análises por IA
          </h1>
        </div>
        <p style={{ color: '#666', fontSize: '0.875rem', margin: 0 }}>
          Imóveis que você solicitou análise técnica profunda pela nossa IA
        </p>
      </div>

      {analyses.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '5rem 2rem', backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 1px 6px rgba(10,46,80,0.07)' }}>
          <BarChart2 size={52} style={{ color: '#ddd', marginBottom: '1rem' }} />
          <h3 style={{ color: '#0A2E50', fontFamily: 'var(--font-montserrat, Montserrat, sans-serif)', marginBottom: '0.5rem' }}>
            Nenhuma análise realizada ainda
          </h3>
          <p style={{ color: '#666', fontSize: '0.875rem', marginBottom: '1.5rem', maxWidth: '380px', margin: '0 auto 1.5rem' }}>
            Acesse um imóvel nas Oportunidades e clique em &quot;Iniciar Análise Profunda&quot; para ver o laudo técnico completo aqui.
          </p>
          <Link href="/dashboard" className="btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}>
            Ver Oportunidades <ArrowRight size={16} />
          </Link>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            <span style={{ fontSize: '0.8rem', color: '#666' }}>
              {analyses.length} {analyses.length === 1 ? 'análise realizada' : 'análises realizadas'}
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
            {analyses.map((a) => {
              const risk = riskConfig[a.riskLevel as keyof typeof riskConfig] ?? riskConfig.MEDIO;
              const RiskIcon = risk.icon;
              return (
                <div
                  key={a.id}
                  style={{ backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 2px 8px rgba(10,46,80,0.08)', overflow: 'hidden', display: 'flex', flexDirection: 'row' }}
                >
                  {/* Image */}
                  <div style={{ width: '100px', minHeight: '90px', backgroundColor: '#e8edf2', flexShrink: 0, position: 'relative' }}>
                    {a.mainImage ? (
                      <Image src={a.mainImage} alt="" fill unoptimized style={{ objectFit: 'cover' }} />
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                        <Building2 size={28} color="#ccc" />
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div style={{ flex: 1, padding: '0.875rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.375rem', minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                      <h3 style={{
                        fontFamily: 'var(--font-montserrat, Montserrat, sans-serif)',
                        fontWeight: 700, color: '#0A2E50', margin: 0, fontSize: '0.9rem',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {a.title}
                      </h3>
                      <button
                        onClick={() => deleteAnalysis(a.id)}
                        title="Remover"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ccc', padding: '0.2rem', flexShrink: 0 }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>

                    <p style={{ color: '#888', fontSize: '0.78rem', margin: 0 }}>
                      {[a.address, a.city, a.state].filter(Boolean).join(', ')}
                    </p>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.25rem' }}>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                        padding: '0.2rem 0.6rem', borderRadius: '20px',
                        backgroundColor: risk.bg, color: risk.color,
                        fontSize: '0.72rem', fontWeight: 700,
                      }}>
                        <RiskIcon size={11} /> {risk.label}
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.72rem', color: '#aaa' }}>
                        <Calendar size={11} /> {formatDate(a.analyzedAt)}
                      </span>
                    </div>
                  </div>

                  {/* Link */}
                  <div style={{ display: 'flex', alignItems: 'center', padding: '0 1rem', flexShrink: 0 }}>
                    <Link
                      href={`/dashboard/analise/${a.propertyId}`}
                      style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: '#1E6BB8', fontSize: '0.8rem', fontWeight: 600, textDecoration: 'none' }}
                    >
                      Ver análise <ArrowRight size={14} />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
