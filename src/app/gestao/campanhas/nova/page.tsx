'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Save, Upload, CheckCircle, AlertCircle, X } from 'lucide-react';
import { saveCampaign } from '@/lib/propertyStorage';
import { AuctionCampaign, BANKS } from '@/types/property';

export default function NovaCampanhaPage() {
  const [name, setName]               = useState('');
  const [bank, setBank]               = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate]     = useState('');
  const [endDate, setEndDate]         = useState('');
  const [active, setActive]           = useState(true);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);
  const [status, setStatus]   = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  function handleBannerChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setBannerPreview(reader.result as string);
    reader.readAsDataURL(file);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setStatus('error');
      setErrorMsg('O nome do grupo é obrigatório.');
      return;
    }

    setStatus('saving');
    const campaign: AuctionCampaign = {
      id: `campaign-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: name.trim(),
      bank: bank || undefined,
      description: description.trim() || undefined,
      bannerImage: bannerPreview || undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      active,
      createdAt: new Date().toISOString(),
    };

    try {
      await saveCampaign(campaign);
      setStatus('success');
    } catch {
      setStatus('error');
      setErrorMsg('Erro ao salvar grupo.');
    }
  }

  const inputStyle = {
    width: '100%', padding: '0.625rem 0.875rem', borderRadius: '8px',
    border: '1.5px solid #e0e0e0', fontSize: '0.875rem', color: '#333',
    outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' as const,
  };

  const labelStyle = {
    display: 'block' as const, fontSize: '0.75rem', fontWeight: 600 as const,
    color: '#0A2E50', marginBottom: '0.35rem',
  };

  if (status === 'success') {
    return (
      <div style={{ maxWidth: '700px', margin: '0 auto', padding: '2rem 1.5rem' }}>
        <div style={{ backgroundColor: 'white', borderRadius: '14px', padding: '3rem 2rem', textAlign: 'center', boxShadow: '0 1px 8px rgba(10,46,80,0.07)' }}>
          <CheckCircle size={48} color="#2ECC71" style={{ marginBottom: '1rem' }} />
          <h2 style={{ fontFamily: 'var(--font-montserrat, Montserrat, sans-serif)', color: '#0A2E50', marginBottom: '0.5rem' }}>Grupo criado!</h2>
          <p style={{ color: '#666', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
            Agora vincule imóveis a este grupo ao cadastrá-los manualmente.
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/gestao/campanhas" style={{ padding: '0.7rem 1.5rem', borderRadius: '8px', backgroundColor: '#1E6BB8', color: 'white', fontWeight: 700, fontSize: '0.875rem', textDecoration: 'none' }}>
              Ver grupos
            </Link>
            <Link href="/gestao/campanhas/nova" onClick={() => setStatus('idle')} style={{ padding: '0.7rem 1.25rem', borderRadius: '8px', border: '1.5px solid #ccc', backgroundColor: 'white', color: '#666', fontWeight: 600, fontSize: '0.875rem', textDecoration: 'none' }}>
              Criar outro
            </Link>
            <Link href="/gestao/imoveis/novo" style={{ padding: '0.7rem 1.25rem', borderRadius: '8px', border: '1.5px solid #2ECC71', backgroundColor: 'rgba(46,204,113,0.06)', color: '#1a7a43', fontWeight: 600, fontSize: '0.875rem', textDecoration: 'none' }}>
              Cadastrar imóvel
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '700px', margin: '0 auto', padding: '2rem 1.5rem 6rem' }}>

      <Link href="/gestao/campanhas" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', color: '#1E6BB8', textDecoration: 'none', fontSize: '0.875rem', fontWeight: 600, marginBottom: '1.75rem' }}>
        <ArrowLeft size={16} /> Voltar aos Grupos
      </Link>

      <div style={{ marginBottom: '1.75rem' }}>
        <h1 style={{ fontFamily: 'var(--font-montserrat, Montserrat, sans-serif)', fontSize: '1.625rem', fontWeight: 800, color: '#0A2E50', margin: '0 0 0.5rem' }}>
          Novo Grupo de Leilão
        </h1>
        <p style={{ color: '#666', margin: 0, fontSize: '0.9rem', lineHeight: 1.6 }}>
          Crie um grupo temático com banner. O banner aparecerá como carrossel no dashboard e os usuários poderão filtrar apenas os imóveis deste grupo.
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        <div style={{ backgroundColor: 'white', borderRadius: '14px', padding: '1.5rem', boxShadow: '0 1px 8px rgba(10,46,80,0.07)', marginBottom: '1.25rem' }}>
          <h3 style={{ fontFamily: 'var(--font-montserrat, Montserrat, sans-serif)', fontSize: '0.875rem', fontWeight: 700, color: '#0A2E50', margin: '0 0 1.125rem', paddingBottom: '0.75rem', borderBottom: '1px solid #f0f0f0' }}>
            Identificação
          </h3>

          <div style={{ marginBottom: '1rem' }}>
            <label style={labelStyle}>Nome do Grupo <span style={{ color: '#e74c3c' }}>*</span></label>
            <input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Leilão Especial Dia das Mães – Banco do Brasil" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
            <div>
              <label style={labelStyle}>Banco / Organizador</label>
              <select style={inputStyle} value={bank} onChange={(e) => setBank(e.target.value)}>
                <option value="">Selecionar...</option>
                {BANKS.map((b) => <option key={b} value={b}>{b}</option>)}
                <option value="Outro">Outro</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Status</label>
              <select style={inputStyle} value={active ? 'true' : 'false'} onChange={(e) => setActive(e.target.value === 'true')}>
                <option value="true">Ativo (visível no carrossel)</option>
                <option value="false">Inativo (oculto)</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
            <div>
              <label style={labelStyle}>Data de início</label>
              <input style={inputStyle} type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Data de encerramento</label>
              <input style={inputStyle} type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>

          <div>
            <label style={labelStyle}>Descrição (exibida no carrossel)</label>
            <textarea style={{ ...inputStyle, resize: 'vertical', minHeight: '72px' }}
              value={description} onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex: Mais de 300 imóveis com até 50% de desconto..." />
          </div>
        </div>

        {/* Banner upload */}
        <div style={{ backgroundColor: 'white', borderRadius: '14px', padding: '1.5rem', boxShadow: '0 1px 8px rgba(10,46,80,0.07)', marginBottom: '1.25rem' }}>
          <h3 style={{ fontFamily: 'var(--font-montserrat, Montserrat, sans-serif)', fontSize: '0.875rem', fontWeight: 700, color: '#0A2E50', margin: '0 0 1.125rem', paddingBottom: '0.75rem', borderBottom: '1px solid #f0f0f0' }}>
            Banner do Grupo
          </h3>

          {bannerPreview ? (
            <div style={{ position: 'relative' }}>
              <img src={bannerPreview} alt="Banner preview"
                style={{ width: '100%', maxHeight: '200px', objectFit: 'cover', borderRadius: '10px', display: 'block' }} />
              <button type="button" onClick={() => setBannerPreview(null)}
                style={{ position: 'absolute', top: '8px', right: '8px', width: '28px', height: '28px', borderRadius: '50%', backgroundColor: 'rgba(0,0,0,0.6)', border: 'none', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <X size={14} />
              </button>
              <p style={{ margin: '0.5rem 0 0', fontSize: '0.75rem', color: '#888' }}>
                Recomendado: 1200 × 400 px (proporção 3:1)
              </p>
            </div>
          ) : (
            <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', padding: '2.5rem', borderRadius: '10px', border: '2px dashed #d0d5dd', cursor: 'pointer', backgroundColor: 'rgba(30,107,184,0.02)' }}>
              <Upload size={28} color="#1E6BB8" style={{ opacity: 0.6 }} />
              <div style={{ textAlign: 'center' }}>
                <p style={{ margin: '0 0 0.25rem', fontWeight: 600, color: '#0A2E50', fontSize: '0.875rem' }}>Clique para selecionar o banner</p>
                <p style={{ margin: 0, color: '#999', fontSize: '0.78rem' }}>JPG, PNG ou WebP — recomendado 1200 × 400 px</p>
              </div>
              <input type="file" accept="image/*" onChange={handleBannerChange} style={{ display: 'none' }} />
            </label>
          )}
        </div>

        {status === 'error' && (
          <div style={{ backgroundColor: 'rgba(231,76,60,0.05)', borderRadius: '10px', padding: '0.875rem 1.125rem', border: '1.5px solid rgba(231,76,60,0.2)', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
            <AlertCircle size={16} color="#e74c3c" />
            <p style={{ margin: 0, color: '#a93226', fontSize: '0.875rem' }}>{errorMsg}</p>
          </div>
        )}

        <div style={{ display: 'flex', gap: '0.875rem', alignItems: 'center' }}>
          <button type="submit" disabled={status === 'saving'}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.875rem 2rem', borderRadius: '10px', border: 'none', backgroundColor: status === 'saving' ? '#ccc' : '#1E6BB8', color: 'white', fontWeight: 700, fontSize: '0.95rem', cursor: status === 'saving' ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-montserrat, Montserrat, sans-serif)' }}>
            <Save size={17} />
            {status === 'saving' ? 'Salvando...' : 'Criar Grupo'}
          </button>
          <Link href="/gestao/campanhas" style={{ color: '#666', fontSize: '0.875rem', fontWeight: 600, textDecoration: 'none' }}>
            Cancelar
          </Link>
        </div>
      </form>
    </div>
  );
}
