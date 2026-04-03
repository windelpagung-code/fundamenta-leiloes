'use client';

import { useState } from 'react';
import { Search, SlidersHorizontal, X, ChevronDown } from 'lucide-react';
import { PropertyFilters, BRAZIL_STATES, BANKS, AUCTIONEERS } from '@/types/property';

interface PropertyFiltersProps {
  filters: PropertyFilters;
  onChange: (filters: PropertyFilters) => void;
  total: number;
  modalities?: string[];
}

export default function PropertyFiltersComponent({ filters, onChange, total, modalities = [] }: PropertyFiltersProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  const hasActiveFilters = Object.values(filters).some((v) => v !== undefined && v !== '');

  function clearFilters() {
    onChange({});
  }

  return (
    <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '1.25rem', boxShadow: '0 2px 8px rgba(10,46,80,0.08)', marginBottom: '1.5rem' }}>
      {/* Search + sort + toggle */}
      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: showAdvanced ? '1rem' : 0, flexWrap: 'wrap', paddingBottom: filters.search ? '1.25rem' : 0 }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '180px' }}>
          <Search size={16} style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', color: '#999' }} />
          <input
            type="text"
            placeholder="Buscar por cidade, bairro ou estado..."
            value={filters.search || ''}
            onChange={(e) => onChange({ ...filters, search: e.target.value || undefined })}
            className="input-field"
            style={{ paddingLeft: '2.5rem', paddingRight: '1rem' }}
          />
          {filters.search && (
            <label style={{
              position: 'absolute', top: 'calc(100% + 4px)', left: 0,
              display: 'flex', alignItems: 'center', gap: '0.35rem',
              fontSize: '0.72rem', color: '#888', cursor: 'pointer',
              whiteSpace: 'nowrap', userSelect: 'none',
            }}>
              <input
                type="checkbox"
                checked={!!filters.searchAddress}
                onChange={(e) => onChange({ ...filters, searchAddress: e.target.checked || undefined })}
                style={{ width: '13px', height: '13px', accentColor: '#1E6BB8', cursor: 'pointer' }}
              />
              Incluir busca por rua/endereço
            </label>
          )}
        </div>

        {/* Sort */}
        <div style={{ position: 'relative' }}>
          <select
            value={filters.sortBy || ''}
            onChange={(e) => onChange({ ...filters, sortBy: (e.target.value as never) || undefined })}
            className="input-field"
            style={{
              paddingLeft: '0.875rem', paddingRight: '2.25rem',
              fontSize: '0.825rem', minWidth: '170px',
              appearance: 'none', WebkitAppearance: 'none',
            }}
          >
            <option value="">Ordenar por...</option>
            <option value="discount_desc">Maior desconto</option>
            <option value="discount_asc">Menor desconto</option>
            <option value="price_asc">Menor lance</option>
            <option value="price_desc">Maior lance</option>
            <option value="value_desc">Maior valor de mercado</option>
            <option value="value_asc">Menor valor de mercado</option>
          </select>
          <ChevronDown size={15} style={{ position: 'absolute', right: '0.6rem', top: '50%', transform: 'translateY(-50%)', color: '#666', pointerEvents: 'none' }} />
        </div>

        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.75rem 1rem',
            borderRadius: '8px',
            border: `2px solid ${showAdvanced ? '#1E6BB8' : '#d1d5db'}`,
            backgroundColor: showAdvanced ? 'rgba(30,107,184,0.08)' : 'white',
            color: showAdvanced ? '#1E6BB8' : '#666',
            fontWeight: 600,
            fontSize: '0.875rem',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            fontFamily: 'var(--font-montserrat, Montserrat, sans-serif)',
          }}
        >
          <SlidersHorizontal size={16} />
          <span style={{ display: 'none' }} className="filter-label">Filtros</span>
          <style>{`@media(min-width:480px){.filter-label{display:inline!important}}`}</style>
          {hasActiveFilters && (
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#e74c3c', display: 'inline-block' }} />
          )}
        </button>
        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', padding: '0.75rem 0.875rem', borderRadius: '8px', border: '2px solid rgba(231,76,60,0.3)', backgroundColor: 'rgba(231,76,60,0.06)', color: '#e74c3c', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer', whiteSpace: 'nowrap' }}
            title="Limpar filtros"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* Advanced filters */}
      {showAdvanced && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0.875rem', paddingTop: '1rem', borderTop: '1px solid #f0f0f0' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#0A2E50', marginBottom: '0.375rem' }}>Estado</label>
            <select
              value={filters.state || ''}
              onChange={(e) => onChange({ ...filters, state: e.target.value || undefined })}
              className="input-field"
              style={{ padding: '0.625rem 0.75rem', fontSize: '0.875rem' }}
            >
              <option value="">Todos os estados</option>
              {BRAZIL_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#0A2E50', marginBottom: '0.375rem' }}>Tipo de imóvel</label>
            <select
              value={filters.propertyType || ''}
              onChange={(e) => onChange({ ...filters, propertyType: e.target.value as never || undefined })}
              className="input-field"
              style={{ padding: '0.625rem 0.75rem', fontSize: '0.875rem' }}
            >
              <option value="">Todos os tipos</option>
              <option value="HOUSE">Casa</option>
              <option value="APARTMENT">Apartamento</option>
              <option value="LAND">Terreno</option>
              <option value="COMMERCIAL">Comercial / Sala</option>
              <option value="RURAL">Rural</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#0A2E50', marginBottom: '0.375rem' }}>Banco</label>
            <select
              value={filters.sourceBank || ''}
              onChange={(e) => onChange({ ...filters, sourceBank: e.target.value || undefined })}
              className="input-field"
              style={{ padding: '0.625rem 0.75rem', fontSize: '0.875rem' }}
            >
              <option value="">Todos os bancos</option>
              {BANKS.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#0A2E50', marginBottom: '0.375rem' }}>Leiloeiro</label>
            <select
              value={filters.sourceAuctioneer || ''}
              onChange={(e) => onChange({ ...filters, sourceAuctioneer: e.target.value || undefined })}
              className="input-field"
              style={{ padding: '0.625rem 0.75rem', fontSize: '0.875rem' }}
            >
              <option value="">Todos os leiloeiros</option>
              {AUCTIONEERS.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#0A2E50', marginBottom: '0.375rem' }}>Ocupação</label>
            <select
              value={filters.occupationStatus || ''}
              onChange={(e) => onChange({ ...filters, occupationStatus: e.target.value as never || undefined })}
              className="input-field"
              style={{ padding: '0.625rem 0.75rem', fontSize: '0.875rem' }}
            >
              <option value="">Qualquer status</option>
              <option value="VACANT">Desocupado</option>
              <option value="OCCUPIED">Ocupado</option>
              <option value="UNKNOWN">Não informado</option>
            </select>
          </div>

          {modalities.length > 0 && (
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#0A2E50', marginBottom: '0.375rem' }}>Modalidade de venda</label>
              <select
                value={filters.modalidade || ''}
                onChange={(e) => onChange({ ...filters, modalidade: e.target.value || undefined })}
                className="input-field"
                style={{ padding: '0.625rem 0.75rem', fontSize: '0.875rem' }}
              >
                <option value="">Todas as modalidades</option>
                {modalities.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#0A2E50', marginBottom: '0.375rem' }}>Forma de pagamento</label>
            <select
              value={filters.paymentMethod || ''}
              onChange={(e) => onChange({ ...filters, paymentMethod: e.target.value || undefined })}
              className="input-field"
              style={{ padding: '0.625rem 0.75rem', fontSize: '0.875rem' }}
            >
              <option value="">Todas as formas</option>
              <option value="À Vista">À Vista (Recursos próprios)</option>
              <option value="FGTS">FGTS</option>
              <option value="Financiamento SBPE">Financiamento SBPE</option>
              <option value="Financiamento">Financiamento</option>
              <option value="Parcelamento Caixa">Parcelamento Caixa</option>
              <option value="Parcelamento">Parcelamento</option>
              <option value="Carta de Crédito">Carta de Crédito</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#0A2E50', marginBottom: '0.375rem' }}>Lance mínimo (R$)</label>
            <input
              type="number"
              placeholder="Ex: 100000"
              value={filters.minValue || ''}
              onChange={(e) => onChange({ ...filters, minValue: e.target.value ? Number(e.target.value) : undefined })}
              className="input-field"
              style={{ padding: '0.625rem 0.75rem', fontSize: '0.875rem' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#0A2E50', marginBottom: '0.375rem' }}>Lance máximo (R$)</label>
            <input
              type="number"
              placeholder="Ex: 1000000"
              value={filters.maxValue || ''}
              onChange={(e) => onChange({ ...filters, maxValue: e.target.value ? Number(e.target.value) : undefined })}
              className="input-field"
              style={{ padding: '0.625rem 0.75rem', fontSize: '0.875rem' }}
            />
          </div>
        </div>
      )}

      {/* Results count */}
      <div style={{ marginTop: showAdvanced ? '0.875rem' : '0.75rem', paddingTop: showAdvanced ? '0.875rem' : 0, borderTop: showAdvanced ? '1px solid #f0f0f0' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '0.825rem', color: '#666' }}>
          <strong style={{ color: '#0A2E50' }}>{total}</strong> {total === 1 ? 'imóvel encontrado' : 'imóveis encontrados'}
        </span>
        {hasActiveFilters && (
          <button onClick={clearFilters} style={{ fontSize: '0.8rem', color: '#1E6BB8', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
            Limpar filtros
          </button>
        )}
      </div>
    </div>
  );
}
