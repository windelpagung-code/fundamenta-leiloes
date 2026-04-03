'use client';

import { useState, useEffect } from 'react';
import { DollarSign, TrendingUp, Calculator, Save, Trash2, BarChart2, X, Plus, ChevronDown, ChevronUp, Lock } from 'lucide-react';
import Link from 'next/link';
import { Property } from '@/types/property';
import { ExtendedCalculatorInput, ExtendedCalculatorResult, CalcScenario, calculateExtended } from '@/types/financialAnalysis';
import { formatCurrency } from '@/lib/utils';

const SCENARIOS_KEY = 'fundamenta_calc_scenarios';

function loadScenarios(propertyId: string): CalcScenario[] {
  try {
    const all: CalcScenario[] = JSON.parse(localStorage.getItem(SCENARIOS_KEY) || '[]');
    return all.filter((s) => s.propertyId === propertyId);
  } catch { return []; }
}

function saveScenarios(propertyId: string, scenarios: CalcScenario[]) {
  try {
    const all: CalcScenario[] = JSON.parse(localStorage.getItem(SCENARIOS_KEY) || '[]');
    const others = all.filter((s) => s.propertyId !== propertyId);
    localStorage.setItem(SCENARIOS_KEY, JSON.stringify([...others, ...scenarios]));
  } catch { /* ignore */ }
}

function defaultInput(property: Property): ExtendedCalculatorInput {
  return {
    bidValue: property.initialBid,
    marketValue: property.marketValue,
    areaTotal: property.areaTotal,
    paymentMethod: 'CASH',
    downPaymentPercentage: 30,
    financingTermMonths: 120,
    financingInterestRate: 1.0,
    auctioneerFeePercentage: 5,
    documentationCosts: Math.round(property.initialBid * 0.04),
    evictionCosts: property.occupationStatus === 'OCCUPIED' ? 15000 : 0,
    renovationBudget: 30000,
    salePrice: Math.round(property.marketValue * 1.05),
    sellingCommission: 6,
    capitalGainsTax: 15,
    monthlyIPTU: 200,
    monthlyCondominium: property.propertyType === 'APARTMENT' ? 600 : 0,
    holdingPeriodMonths: 12,
    expectedMonthlyRent: Math.round(property.marketValue * 0.004),
  };
}

type Tab = 'simulacao' | 'graficos' | 'cenarios';

interface FinancialCalculatorProps {
  property: Property;
  isFree?: boolean;
}

// CSS donut chart helpers
function buildGradient(segments: Array<{ pct: number; color: string }>) {
  let deg = 0;
  const parts = segments.filter((s) => s.pct > 0).map((s) => {
    const start = deg;
    deg += s.pct * 3.6;
    return `${s.color} ${start.toFixed(1)}deg ${deg.toFixed(1)}deg`;
  });
  return `conic-gradient(${parts.join(', ')})`;
}

