'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import Image from 'next/image';
import Link from 'next/link';
import {
  Plus, TrendingUp, Home, CheckCircle, Clock, AlertCircle,
  ChevronDown, ChevronUp, DollarSign, Camera, FileText,
  Trash2, Edit2, X, Save, Gavel, Building2,
  Sparkles, Calculator, ArrowRight,
} from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/utils';
import { EVICTION_STATUS_LABELS, EvictionStatus } from '@/types/bidderJournal';
import PropertyChecklist from '@/components/checklist/PropertyChecklist';

interface RenovationLog {
  id: string;
  date: string;
  description: string;
  cost: number;
  stage: string;
}

interface Document {
  id: string;
  name: string;
  type: string;
  uploadedAt: string;
}

interface Arrematacao {
  id: string;
  propertyId: string;
  property: {
    title: string;
    address: string;
    city: string;
    state: string;
    mainImage: string | null;
    propertyType: string;
  };
  evictionStatus: EvictionStatus;
  acquiredAt: string;
  acquiredValue: number;
  targetSaleValue: number;
  actualEvictionCosts: number;
  actualDocumentationCosts: number;
  actualRenovationCosts: number;
  notes: string;
  renovationLog: RenovationLog[];
  documents: Document[];
}

const DEMO_DATA: Arrematacao[] = [
  {
    id: 'journal-001',
    propertyId: 'prop-001',
    property: {
      title: 'Apartamento 3 quartos - Vila Madalena',
      address: 'Rua Girassol, 450, Apto 82',
      city: 'São Paulo',
      state: 'SP',
      mainImage: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=400',
      propertyType: 'APARTMENT',
    },
    evictionStatus: 'COMPLETED',
    acquiredAt: '2025-11-15T00:00:00Z',
    acquiredValue: 374000,
    targetSaleValue: 580000,
    actualEvictionCosts: 0,
    actualDocumentationCosts: 18500,
    actualRenovationCosts: 42000,
    notes: 'Imóvel estava em ótimas condições. Reforma focada em atualização de acabamentos e pintura.',
    renovationLog: [
      { id: 'r1', date: '2025-11-20T00:00:00Z', description: 'Limpeza e preparação do imóvel', cost: 2000, stage: 'Limpeza Final' },
      { id: 'r2', date: '2025-12-05T00:00:00Z', description: 'Pintura completa interna', cost: 8500, stage: 'Pintura' },
      { id: 'r3', date: '2025-12-20T00:00:00Z', description: 'Piso laminado sala e quartos', cost: 12000, stage: 'Acabamento' },
      { id: 'r4', date: '2026-01-10T00:00:00Z', description: 'Reformas hidráulica e elétrica', cost: 9500, stage: 'Elétrica' },
      { id: 'r5', date: '2026-01-25T00:00:00Z', description: 'Bancadas e armários da cozinha', cost: 10000, stage: 'Acabamento' },
    ],
    documents: [
      { id: 'd1', name: 'Escritura de Compra e Venda', type: 'pdf', uploadedAt: '2025-11-20T00:00:00Z' },
      { id: 'd2', name: 'Guia ITBI', type: 'pdf', uploadedAt: '2025-11-22T00:00:00Z' },
    ],
  },
  {
    id: 'journal-002',
    propertyId: 'prop-006',
    property: {
      title: 'Casa Popular 3 quartos - Parque Industrial',
      address: 'Rua João Pessoa, 782',
      city: 'Campinas',
      state: 'SP',
      mainImage: 'https://images.unsplash.com/photo-1570129477492-45c003edd2be?w=400',
      propertyType: 'HOUSE',
    },
    evictionStatus: 'IN_PROGRESS',
    acquiredAt: '2025-12-10T00:00:00Z',
    acquiredValue: 112000,
    targetSaleValue: 240000,
    actualEvictionCosts: 4500,
    actualDocumentationCosts: 5200,
    actualRenovationCosts: 0,
    notes: 'Ação de reintegração de posse em andamento. Prazo estimado: 60 dias.',
    renovationLog: [],
    documents: [
      { id: 'd3', name: 'Ação de Reintegração de Posse', type: 'pdf', uploadedAt: '2025-12-15T00:00:00Z' },
    ],
  },
];

const STORAGE_KEY = 'fundamenta_arrematacoes';

const statusConfig = {
  PENDING:     { icon: AlertCircle, color: '#f39c12', bg: 'rgba(243,156,18,0.1)' },
  IN_PROGRESS: { icon: Clock,       color: '#1E6BB8', bg: 'rgba(30,107,184,0.1)' },
  COMPLETED:   { icon: CheckCircle, color: '#2ECC71', bg: 'rgba(46,204,113,0.1)' },
};

// Migrates entries saved with the old flat format (from PropertyCard / analysis page v1)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeEntry(raw: any): Arrematacao {
  // Already in correct format
  if (raw.property && typeof raw.property === 'object') return raw as Arrematacao;
  // Old flat format: { title, address, city, state, mainImage, bidValue, ... }
  return {
    id: raw.id ?? `arr-${Date.now()}`,
    propertyId: raw.propertyId ?? '',
    property: {
      title: raw.title ?? 'Imóvel sem título',
      address: raw.address ?? '',
      city: raw.city ?? '',
      state: raw.state ?? '',
      mainImage: raw.mainImage ?? null,
      propertyType: raw.propertyType ?? 'HOUSE',
    },
    evictionStatus: (['PENDING', 'IN_PROGRESS', 'COMPLETED'].includes(raw.evictionStatus)
      ? raw.evictionStatus
      : 'COMPLETED') as EvictionStatus,
    acquiredAt: raw.acquiredAt ?? raw.arrematadoEm ?? new Date().toISOString(),
    acquiredValue: raw.acquiredValue ?? raw.bidValue ?? 0,
    targetSaleValue: raw.targetSaleValue ?? raw.marketValue ?? 0,
    actualEvictionCosts: raw.actualEvictionCosts ?? 0,
    actualDocumentationCosts: raw.actualDocumentationCosts ?? 0,
    actualRenovationCosts: raw.actualRenovationCosts ?? 0,
    notes: raw.notes ?? '',
    renovationLog: raw.renovationLog ?? raw.renovationStages ?? [],
    documents: raw.documents ?? [],
  };
}

function loadFromStorage(): Arrematacao[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.map(normalizeEntry) : DEMO_DATA;
    }
  } catch { /* ignore */ }
  // seed with demo data on first load
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(DEMO_DATA));
  } catch { /* ignore */ }
  return DEMO_DATA;
}