export default function FinancialCalculator({ property, isFree = false }: FinancialCalculatorProps) {
  const [tab, setTab] = useState<Tab>('simulacao');
  const [input, setInput] = useState<ExtendedCalculatorInput>(() => defaultInput(property));
  const [scenarios, setScenarios] = useState<CalcScenario[]>([]);
  const [scenarioName, setScenarioName] = useState('');
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    setScenarios(loadScenarios(property.id));
  }, [property.id]);

  const result: ExtendedCalculatorResult = calculateExtended(input);

  function upd(field: keyof ExtendedCalculatorInput, value: number | string) {
    setInput((prev) => ({ ...prev, [field]: value }));
  }

  function handleSaveScenario() {
    const name = scenarioName.trim();
    if (!name) return;
    const scenario: CalcScenario = {
      id: `sc-${Date.now()}`,
      name,
      propertyId: property.id,
      input: { ...input },
      result: { ...result },
      savedAt: new Date().toISOString(),
    };
    const updated = [...scenarios, scenario];
    setScenarios(updated);
    saveScenarios(property.id, updated);
    setScenarioName('');
    setShowSaveModal(false);
  }

  function deleteScenario(id: string) {
    const updated = scenarios.filter((s) => s.id !== id);
    setScenarios(updated);
    saveScenarios(property.id, updated);
    setCompareIds((prev) => prev.filter((cid) => cid !== id));
  }

  function loadScenario(sc: CalcScenario) {
    setInput({ ...sc.input });
    setTab('simulacao');
  }

  function toggleCompare(id: string) {
    setCompareIds((prev) =>
      prev.includes(id) ? prev.filter((cid) => cid !== id) : prev.length < 4 ? [...prev, id] : prev
    );
  }

  const roiColor = result.roiSale >= 20 ? '#2ECC71' : result.roiSale >= 0 ? '#f39c12' : '#e74c3c';
  const profitColor = result.netProfitSale >= 0 ? '#2ECC71' : '#e74c3c';

  // Chart segments for cost pie
  const totalAll = result.totalAcquisitionCost + result.holdingCosts + result.sellingCommissionCost + result.capitalGainsTaxAmount;
  const pctOf = (v: number) => totalAll > 0 ? (v / totalAll) * 100 : 0;
  const chartSegments = [
    { label: 'Lance',         color: '#0A2E50',  value: input.bidValue,                    pct: pctOf(input.bidValue) },
    { label: 'Leiloeiro',     color: '#e74c3c',  value: result.auctioneerFee,              pct: pctOf(result.auctioneerFee) },
    { label: 'Documentação',  color: '#f39c12',  value: input.documentationCosts,           pct: pctOf(input.documentationCosts) },
    { label: 'Desocupação',   color: '#e67e22',  value: input.evictionCosts,               pct: pctOf(input.evictionCosts) },
    { label: 'Reforma',       color: '#9b59b6',  value: input.renovationBudget,            pct: pctOf(input.renovationBudget) },
    { label: 'Holding',       color: '#3498db',  value: result.holdingCosts,               pct: pctOf(result.holdingCosts) },
    { label: 'Comissão venda', color: '#1abc9c', value: result.sellingCommissionCost,      pct: pctOf(result.sellingCommissionCost) },
    { label: 'IR',            color: '#7f8c8d',  value: result.capitalGainsTaxAmount,      pct: pctOf(result.capitalGainsTaxAmount) },
  ];

  const compareScenarios = scenarios.filter((s) => compareIds.includes(s.id));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <style>{`
        .calc-tab-btn { padding: 0.5rem 1rem; border-radius: 8px; border: 2px solid transparent; cursor: pointer; font-size: 0.8rem; font-weight: 700; transition: all 0.2s; display: flex; align-items: center; gap: 0.4rem; }
        .calc-tab-btn.active { border-color: #1E6BB8; background: rgba(30,107,184,0.08); color: #1E6BB8; }
        .calc-tab-btn:not(.active) { background: white; color: #666; border-color: #e0e0e0; }
        .calc-tab-btn:not(.active):hover { border-color: #1E6BB8; color: #1E6BB8; }
        .bar-segment { height: 100%; transition: width 0.4s ease; }
        .scenario-card { background: white; border-radius: 10px; border: 1.5px solid #e8e8e8; padding: 1rem; transition: border-color 0.2s; }
        .scenario-card.selected { border-color: #1E6BB8; background: rgba(30,107,184,0.04); }
        .compare-col { background: white; border-radius: 10px; padding: 1rem; border: 1.5px solid #e0e0e0; }
        .compare-col:first-child { border-color: #1E6BB8; }
      `}</style>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        {([
          { key: 'simulacao', label: 'Simulação', icon: Calculator },
          { key: 'graficos',  label: 'Gráficos',  icon: BarChart2 },
          { key: 'cenarios',  label: `Cenários${scenarios.length > 0 ? ` (${scenarios.length})` : ''}`, icon: Save },
        ] as { key: Tab; label: string; icon: React.ComponentType<{size:number}> }[]).map(({ key, label, icon: Icon }) => (
          <button key={key} className={`calc-tab-btn${tab === key ? ' active' : ''}`} onClick={() => setTab(key)}>
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {/* ── SIMULAÇÃO TAB ──────────────────────────────────────── */}
      {tab === 'simulacao' && (
        <>
          {/* KPI summary */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '1rem' }}>
            {[
              { label: 'Custo Total Operação', value: formatCurrency(result.totalAcquisitionCost), color: '#0A2E50', icon: DollarSign },
              { label: 'Lucro Líquido (venda)', value: formatCurrency(result.netProfitSale), color: profitColor, icon: TrendingUp },
              { label: 'ROI Líquido',           value: `${result.roiSale.toFixed(1)}%`,             color: roiColor,   icon: Calculator },
              { label: 'Yield Aluguel/ano',      value: `${result.annualRentalYield.toFixed(1)}%`,   color: '#1E6BB8',  icon: TrendingUp },
              ...(input.paymentMethod === 'FINANCING' && result.monthlyPayment
                ? [{ label: 'Parcela Mensal', value: formatCurrency(result.monthlyPayment), color: '#9b59b6', icon: DollarSign }]
                : []),
            ].map((item) => (
              <div key={item.label} style={{ backgroundColor: 'white', borderRadius: '10px', padding: '1rem', boxShadow: '0 1px 6px rgba(10,46,80,0.08)', borderTop: `3px solid ${item.color}` }}>
                <div style={{ fontSize: '0.72rem', color: '#666', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <item.icon size={12} /> {item.label}
                </div>
                <div style={{ fontSize: '1.15rem', fontWeight: 800, color: item.color, fontFamily: 'var(--font-montserrat, Montserrat, sans-serif)' }}>
                  {item.value}
                </div>
              </div>
            ))}
          </div>

          {/* Cost breakdown */}
          <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '1.25rem', boxShadow: '0 1px 6px rgba(10,46,80,0.08)' }}>
            <h3 style={{ fontFamily: 'var(--font-montserrat, Montserrat, sans-serif)', fontSize: '0.95rem', fontWeight: 700, color: '#0A2E50', margin: '0 0 0.875rem' }}>
              Composição dos Custos
            </h3>
            {[
              { label: 'Valor do Lance',        value: input.bidValue,              color: '#0A2E50' },
              { label: `Comissão Leiloeiro (${input.auctioneerFeePercentage}%)`, value: result.auctioneerFee, color: '#e74c3c' },
              { label: 'Documentação (ITBI, Registro)', value: input.documentationCosts, color: '#f39c12' },
              { label: 'Desocupação',           value: input.evictionCosts,         color: '#e67e22' },
              { label: 'Reforma',               value: input.renovationBudget,       color: '#9b59b6' },
              { label: `Holding (${input.holdingPeriodMonths} meses)`, value: result.holdingCosts, color: '#3498db' },
              { label: `Comissão Venda (${input.sellingCommission}%)`, value: result.sellingCommissionCost, color: '#1abc9c' },
              { label: `IR s/ ganho (${input.capitalGainsTax}%)`,     value: result.capitalGainsTaxAmount, color: '#7f8c8d' },
            ].map((item) => (
              <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.45rem 0', borderBottom: '1px solid #f5f5f5' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.825rem', color: '#555' }}>
                  <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: item.color, flexShrink: 0 }} />
                  {item.label}
                </div>
                <span style={{ fontWeight: 700, color: '#0A2E50', fontSize: '0.825rem' }}>{formatCurrency(item.value)}</span>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 0 0', marginTop: '0.25rem' }}>
              <span style={{ fontWeight: 700, color: '#0A2E50', fontSize: '0.9rem', fontFamily: 'var(--font-montserrat, Montserrat, sans-serif)' }}>CUSTO TOTAL + ENCARGOS VENDA</span>
              <span style={{ fontWeight: 800, color: '#0A2E50', fontSize: '1rem', fontFamily: 'var(--font-montserrat, Montserrat, sans-serif)' }}>
                {formatCurrency(result.totalAcquisitionCost + result.holdingCosts + result.sellingCommissionCost + result.capitalGainsTaxAmount)}
              </span>
            </div>
          </div>

          {/* Inputs */}
          <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '1.25rem', boxShadow: '0 1px 6px rgba(10,46,80,0.08)' }}>
            <h3 style={{ fontFamily: 'var(--font-montserrat, Montserrat, sans-serif)', fontSize: '0.95rem', fontWeight: 700, color: '#0A2E50', margin: '0 0 1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Calculator size={17} /> Parâmetros da Simulação
            </h3>

            {/* Core fields */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#0A2E50', marginBottom: '0.3rem' }}>
                  Valor do Lance (R$)
                </label>
                <input type="number" value={input.bidValue} onChange={(e) => upd('bidValue', Number(e.target.value))} className="input-field" style={{ fontSize: '0.875rem' }} />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#0A2E50', marginBottom: '0.3rem' }}>
                  Preço de Venda Esperado (R$)
                </label>
                <input type="number" value={input.salePrice} onChange={(e) => upd('salePrice', Number(e.target.value))} className="input-field" style={{ fontSize: '0.875rem' }} />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#0A2E50', marginBottom: '0.3rem' }}>
                  Forma de Pagamento
                </label>
                <select value={input.paymentMethod} onChange={(e) => upd('paymentMethod', e.target.value)} className="input-field" style={{ fontSize: '0.875rem' }}>
                  <option value="CASH">À Vista</option>
                  <option value="FINANCING">Financiamento</option>
                </select>
              </div>

              {input.paymentMethod === 'FINANCING' && (
                <>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#0A2E50', marginBottom: '0.3rem' }}>Entrada (%)</label>
                    <input type="number" value={input.downPaymentPercentage} onChange={(e) => upd('downPaymentPercentage', Number(e.target.value))} min="0" max="100" className="input-field" style={{ fontSize: '0.875rem' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#0A2E50', marginBottom: '0.3rem' }}>Prazo (meses)</label>
                    <input type="number" value={input.financingTermMonths} onChange={(e) => upd('financingTermMonths', Number(e.target.value))} className="input-field" style={{ fontSize: '0.875rem' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#0A2E50', marginBottom: '0.3rem' }}>Taxa de Juros (% a.m.)</label>
                    <input type="number" step="0.01" value={input.financingInterestRate} onChange={(e) => upd('financingInterestRate', Number(e.target.value))} className="input-field" style={{ fontSize: '0.875rem' }} />
                  </div>
                </>
              )}

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#0A2E50', marginBottom: '0.3rem' }}>Comissão Leiloeiro (%)</label>
                <input type="number" step="0.5" value={input.auctioneerFeePercentage} onChange={(e) => upd('auctioneerFeePercentage', Number(e.target.value))} className="input-field" style={{ fontSize: '0.875rem' }} />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#0A2E50', marginBottom: '0.3rem' }}>
                  Documentação (R$)
                </label>
                <input type="number" value={input.documentationCosts} onChange={(e) => upd('documentationCosts', Number(e.target.value))} className="input-field" style={{ fontSize: '0.875rem' }} />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#0A2E50', marginBottom: '0.3rem' }}>Desocupação (R$)</label>
                <input type="number" value={input.evictionCosts} onChange={(e) => upd('evictionCosts', Number(e.target.value))} className="input-field" style={{ fontSize: '0.875rem' }} />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#0A2E50', marginBottom: '0.3rem' }}>Reforma (R$)</label>
                <input type="number" value={input.renovationBudget} onChange={(e) => upd('renovationBudget', Number(e.target.value))} className="input-field" style={{ fontSize: '0.875rem' }} />
              </div>
            </div>

            {/* Advanced toggle */}
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'none', border: 'none', color: '#1E6BB8', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, marginBottom: showAdvanced ? '1rem' : 0, padding: '0.25rem 0' }}
            >
              {showAdvanced ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
              {showAdvanced ? 'Ocultar parâmetros avançados' : 'Mostrar parâmetros avançados (holding, IR, aluguel)'}
            </button>

            {showAdvanced && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem', paddingTop: '0.25rem', borderTop: '1px solid #f0f0f0' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#0A2E50', marginBottom: '0.3rem' }}>IPTU Mensal (R$)</label>
                  <input type="number" value={input.monthlyIPTU} onChange={(e) => upd('monthlyIPTU', Number(e.target.value))} className="input-field" style={{ fontSize: '0.875rem' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#0A2E50', marginBottom: '0.3rem' }}>Condomínio Mensal (R$)</label>
                  <input type="number" value={input.monthlyCondominium} onChange={(e) => upd('monthlyCondominium', Number(e.target.value))} className="input-field" style={{ fontSize: '0.875rem' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#0A2E50', marginBottom: '0.3rem' }}>Período Holding (meses)</label>
                  <input type="number" value={input.holdingPeriodMonths} onChange={(e) => upd('holdingPeriodMonths', Number(e.target.value))} className="input-field" style={{ fontSize: '0.875rem' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#0A2E50', marginBottom: '0.3rem' }}>Comissão na Venda (%)</label>
                  <input type="number" step="0.5" value={input.sellingCommission} onChange={(e) => upd('sellingCommission', Number(e.target.value))} className="input-field" style={{ fontSize: '0.875rem' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#0A2E50', marginBottom: '0.3rem' }}>IR s/ Ganho de Capital (%)</label>
                  <input type="number" step="0.5" value={input.capitalGainsTax} onChange={(e) => upd('capitalGainsTax', Number(e.target.value))} className="input-field" style={{ fontSize: '0.875rem' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#0A2E50', marginBottom: '0.3rem' }}>Aluguel Esperado (R$/mês)</label>
                  <input type="number" value={input.expectedMonthlyRent} onChange={(e) => upd('expectedMonthlyRent', Number(e.target.value))} className="input-field" style={{ fontSize: '0.875rem' }} />
                </div>
              </div>
            )}
          </div>

          {/* Rental scenario */}
          <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '1.25rem', boxShadow: '0 1px 6px rgba(10,46,80,0.08)', borderLeft: '4px solid #1E6BB8' }}>
            <h3 style={{ fontFamily: 'var(--font-montserrat, Montserrat, sans-serif)', fontSize: '0.95rem', fontWeight: 700, color: '#0A2E50', margin: '0 0 0.875rem' }}>
              Cenário de Aluguel
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '0.75rem' }}>
              {[
                { label: 'Aluguel bruto/mês', value: formatCurrency(input.expectedMonthlyRent) },
                { label: 'IPTU + Cond./mês',  value: formatCurrency(input.monthlyIPTU + input.monthlyCondominium) },
                { label: 'Renda líquida/mês', value: formatCurrency(result.monthlyNetRent) },
                { label: 'Yield anual líquido', value: `${result.annualRentalYield.toFixed(2)}%`, highlight: true },
              ].map((item) => (
                <div key={item.label} style={{ padding: '0.625rem 0.75rem', backgroundColor: '#f9f9f9', borderRadius: '8px' }}>
                  <div style={{ fontSize: '0.7rem', color: '#999', marginBottom: '0.25rem' }}>{item.label}</div>
                  <div style={{ fontWeight: item.highlight ? 800 : 700, color: item.highlight ? '#1E6BB8' : '#0A2E50', fontSize: item.highlight ? '1rem' : '0.875rem', fontFamily: item.highlight ? 'var(--font-montserrat, Montserrat, sans-serif)' : 'inherit' }}>
                    {item.value}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Save scenario button */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            {isFree ? (
              <Link href="/dashboard/perfil" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.55rem 1rem', borderRadius: '8px', border: '2px solid #e0e0e0', backgroundColor: '#fafafa', color: '#999', fontSize: '0.825rem', fontWeight: 700, textDecoration: 'none' }}>
                <Lock size={14} /> Salvar cenário (Premium)
              </Link>
            ) : (
              <button
                onClick={() => { setScenarioName(''); setShowSaveModal(true); }}
                style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.55rem 1rem', borderRadius: '8px', border: '2px solid #1E6BB8', backgroundColor: 'rgba(30,107,184,0.06)', color: '#1E6BB8', cursor: 'pointer', fontSize: '0.825rem', fontWeight: 700 }}
              >
                <Save size={15} /> Salvar este cenário
              </button>
            )}
            {scenarios.length > 0 && (
              <button onClick={() => setTab('cenarios')} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.55rem 1rem', borderRadius: '8px', border: '2px solid #e0e0e0', backgroundColor: 'white', color: '#666', cursor: 'pointer', fontSize: '0.825rem', fontWeight: 700 }}>
                <BarChart2 size={14} /> Ver {scenarios.length} cenários salvos
              </button>
            )}
          </div>

          {/* Save scenario modal */}
          {showSaveModal && (
            <div
              onClick={() => setShowSaveModal(false)}
              style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
            >
              <div
                onClick={(e) => e.stopPropagation()}
                style={{ backgroundColor: 'white', borderRadius: '16px', padding: '2rem', width: '100%', maxWidth: '440px', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <h2 style={{ fontFamily: 'var(--font-montserrat, Montserrat, sans-serif)', fontSize: '1.1rem', fontWeight: 800, color: '#0A2E50', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Save size={18} /> Salvar Cenário
                  </h2>
                  <button onClick={() => setShowSaveModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#999', display: 'flex', alignItems: 'center' }}>
                    <X size={22} />
                  </button>
                </div>
                <p style={{ fontSize: '0.825rem', color: '#777', margin: '0 0 1.5rem' }}>
                  Dê um nome para identificar este cenário. Ex: Pessimista, Otimista, Com financiamento.
                </p>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#0A2E50', marginBottom: '0.4rem' }}>
                  Título do cenário <span style={{ color: '#e74c3c' }}>*</span>
                </label>
                <input
                  type="text"
                  placeholder="Ex: Cenário pessimista"
                  value={scenarioName}
                  onChange={(e) => setScenarioName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSaveScenario()}
                  className="input-field"
                  style={{ fontSize: '0.9rem', padding: '0.65rem 0.875rem', marginBottom: '1.25rem', width: '100%', boxSizing: 'border-box' }}
                  autoFocus
                />
                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                  <button
                    onClick={() => setShowSaveModal(false)}
                    style={{ padding: '0.6rem 1.25rem', borderRadius: '8px', border: '2px solid #e0e0e0', backgroundColor: 'white', color: '#666', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600 }}
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleSaveScenario}
                    disabled={!scenarioName.trim()}
                    className="btn-primary"
                    style={{ fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.4rem', opacity: scenarioName.trim() ? 1 : 0.45, cursor: scenarioName.trim() ? 'pointer' : 'not-allowed' }}
                  >
                    <Save size={15} /> Salvar cenário
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── GRÁFICOS TAB ───────────────────────────────────────── */}
      {tab === 'graficos' && isFree && (
        <div style={{ backgroundColor: 'white', borderRadius: '14px', padding: '3rem 2rem', textAlign: 'center', boxShadow: '0 1px 6px rgba(10,46,80,0.08)' }}>
          <div style={{ width: '56px', height: '56px', borderRadius: '50%', backgroundColor: '#0A2E50', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
            <Lock size={24} color="#FFD700" />
          </div>
          <h3 style={{ fontFamily: 'var(--font-montserrat, Montserrat, sans-serif)', color: '#0A2E50', margin: '0 0 0.5rem', fontSize: '1.1rem' }}>Gráficos — Recurso Premium</h3>
          <p style={{ color: '#777', fontSize: '0.875rem', margin: '0 0 1.5rem', maxWidth: '360px', marginLeft: 'auto', marginRight: 'auto' }}>
            Visualize distribuição de custos, projeções de ROI e análise de cenários em gráficos interativos com o plano Premium.
          </p>
          <Link href="/dashboard/perfil" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.65rem 1.5rem', borderRadius: '9px', backgroundColor: '#FFD700', color: '#0A2E50', fontWeight: 800, fontSize: '0.875rem', textDecoration: 'none' }}>
            Assinar Premium →
          </Link>
        </div>
      )}
      {tab === 'graficos' && !isFree && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Stacked bar chart */}
          <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '1.25rem', boxShadow: '0 1px 6px rgba(10,46,80,0.08)' }}>
            <h3 style={{ fontFamily: 'var(--font-montserrat, Montserrat, sans-serif)', fontSize: '0.95rem', fontWeight: 700, color: '#0A2E50', margin: '0 0 1rem' }}>
              Distribuição de Custos
            </h3>
            {/* Stacked bar */}
            <div style={{ display: 'flex', height: '28px', borderRadius: '14px', overflow: 'hidden', marginBottom: '1rem' }}>
              {chartSegments.filter((s) => s.value > 0).map((s) => (
                <div
                  key={s.label}
                  title={`${s.label}: ${formatCurrency(s.value)} (${s.pct.toFixed(1)}%)`}
                  style={{ width: `${s.pct}%`, backgroundColor: s.color, minWidth: s.pct > 0 ? '2px' : 0 }}
                />
              ))}
            </div>
            {/* Legend */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '0.5rem' }}>
              {chartSegments.filter((s) => s.value > 0).map((s) => (
                <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.78rem', color: '#555' }}>
                  <div style={{ width: '12px', height: '12px', borderRadius: '3px', backgroundColor: s.color, flexShrink: 0 }} />
                  <span style={{ flex: 1 }}>{s.label}</span>
                  <span style={{ fontWeight: 700, color: '#0A2E50' }}>{s.pct.toFixed(0)}%</span>
                </div>
              ))}
            </div>
          </div>

          {/* Pie chart using conic-gradient */}
          <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '1.25rem', boxShadow: '0 1px 6px rgba(10,46,80,0.08)', display: 'flex', alignItems: 'center', gap: '2rem', flexWrap: 'wrap' }}>
            <div style={{ flexShrink: 0 }}>
              <div style={{
                width: '160px', height: '160px', borderRadius: '50%',
                background: buildGradient(chartSegments),
                position: 'relative',
              }}>
                <div style={{ position: 'absolute', inset: '30px', borderRadius: '50%', backgroundColor: 'white', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ fontSize: '0.65rem', color: '#999' }}>ROI Líquido</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 800, color: roiColor, fontFamily: 'var(--font-montserrat, Montserrat, sans-serif)' }}>{result.roiSale.toFixed(1)}%</div>
                </div>
              </div>
            </div>
            <div style={{ flex: 1, minWidth: '200px' }}>
              <h3 style={{ fontFamily: 'var(--font-montserrat, Montserrat, sans-serif)', fontSize: '0.95rem', fontWeight: 700, color: '#0A2E50', margin: '0 0 0.875rem' }}>Resultado Projetado</h3>
              {[
                { label: 'Preço de venda',      value: formatCurrency(input.salePrice),          color: '#2ECC71' },
                { label: '(-) Custo aquisição', value: formatCurrency(result.totalAcquisitionCost), color: '#e74c3c' },
                { label: '(-) Holding',         value: formatCurrency(result.holdingCosts),       color: '#3498db' },
                { label: '(-) Comissão venda',  value: formatCurrency(result.sellingCommissionCost), color: '#1abc9c' },
                { label: '(-) IR sobre ganho',  value: formatCurrency(result.capitalGainsTaxAmount), color: '#7f8c8d' },
                { label: '= Lucro Líquido',     value: formatCurrency(result.netProfitSale),      color: profitColor, bold: true },
              ].map((item) => (
                <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.35rem 0', borderBottom: '1px solid #f5f5f5', fontSize: '0.825rem' }}>
                  <span style={{ color: '#555', fontWeight: item.bold ? 700 : 400 }}>{item.label}</span>
                  <span style={{ fontWeight: item.bold ? 800 : 600, color: item.color }}>{item.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Projection bars by holding period */}
          <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '1.25rem', boxShadow: '0 1px 6px rgba(10,46,80,0.08)' }}>
            <h3 style={{ fontFamily: 'var(--font-montserrat, Montserrat, sans-serif)', fontSize: '0.95rem', fontWeight: 700, color: '#0A2E50', margin: '0 0 1rem' }}>
              Projeção de ROI por Prazo de Venda
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {[6, 12, 18, 24, 36].map((months) => {
                const holdCost = (input.monthlyIPTU + input.monthlyCondominium) * months;
                const np = input.salePrice - result.totalAcquisitionCost - holdCost - result.sellingCommissionCost - result.capitalGainsTaxAmount;
                const roi = result.totalAcquisitionCost > 0 ? (np / result.totalAcquisitionCost) * 100 : 0;
                const barW = Math.max(0, Math.min(100, (roi / 60) * 100));
                const color = roi >= 20 ? '#2ECC71' : roi >= 0 ? '#f39c12' : '#e74c3c';
                return (
                  <div key={months} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span style={{ fontSize: '0.75rem', color: '#666', width: '55px', flexShrink: 0 }}>{months} meses</span>
                    <div style={{ flex: 1, height: '18px', backgroundColor: '#f0f0f0', borderRadius: '9px', overflow: 'hidden' }}>
                      <div style={{ width: `${barW}%`, height: '100%', backgroundColor: color, borderRadius: '9px', transition: 'width 0.4s ease' }} />
                    </div>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color, width: '45px', textAlign: 'right', flexShrink: 0 }}>{roi.toFixed(1)}%</span>
                  </div>
                );
              })}
            </div>
            <p style={{ fontSize: '0.7rem', color: '#bbb', margin: '0.75rem 0 0', fontStyle: 'italic' }}>
              * Mantendo o preço de venda e demais custos constantes, variando apenas o custo de holding.
            </p>
          </div>
        </div>
      )}

      {/* ── CENÁRIOS TAB ───────────────────────────────────────── */}
      {tab === 'cenarios' && isFree && (
        <div style={{ backgroundColor: 'white', borderRadius: '14px', padding: '3rem 2rem', textAlign: 'center', boxShadow: '0 1px 6px rgba(10,46,80,0.08)' }}>
          <div style={{ width: '56px', height: '56px', borderRadius: '50%', backgroundColor: '#0A2E50', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
            <Lock size={24} color="#FFD700" />
          </div>
          <h3 style={{ fontFamily: 'var(--font-montserrat, Montserrat, sans-serif)', color: '#0A2E50', margin: '0 0 0.5rem', fontSize: '1.1rem' }}>Cenários Financeiros — Recurso Premium</h3>
          <p style={{ color: '#777', fontSize: '0.875rem', margin: '0 0 1.5rem', maxWidth: '360px', marginLeft: 'auto', marginRight: 'auto' }}>
            Salve e compare múltiplos cenários (otimista, pessimista, com financiamento) para encontrar a melhor estratégia de investimento.
          </p>
          <Link href="/dashboard/perfil" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.65rem 1.5rem', borderRadius: '9px', backgroundColor: '#FFD700', color: '#0A2E50', fontWeight: 800, fontSize: '0.875rem', textDecoration: 'none' }}>
            Assinar Premium →
          </Link>
        </div>
      )}
      {tab === 'cenarios' && !isFree && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {scenarios.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '4rem 2rem', backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 1px 6px rgba(10,46,80,0.08)' }}>
              <Save size={40} style={{ color: '#ddd', marginBottom: '1rem' }} />
              <h3 style={{ color: '#0A2E50', fontFamily: 'var(--font-montserrat, Montserrat, sans-serif)', marginBottom: '0.5rem' }}>
                Nenhum cenário salvo
              </h3>
              <p style={{ color: '#666', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
                Na aba Simulação, ajuste os parâmetros e clique em &quot;Salvar este cenário&quot; para criar cenários comparáveis.
              </p>
              <button onClick={() => setTab('simulacao')} className="btn-primary" style={{ fontSize: '0.875rem', gap: '0.5rem' }}>
                <Calculator size={15} /> Ir para Simulação
              </button>
            </div>
          ) : (
            <>
              {/* Scenario list */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <p style={{ margin: 0, fontSize: '0.8rem', color: '#666' }}>
                    Selecione até 4 cenários para comparar lado a lado.
                  </p>
                  {compareIds.length >= 2 && (
                    <button onClick={() => setCompareIds([])} style={{ fontSize: '0.78rem', color: '#e74c3c', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
                      Limpar seleção
                    </button>
                  )}
                </div>
                {scenarios.map((sc) => {
                  const isSelected = compareIds.includes(sc.id);
                  const rc = sc.result.roiSale >= 20 ? '#2ECC71' : sc.result.roiSale >= 0 ? '#f39c12' : '#e74c3c';
                  return (
                    <div key={sc.id} className={`scenario-card${isSelected ? ' selected' : ''}`}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem', flexWrap: 'wrap' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleCompare(sc.id)}
                              style={{ width: '16px', height: '16px', accentColor: '#1E6BB8', cursor: 'pointer' }}
                            />
                            <span style={{ fontFamily: 'var(--font-montserrat, Montserrat, sans-serif)', fontWeight: 700, color: '#0A2E50', fontSize: '0.9rem' }}>
                              {sc.name}
                            </span>
                          </div>
                          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', fontSize: '0.8rem', color: '#666' }}>
                            <span>Lance: <strong>{formatCurrency(sc.input.bidValue)}</strong></span>
                            <span>Venda: <strong>{formatCurrency(sc.input.salePrice)}</strong></span>
                            <span>ROI Líquido: <strong style={{ color: rc }}>{sc.result.roiSale.toFixed(1)}%</strong></span>
                            <span>Lucro: <strong style={{ color: rc }}>{formatCurrency(sc.result.netProfitSale)}</strong></span>
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '0.375rem' }}>
                          <button
                            onClick={() => loadScenario(sc)}
                            title="Carregar este cenário na simulação"
                            style={{ padding: '0.375rem 0.75rem', borderRadius: '7px', border: '1.5px solid #1E6BB8', backgroundColor: 'rgba(30,107,184,0.06)', color: '#1E6BB8', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700 }}
                          >
                            Editar
                          </button>
                          <button
                            onClick={() => deleteScenario(sc.id)}
                            title="Remover cenário"
                            style={{ padding: '0.375rem', borderRadius: '7px', border: '1.5px solid rgba(231,76,60,0.3)', backgroundColor: 'white', color: '#e74c3c', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Comparison table */}
              {compareScenarios.length >= 2 && (
                <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '1.25rem', boxShadow: '0 1px 6px rgba(10,46,80,0.08)', overflowX: 'auto' }}>
                  <h3 style={{ fontFamily: 'var(--font-montserrat, Montserrat, sans-serif)', fontSize: '0.95rem', fontWeight: 700, color: '#0A2E50', margin: '0 0 1rem' }}>
                    Comparação de Cenários
                  </h3>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                    <thead>
                      <tr>
                        <th style={{ textAlign: 'left', color: '#666', fontWeight: 600, padding: '0.5rem 0.5rem', borderBottom: '2px solid #e0e0e0' }}>Métrica</th>
                        {compareScenarios.map((sc) => (
                          <th key={sc.id} style={{ textAlign: 'right', color: '#0A2E50', fontWeight: 700, padding: '0.5rem 0.75rem', borderBottom: '2px solid #e0e0e0', whiteSpace: 'nowrap' }}>
                            {sc.name}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { label: 'Lance (R$)',             fn: (sc: CalcScenario) => formatCurrency(sc.input.bidValue) },
                        { label: 'Preço de venda (R$)',    fn: (sc: CalcScenario) => formatCurrency(sc.input.salePrice) },
                        { label: 'Custo total aquisição',  fn: (sc: CalcScenario) => formatCurrency(sc.result.totalAcquisitionCost) },
                        { label: 'Holding',               fn: (sc: CalcScenario) => formatCurrency(sc.result.holdingCosts) },
                        { label: 'Comissão venda',        fn: (sc: CalcScenario) => formatCurrency(sc.result.sellingCommissionCost) },
                        { label: 'IR sobre ganho',        fn: (sc: CalcScenario) => formatCurrency(sc.result.capitalGainsTaxAmount) },
                        { label: 'Lucro Líquido',         fn: (sc: CalcScenario) => formatCurrency(sc.result.netProfitSale), highlight: true },
                        { label: 'ROI Líquido',           fn: (sc: CalcScenario) => `${sc.result.roiSale.toFixed(1)}%`, highlight: true },
                        { label: 'Yield aluguel/ano',     fn: (sc: CalcScenario) => `${sc.result.annualRentalYield.toFixed(2)}%` },
                      ].map((row) => (
                        <tr key={row.label}>
                          <td style={{ padding: '0.45rem 0.5rem', color: '#555', fontWeight: row.highlight ? 700 : 400, borderBottom: '1px solid #f5f5f5', whiteSpace: 'nowrap' }}>
                            {row.label}
                          </td>
                          {compareScenarios.map((sc) => {
                            const val = row.fn(sc);
                            const isROI = row.label === 'ROI Líquido';
                            const isProfit = row.label === 'Lucro Líquido';
                            const color = isROI ? (sc.result.roiSale >= 20 ? '#2ECC71' : sc.result.roiSale >= 0 ? '#f39c12' : '#e74c3c')
                              : isProfit ? (sc.result.netProfitSale >= 0 ? '#2ECC71' : '#e74c3c') : '#0A2E50';
                            return (
                              <td key={sc.id} style={{ padding: '0.45rem 0.75rem', textAlign: 'right', fontWeight: row.highlight ? 800 : 600, color, borderBottom: '1px solid #f5f5f5', whiteSpace: 'nowrap' }}>
                                {val}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