function saveToStorage(data: Arrematacao[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch { /* ignore */ }
}

export default function ArrematacaoPage() {
  const { data: session } = useSession();
  const isFree = session?.user?.plan === 'FREE';
  const [entries, setEntries] = useState<Arrematacao[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editEntry, setEditEntry] = useState<Arrematacao | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showRenovModal, setShowRenovModal] = useState<string | null>(null); // entryId
  const [renovForm, setRenovForm] = useState({ description: '', cost: '', stage: '', date: new Date().toISOString().split('T')[0] });
  const [newEntry, setNewEntry] = useState({
    title: '', address: '', city: '', state: '', acquiredValue: '', targetSaleValue: '',
    acquiredAt: new Date().toISOString().split('T')[0],
    actualDocumentationCosts: '', actualEvictionCosts: '', actualRenovationCosts: '',
    evictionStatus: 'PENDING' as EvictionStatus, notes: '',
  });

  useEffect(() => {
    setEntries(loadFromStorage());
  }, []);

  // Load scenarios and AI analysis for the expanded entry
  const [expandedScenarios, setExpandedScenarios] = useState<Array<{ id: string; name: string; savedAt: string; result: { roiSale: number; netProfitSale: number } }>>([]);
  const [expandedAiAnalysis, setExpandedAiAnalysis] = useState<{ propertyId: string; riskLevel: string; analyzedAt: string } | null>(null);

  useEffect(() => {
    if (!expandedId) {
      setExpandedScenarios([]);
      setExpandedAiAnalysis(null);
      return;
    }
    const entry = entries.find((e) => e.id === expandedId);
    if (!entry) return;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const allSc: any[] = JSON.parse(localStorage.getItem('fundamenta_calc_scenarios') || '[]');
      setExpandedScenarios(allSc.filter((s) => s.propertyId === entry.propertyId));
    } catch { setExpandedScenarios([]); }
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const allAi: any[] = JSON.parse(localStorage.getItem('fundamenta_ai_analyses') || '[]');
      setExpandedAiAnalysis(allAi.find((a) => a.propertyId === entry.propertyId) ?? null);
    } catch { setExpandedAiAnalysis(null); }
  }, [expandedId, entries]);

  function update(updated: Arrematacao[]) {
    setEntries(updated);
    saveToStorage(updated);
  }

  function handleDelete(id: string) {
    update(entries.filter((e) => e.id !== id));
    setDeleteId(null);
    if (expandedId === id) setExpandedId(null);
  }

  function handleSaveEdit() {
    if (!editEntry) return;
    update(entries.map((e) => e.id === editEntry.id ? editEntry : e));
    setEditEntry(null);
  }

  function handleAddEntry() {
    const entry: Arrematacao = {
      id: `arr-${Date.now()}`,
      propertyId: `manual-${Date.now()}`,
      property: {
        title: newEntry.title || 'Imóvel sem título',
        address: newEntry.address,
        city: newEntry.city,
        state: newEntry.state,
        mainImage: null,
        propertyType: 'HOUSE',
      },
      evictionStatus: newEntry.evictionStatus,
      acquiredAt: newEntry.acquiredAt ? `${newEntry.acquiredAt}T00:00:00Z` : new Date().toISOString(),
      acquiredValue: Number(newEntry.acquiredValue) || 0,
      targetSaleValue: Number(newEntry.targetSaleValue) || 0,
      actualDocumentationCosts: Number(newEntry.actualDocumentationCosts) || 0,
      actualEvictionCosts: Number(newEntry.actualEvictionCosts) || 0,
      actualRenovationCosts: Number(newEntry.actualRenovationCosts) || 0,
      notes: newEntry.notes,
      renovationLog: [],
      documents: [],
    };
    update([...entries, entry]);
    setShowAddModal(false);
    setNewEntry({ title: '', address: '', city: '', state: '', acquiredValue: '', targetSaleValue: '', acquiredAt: new Date().toISOString().split('T')[0], actualDocumentationCosts: '', actualEvictionCosts: '', actualRenovationCosts: '', evictionStatus: 'PENDING', notes: '' });
  }

  function handleAddRenovation(entryId: string) {
    const log: RenovationLog = {
      id: `r-${Date.now()}`,
      date: renovForm.date ? `${renovForm.date}T00:00:00Z` : new Date().toISOString(),
      description: renovForm.description,
      cost: Number(renovForm.cost) || 0,
      stage: renovForm.stage,
    };
    update(entries.map((e) => {
      if (e.id !== entryId) return e;
      return {
        ...e,
        actualRenovationCosts: e.actualRenovationCosts + log.cost,
        renovationLog: [...e.renovationLog, log],
      };
    }));
    setShowRenovModal(null);
    setRenovForm({ description: '', cost: '', stage: '', date: new Date().toISOString().split('T')[0] });
  }

  function calcROILiquido(entry: Arrematacao) {
    const totalCost = entry.acquiredValue + entry.actualDocumentationCosts + entry.actualEvictionCosts + entry.actualRenovationCosts;
    const sellingComm = entry.targetSaleValue * 0.06;
    const capitalGain = entry.targetSaleValue - totalCost;
    const ir = Math.max(0, capitalGain) * 0.15;
    const netProfit = entry.targetSaleValue - totalCost - sellingComm - ir;
    const roi = totalCost > 0 ? (netProfit / totalCost) * 100 : 0;
    return { totalCost, netProfit, roi };
  }

  const totalInvested = entries.reduce((s, e) => s + e.acquiredValue + e.actualDocumentationCosts + e.actualEvictionCosts + e.actualRenovationCosts, 0);
  const totalTarget   = entries.reduce((s, e) => s + (e.targetSaleValue || 0), 0);
  const totalNetProfit = entries.reduce((s, e) => s + calcROILiquido(e).netProfit, 0);
  const avgROI = entries.length > 0 ? entries.reduce((s, e) => s + calcROILiquido(e).roi, 0) / entries.length : 0;

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '1.5rem 1.5rem 5rem' }}>
      <style>{`
        @keyframes fadeIn { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
        .modal-overlay { position:fixed; inset:0; background:rgba(0,0,0,0.4); z-index:200; display:flex; align-items:center; justify-content:center; padding:1rem; animation:fadeIn 0.15s ease; }
        .modal-box { background:white; border-radius:14px; padding:1.5rem; width:100%; max-width:520px; max-height:90vh; overflow-y:auto; box-shadow:0 8px 40px rgba(0,0,0,0.18); }
        .form-label { display:block; font-size:0.8rem; font-weight:600; color:#0A2E50; margin-bottom:0.3rem; }
        .form-grid { display:grid; gap:0.875rem; }
        .form-grid-2 { grid-template-columns:1fr 1fr; }
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '0.25rem' }}>
            <Gavel size={22} color="#0A2E50" />
            <h1 style={{ fontFamily: 'var(--font-montserrat, Montserrat, sans-serif)', fontSize: '1.625rem', fontWeight: 800, color: '#0A2E50', margin: 0 }}>
              Minhas Arrematações
            </h1>
          </div>
          <p style={{ color: '#666', fontSize: '0.875rem', margin: 0 }}>
            Acompanhe seus imóveis arrematados, reformas e resultados
          </p>
        </div>
        <button className="btn-primary" style={{ fontSize: '0.875rem', gap: '0.5rem' }} onClick={() => setShowAddModal(true)}>
          <Plus size={16} /> Adicionar Imóvel
        </button>
      </div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        {[
          { label: 'Imóveis Arrematados', value: entries.length, color: '#0A2E50', icon: Home, isNum: true },
          { label: 'Total Investido',     value: formatCurrency(totalInvested),  color: '#e74c3c', icon: DollarSign, isNum: false },
          { label: 'Valor Alvo Total',    value: formatCurrency(totalTarget),    color: '#1E6BB8', icon: TrendingUp, isNum: false },
          { label: 'ROI Líquido Médio',   value: `${avgROI.toFixed(1)}%`,       color: avgROI >= 0 ? '#2ECC71' : '#e74c3c', icon: TrendingUp, isNum: false },
          { label: 'Lucro Líquido Est.',  value: formatCurrency(totalNetProfit), color: totalNetProfit >= 0 ? '#2ECC71' : '#e74c3c', icon: TrendingUp, isNum: false },
        ].map((stat) => (
          <div key={stat.label} style={{ backgroundColor: 'white', borderRadius: '10px', padding: '1rem', boxShadow: '0 1px 6px rgba(10,46,80,0.07)', borderTop: `3px solid ${stat.color}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.72rem', color: '#666', marginBottom: '0.5rem' }}>
              <stat.icon size={13} /> {stat.label}
            </div>
            <div style={{ fontSize: stat.isNum ? '1.5rem' : '1.05rem', fontWeight: 800, color: stat.color, fontFamily: 'var(--font-montserrat, Montserrat, sans-serif)' }}>
              {stat.value}
            </div>
          </div>
        ))}
      </div>

      {/* Entries */}
      {entries.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '4rem', backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 1px 6px rgba(10,46,80,0.07)' }}>
          <Gavel size={48} style={{ color: '#ddd', marginBottom: '1rem' }} />
          <h3 style={{ color: '#0A2E50', fontFamily: 'var(--font-montserrat, Montserrat, sans-serif)' }}>Nenhum imóvel registrado</h3>
          <p style={{ color: '#666', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
            Quando você arrematar um imóvel, adicione-o aqui clicando no botão <strong>Adicionar Imóvel</strong> ou no ícone de martelo nos cards de oportunidades.
          </p>
          <button className="btn-primary" style={{ gap: '0.5rem', fontSize: '0.875rem' }} onClick={() => setShowAddModal(true)}>
            <Plus size={16} /> Adicionar primeiro imóvel
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {entries.map((entry) => {
            const isExpanded = expandedId === entry.id;
            const status = statusConfig[entry.evictionStatus] ?? { icon: CheckCircle, color: '#2ECC71', bg: 'rgba(46,204,113,0.1)' };
            const StatusIcon = status.icon;
            const totalCosts = entry.acquiredValue + entry.actualDocumentationCosts + entry.actualEvictionCosts + entry.actualRenovationCosts;
            const { netProfit, roi } = calcROILiquido(entry);
            const roiColor = roi >= 20 ? '#2ECC71' : roi >= 0 ? '#f39c12' : '#e74c3c';

            return (
              <div key={entry.id} style={{ backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 2px 8px rgba(10,46,80,0.08)', overflow: 'hidden' }}>
                {/* Header row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1.25rem', cursor: 'pointer' }}
                  onClick={() => setExpandedId(isExpanded ? null : entry.id)}>
                  {entry.property.mainImage ? (
                    <div style={{ width: '72px', height: '72px', borderRadius: '8px', overflow: 'hidden', flexShrink: 0 }}>
                      <Image src={entry.property.mainImage} alt="" width={72} height={72} style={{ objectFit: 'cover', width: '100%', height: '100%' }} />
                    </div>
                  ) : (
                    <div style={{ width: '72px', height: '72px', borderRadius: '8px', backgroundColor: '#e8edf2', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Building2 size={28} color="#ccc" />
                    </div>
                  )}

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h3 style={{ fontFamily: 'var(--font-montserrat, Montserrat, sans-serif)', fontWeight: 700, color: '#0A2E50', margin: '0 0 0.25rem', fontSize: '0.95rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {entry.property.title}
                    </h3>
                    <p style={{ color: '#666', fontSize: '0.8rem', margin: '0 0 0.5rem' }}>
                      {entry.property.city}/{entry.property.state} · Arrematado em {formatDate(entry.acquiredAt || '')}
                    </p>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', padding: '0.25rem 0.625rem', borderRadius: '999px', backgroundColor: status.bg, color: status.color, fontSize: '0.72rem', fontWeight: 600 }}>
                        <StatusIcon size={12} /> Desocupação: {EVICTION_STATUS_LABELS[entry.evictionStatus]}
                      </div>
                      <span style={{ fontSize: '0.72rem', color: '#666' }}>Lance: {formatCurrency(entry.acquiredValue)}</span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexShrink: 0 }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '0.68rem', color: '#999' }}>ROI Líquido</div>
                      <div style={{ fontFamily: 'var(--font-montserrat, Montserrat, sans-serif)', fontWeight: 800, color: roiColor, fontSize: '1.1rem' }}>
                        {roi.toFixed(1)}%
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div style={{ display: 'flex', gap: '0.375rem' }} onClick={(e) => e.stopPropagation()}>
                      <button
                        title="Editar"
                        onClick={() => setEditEntry({ ...entry })}
                        style={{ background: 'none', border: '1.5px solid #e0e0e0', borderRadius: '7px', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#666' }}
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        title="Excluir"
                        onClick={() => setDeleteId(entry.id)}
                        style={{ background: 'none', border: '1.5px solid rgba(231,76,60,0.3)', borderRadius: '7px', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#e74c3c' }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>

                    {isExpanded ? <ChevronUp size={20} color="#999" /> : <ChevronDown size={20} color="#999" />}
                  </div>
                </div>

                {/* Expanded content */}
                {isExpanded && (
                  <div style={{ borderTop: '1px solid #f0f0f0', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

                    {/* Financial summary */}
                    <div>
                      <h4 style={{ fontFamily: 'var(--font-montserrat, Montserrat, sans-serif)', fontWeight: 700, color: '#0A2E50', margin: '0 0 0.875rem', fontSize: '0.9rem' }}>Resumo Financeiro</h4>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '0.75rem', marginBottom: '0.875rem' }}>
                        {[
                          { label: 'Valor Arrematado',  value: formatCurrency(entry.acquiredValue),             color: '#0A2E50' },
                          { label: 'Documentação',      value: formatCurrency(entry.actualDocumentationCosts),  color: '#f39c12' },
                          { label: 'Desocupação',       value: formatCurrency(entry.actualEvictionCosts),       color: '#e74c3c' },
                          { label: 'Reforma',           value: formatCurrency(entry.actualRenovationCosts),     color: '#9b59b6' },
                          { label: 'Custo Total',       value: formatCurrency(totalCosts),                      color: '#0A2E50', bold: true },
                          { label: 'Alvo de Venda',     value: formatCurrency(entry.targetSaleValue || 0),      color: '#1E6BB8', bold: true },
                        ].map((item) => (
                          <div key={item.label} style={{ padding: '0.625rem 0.75rem', backgroundColor: '#f9f9f9', borderRadius: '8px', borderLeft: `3px solid ${item.color}` }}>
                            <div style={{ fontSize: '0.7rem', color: '#999', marginBottom: '0.25rem' }}>{item.label}</div>
                            <div style={{ fontSize: '0.875rem', fontWeight: item.bold ? 700 : 600, color: item.color }}>{item.value}</div>
                          </div>
                        ))}
                      </div>
                      {/* ROI Líquido highlight */}
                      <div style={{ padding: '0.875rem 1rem', borderRadius: '10px', backgroundColor: roi >= 0 ? 'rgba(46,204,113,0.07)' : 'rgba(231,76,60,0.07)', border: `1.5px solid ${roiColor}30`, display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
                        {[
                          { label: 'Comissão venda (6%)', value: formatCurrency(entry.targetSaleValue * 0.06) },
                          { label: 'IR s/ ganho (15%)',   value: formatCurrency(Math.max(0, (entry.targetSaleValue - totalCosts)) * 0.15) },
                          { label: 'Lucro Líquido Est.',  value: formatCurrency(netProfit), color: roiColor, bold: true },
                          { label: 'ROI Líquido',        value: `${roi.toFixed(1)}%`, color: roiColor, bold: true },
                        ].map((item) => (
                          <div key={item.label}>
                            <div style={{ fontSize: '0.7rem', color: '#888' }}>{item.label}</div>
                            <div style={{ fontWeight: item.bold ? 800 : 600, color: item.color || '#555', fontSize: item.bold ? '1rem' : '0.875rem', fontFamily: item.bold ? 'var(--font-montserrat, Montserrat, sans-serif)' : 'inherit' }}>
                              {item.value}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* AI analysis shortcut */}
                    {expandedAiAnalysis && (
                      <div style={{ backgroundColor: 'rgba(10,46,80,0.03)', border: '1.5px solid rgba(10,46,80,0.12)', borderRadius: '10px', padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <div style={{ width: '38px', height: '38px', borderRadius: '10px', backgroundColor: '#0A2E50', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <Sparkles size={18} color="#FFD700" />
                          </div>
                          <div>
                            <div style={{ fontWeight: 700, color: '#0A2E50', fontSize: '0.875rem' }}>Análise IA disponível</div>
                            <div style={{ fontSize: '0.75rem', color: '#888', marginTop: '0.1rem' }}>
                              Risco:{' '}
                              <span style={{ fontWeight: 600, color: expandedAiAnalysis.riskLevel === 'BAIXO' ? '#2ECC71' : expandedAiAnalysis.riskLevel === 'ALTO' ? '#e74c3c' : '#f39c12' }}>
                                {expandedAiAnalysis.riskLevel}
                              </span>
                              {' · '}Gerada em {formatDate(expandedAiAnalysis.analyzedAt)}
                            </div>
                          </div>
                        </div>
                        <Link
                          href={`/dashboard/analise/${entry.propertyId}`}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1rem', borderRadius: '8px', backgroundColor: '#0A2E50', color: 'white', fontWeight: 700, fontSize: '0.8rem', textDecoration: 'none' }}
                        >
                          Ver análise completa <ArrowRight size={14} />
                        </Link>
                      </div>
                    )}

                    {/* Saved calculator scenarios */}
                    {expandedScenarios.length > 0 && (
                      <div>
                        <h4 style={{ fontFamily: 'var(--font-montserrat, Montserrat, sans-serif)', fontWeight: 700, color: '#0A2E50', margin: '0 0 0.875rem', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <Calculator size={16} /> Cenários Financeiros Salvos ({expandedScenarios.length})
                        </h4>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.75rem' }}>
                          {expandedScenarios.map((sc) => {
                            const scRoi = sc.result?.roiSale ?? 0;
                            const scProfit = sc.result?.netProfitSale ?? 0;
                            const scColor = scRoi >= 20 ? '#2ECC71' : scRoi >= 0 ? '#f39c12' : '#e74c3c';
                            return (
                              <div key={sc.id} style={{ backgroundColor: 'white', border: '1.5px solid #e8e8e8', borderRadius: '10px', padding: '0.875rem', borderTop: `3px solid ${scColor}` }}>
                                <div style={{ fontWeight: 700, color: '#0A2E50', fontSize: '0.85rem', marginBottom: '0.5rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {sc.name}
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <div>
                                    <div style={{ fontSize: '0.68rem', color: '#999' }}>ROI Líquido</div>
                                    <div style={{ fontWeight: 800, color: scColor, fontSize: '1rem', fontFamily: 'var(--font-montserrat, Montserrat, sans-serif)' }}>{scRoi.toFixed(1)}%</div>
                                  </div>
                                  <div style={{ textAlign: 'right' }}>
                                    <div style={{ fontSize: '0.68rem', color: '#999' }}>Lucro Líquido</div>
                                    <div style={{ fontWeight: 700, color: scColor, fontSize: '0.825rem' }}>{formatCurrency(scProfit)}</div>
                                  </div>
                                </div>
                                <div style={{ fontSize: '0.68rem', color: '#bbb', marginTop: '0.5rem' }}>{formatDate(sc.savedAt)}</div>
                              </div>
                            );
                          })}
                        </div>
                        <div style={{ marginTop: '0.75rem' }}>
                          <Link
                            href={`/dashboard/analise/${entry.propertyId}`}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', color: '#1E6BB8', fontWeight: 600, textDecoration: 'none' }}
                          >
                            <Calculator size={13} /> Abrir calculadora completa <ArrowRight size={13} />
                          </Link>
                        </div>
                      </div>
                    )}

                    {/* Post-arrematation checklist */}
                    <PropertyChecklist
                      propertyId={entry.propertyId}
                      type="POST"
                      occupationStatus={entry.evictionStatus === 'PENDING' || entry.evictionStatus === 'IN_PROGRESS' ? 'OCCUPIED' : 'VACANT'}
                      basic={isFree}
                    />

                    {/* Renovation log */}
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.875rem' }}>
                        <h4 style={{ fontFamily: 'var(--font-montserrat, Montserrat, sans-serif)', fontWeight: 700, color: '#0A2E50', margin: 0, fontSize: '0.9rem' }}>
                          Diário de Reformas ({entry.renovationLog.length} etapas)
                        </h4>
                        <button
                          className="btn-outline"
                          style={{ fontSize: '0.75rem', padding: '0.375rem 0.75rem', gap: '0.375rem' }}
                          onClick={() => setShowRenovModal(entry.id)}
                        >
                          <Plus size={14} /> Registrar Etapa
                        </button>
                      </div>

                      {entry.renovationLog.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '1.5rem', backgroundColor: '#f9f9f9', borderRadius: '8px', color: '#999', fontSize: '0.875rem' }}>
                          Nenhuma etapa registrada.
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                          {entry.renovationLog.map((log) => (
                            <div key={log.id} style={{ display: 'flex', gap: '0.875rem', padding: '0.875rem', backgroundColor: '#f9f9f9', borderRadius: '8px', alignItems: 'flex-start' }}>
                              <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: 'rgba(30,107,184,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <Camera size={16} color="#1E6BB8" />
                              </div>
                              <div style={{ flex: 1 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem', flexWrap: 'wrap' }}>
                                  <div>
                                    <div style={{ fontWeight: 600, color: '#0A2E50', fontSize: '0.875rem' }}>{log.description}</div>
                                    <div style={{ fontSize: '0.75rem', color: '#999', marginTop: '0.2rem' }}>{formatDate(log.date)} · {log.stage}</div>
                                  </div>
                                  <span style={{ fontWeight: 700, color: '#e74c3c', fontSize: '0.875rem', whiteSpace: 'nowrap' }}>{formatCurrency(log.cost)}</span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Documents */}
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.875rem' }}>
                        <h4 style={{ fontFamily: 'var(--font-montserrat, Montserrat, sans-serif)', fontWeight: 700, color: '#0A2E50', margin: 0, fontSize: '0.9rem' }}>
                          Documentos ({entry.documents.length})
                        </h4>
                      </div>
                      {entry.documents.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '1rem', backgroundColor: '#f9f9f9', borderRadius: '8px', color: '#999', fontSize: '0.8rem' }}>
                          Nenhum documento registrado.
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          {entry.documents.map((doc) => (
                            <div key={doc.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem', backgroundColor: '#f9f9f9', borderRadius: '8px' }}>
                              <FileText size={18} color="#1E6BB8" />
                              <span style={{ flex: 1, fontSize: '0.875rem', color: '#0A2E50', fontWeight: 500 }}>{doc.name}</span>
                              <span style={{ fontSize: '0.75rem', color: '#999' }}>{formatDate(doc.uploadedAt)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Notes */}
                    {entry.notes && (
                      <div style={{ padding: '0.875rem 1rem', backgroundColor: 'rgba(30,107,184,0.06)', borderRadius: '8px', borderLeft: '3px solid #1E6BB8' }}>
                        <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#1E6BB8', marginBottom: '0.375rem' }}>Observações</div>
                        <p style={{ fontSize: '0.875rem', color: '#555', margin: 0, lineHeight: 1.6 }}>{entry.notes}</p>
                      </div>
                    )}

                    <Link href={`/dashboard/analise/${entry.propertyId}`} style={{ color: '#1E6BB8', fontSize: '0.875rem', fontWeight: 600, textDecoration: 'none' }}>
                      Ver análise financeira completa →
                    </Link>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── DELETE CONFIRM MODAL ──────────────────────────────── */}
      {deleteId && (
        <div className="modal-overlay" onClick={() => setDeleteId(null)}>
          <div className="modal-box" style={{ maxWidth: '360px' }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontFamily: 'var(--font-montserrat, Montserrat, sans-serif)', color: '#0A2E50', margin: '0 0 0.75rem' }}>Confirmar exclusão</h3>
            <p style={{ color: '#666', fontSize: '0.875rem', marginBottom: '1.25rem' }}>
              Tem certeza que deseja remover este imóvel das suas arrematações? Esta ação não pode ser desfeita.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button className="btn-outline" style={{ fontSize: '0.875rem' }} onClick={() => setDeleteId(null)}>Cancelar</button>
              <button
                style={{ padding: '0.6rem 1.25rem', borderRadius: '8px', border: 'none', backgroundColor: '#e74c3c', color: 'white', fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer' }}
                onClick={() => handleDelete(deleteId)}
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── EDIT MODAL ────────────────────────────────────────── */}
      {editEntry && (
        <div className="modal-overlay" onClick={() => setEditEntry(null)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ fontFamily: 'var(--font-montserrat, Montserrat, sans-serif)', color: '#0A2E50', margin: 0 }}>Editar Arrematação</h3>
              <button onClick={() => setEditEntry(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#999' }}>
                <X size={20} />
              </button>
            </div>

            <div className="form-grid">
              <div>
                <label className="form-label">Título do imóvel</label>
                <input className="input-field" value={editEntry.property.title} onChange={(e) => setEditEntry({ ...editEntry, property: { ...editEntry.property, title: e.target.value } })} style={{ fontSize: '0.875rem' }} />
              </div>
              <div className="form-grid form-grid-2">
                <div>
                  <label className="form-label">Valor Arrematado (R$)</label>
                  <input type="number" className="input-field" value={editEntry.acquiredValue} onChange={(e) => setEditEntry({ ...editEntry, acquiredValue: Number(e.target.value) })} style={{ fontSize: '0.875rem' }} />
                </div>
                <div>
                  <label className="form-label">Alvo de Venda (R$)</label>
                  <input type="number" className="input-field" value={editEntry.targetSaleValue} onChange={(e) => setEditEntry({ ...editEntry, targetSaleValue: Number(e.target.value) })} style={{ fontSize: '0.875rem' }} />
                </div>
              </div>
              <div className="form-grid form-grid-2">
                <div>
                  <label className="form-label">Documentação (R$)</label>
                  <input type="number" className="input-field" value={editEntry.actualDocumentationCosts} onChange={(e) => setEditEntry({ ...editEntry, actualDocumentationCosts: Number(e.target.value) })} style={{ fontSize: '0.875rem' }} />
                </div>
                <div>
                  <label className="form-label">Desocupação (R$)</label>
                  <input type="number" className="input-field" value={editEntry.actualEvictionCosts} onChange={(e) => setEditEntry({ ...editEntry, actualEvictionCosts: Number(e.target.value) })} style={{ fontSize: '0.875rem' }} />
                </div>
              </div>
              <div className="form-grid form-grid-2">
                <div>
                  <label className="form-label">Reforma (R$)</label>
                  <input type="number" className="input-field" value={editEntry.actualRenovationCosts} onChange={(e) => setEditEntry({ ...editEntry, actualRenovationCosts: Number(e.target.value) })} style={{ fontSize: '0.875rem' }} />
                </div>
                <div>
                  <label className="form-label">Status de desocupação</label>
                  <select className="input-field" value={editEntry.evictionStatus} onChange={(e) => setEditEntry({ ...editEntry, evictionStatus: e.target.value as EvictionStatus })} style={{ fontSize: '0.875rem' }}>
                    <option value="PENDING">Pendente</option>
                    <option value="IN_PROGRESS">Em andamento</option>
                    <option value="COMPLETED">Concluída</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="form-label">Observações</label>
                <textarea className="input-field" rows={3} value={editEntry.notes} onChange={(e) => setEditEntry({ ...editEntry, notes: e.target.value })} style={{ fontSize: '0.875rem', resize: 'vertical' }} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1.25rem' }}>
              <button className="btn-outline" style={{ fontSize: '0.875rem' }} onClick={() => setEditEntry(null)}>Cancelar</button>
              <button className="btn-primary" style={{ fontSize: '0.875rem', gap: '0.5rem' }} onClick={handleSaveEdit}>
                <Save size={15} /> Salvar alterações
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── ADD MODAL ─────────────────────────────────────────── */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ fontFamily: 'var(--font-montserrat, Montserrat, sans-serif)', color: '#0A2E50', margin: 0 }}>Adicionar Arrematação</h3>
              <button onClick={() => setShowAddModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#999' }}>
                <X size={20} />
              </button>
            </div>

            <div className="form-grid">
              <div>
                <label className="form-label">Título / Descrição do imóvel *</label>
                <input className="input-field" placeholder="Ex: Apartamento 3q - Vila Madalena" value={newEntry.title} onChange={(e) => setNewEntry({ ...newEntry, title: e.target.value })} style={{ fontSize: '0.875rem' }} />
              </div>
              <div>
                <label className="form-label">Endereço</label>
                <input className="input-field" placeholder="Rua, número, complemento" value={newEntry.address} onChange={(e) => setNewEntry({ ...newEntry, address: e.target.value })} style={{ fontSize: '0.875rem' }} />
              </div>
              <div className="form-grid form-grid-2">
                <div>
                  <label className="form-label">Cidade</label>
                  <input className="input-field" value={newEntry.city} onChange={(e) => setNewEntry({ ...newEntry, city: e.target.value })} style={{ fontSize: '0.875rem' }} />
                </div>
                <div>
                  <label className="form-label">UF</label>
                  <input className="input-field" maxLength={2} value={newEntry.state} onChange={(e) => setNewEntry({ ...newEntry, state: e.target.value.toUpperCase() })} style={{ fontSize: '0.875rem' }} />
                </div>
              </div>
              <div className="form-grid form-grid-2">
                <div>
                  <label className="form-label">Valor do Lance (R$) *</label>
                  <input type="number" className="input-field" value={newEntry.acquiredValue} onChange={(e) => setNewEntry({ ...newEntry, acquiredValue: e.target.value })} style={{ fontSize: '0.875rem' }} />
                </div>
                <div>
                  <label className="form-label">Alvo de Venda (R$)</label>
                  <input type="number" className="input-field" value={newEntry.targetSaleValue} onChange={(e) => setNewEntry({ ...newEntry, targetSaleValue: e.target.value })} style={{ fontSize: '0.875rem' }} />
                </div>
              </div>
              <div className="form-grid form-grid-2">
                <div>
                  <label className="form-label">Documentação (R$)</label>
                  <input type="number" className="input-field" value={newEntry.actualDocumentationCosts} onChange={(e) => setNewEntry({ ...newEntry, actualDocumentationCosts: e.target.value })} style={{ fontSize: '0.875rem' }} />
                </div>
                <div>
                  <label className="form-label">Desocupação (R$)</label>
                  <input type="number" className="input-field" value={newEntry.actualEvictionCosts} onChange={(e) => setNewEntry({ ...newEntry, actualEvictionCosts: e.target.value })} style={{ fontSize: '0.875rem' }} />
                </div>
              </div>
              <div className="form-grid form-grid-2">
                <div>
                  <label className="form-label">Data da arrematação</label>
                  <input type="date" className="input-field" value={newEntry.acquiredAt} onChange={(e) => setNewEntry({ ...newEntry, acquiredAt: e.target.value })} style={{ fontSize: '0.875rem' }} />
                </div>
                <div>
                  <label className="form-label">Status de desocupação</label>
                  <select className="input-field" value={newEntry.evictionStatus} onChange={(e) => setNewEntry({ ...newEntry, evictionStatus: e.target.value as EvictionStatus })} style={{ fontSize: '0.875rem' }}>
                    <option value="PENDING">Pendente</option>
                    <option value="IN_PROGRESS">Em andamento</option>
                    <option value="COMPLETED">Concluída</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="form-label">Observações</label>
                <textarea className="input-field" rows={2} value={newEntry.notes} onChange={(e) => setNewEntry({ ...newEntry, notes: e.target.value })} style={{ fontSize: '0.875rem', resize: 'vertical' }} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1.25rem' }}>
              <button className="btn-outline" style={{ fontSize: '0.875rem' }} onClick={() => setShowAddModal(false)}>Cancelar</button>
              <button className="btn-primary" style={{ fontSize: '0.875rem', gap: '0.5rem' }} onClick={handleAddEntry} disabled={!newEntry.title && !newEntry.acquiredValue}>
                <Plus size={15} /> Adicionar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── ADD RENOVATION MODAL ─────────────────────────────── */}
      {showRenovModal && (
        <div className="modal-overlay" onClick={() => setShowRenovModal(null)}>
          <div className="modal-box" style={{ maxWidth: '400px' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ fontFamily: 'var(--font-montserrat, Montserrat, sans-serif)', color: '#0A2E50', margin: 0 }}>Registrar Etapa de Reforma</h3>
              <button onClick={() => setShowRenovModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#999' }}>
                <X size={20} />
              </button>
            </div>
            <div className="form-grid">
              <div>
                <label className="form-label">Descrição *</label>
                <input className="input-field" placeholder="Ex: Pintura interna completa" value={renovForm.description} onChange={(e) => setRenovForm({ ...renovForm, description: e.target.value })} style={{ fontSize: '0.875rem' }} />
              </div>
              <div className="form-grid form-grid-2">
                <div>
                  <label className="form-label">Etapa</label>
                  <input className="input-field" placeholder="Ex: Pintura" value={renovForm.stage} onChange={(e) => setRenovForm({ ...renovForm, stage: e.target.value })} style={{ fontSize: '0.875rem' }} />
                </div>
                <div>
                  <label className="form-label">Custo (R$)</label>
                  <input type="number" className="input-field" value={renovForm.cost} onChange={(e) => setRenovForm({ ...renovForm, cost: e.target.value })} style={{ fontSize: '0.875rem' }} />
                </div>
              </div>
              <div>
                <label className="form-label">Data</label>
                <input type="date" className="input-field" value={renovForm.date} onChange={(e) => setRenovForm({ ...renovForm, date: e.target.value })} style={{ fontSize: '0.875rem' }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1.25rem' }}>
              <button className="btn-outline" style={{ fontSize: '0.875rem' }} onClick={() => setShowRenovModal(null)}>Cancelar</button>
              <button className="btn-primary" style={{ fontSize: '0.875rem', gap: '0.5rem' }} onClick={() => handleAddRenovation(showRenovModal)} disabled={!renovForm.description}>
                <Save size={15} /> Registrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
