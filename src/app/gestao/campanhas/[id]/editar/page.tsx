'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Save, Upload, CheckCircle, AlertCircle, X } from 'lucide-react';
import { getCampaigns, saveCampaign } from '@/lib/propertyStorage';
import { AuctionCampaign, BANKS } from '@/types/property';

export default function EditarCampanhaPage() {
  const { id } = useParams<{ id: string }>();
  const [campaign, setCampaign] = useState<AuctionCampaign | null>(null);
  const [name, setName]               = useState('');
  const [bank, setBank]               = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate]     = useState('');
  const [endDate, setEndDate]         = useState('');
  const [active, setActive]           = useState(true);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);
  const [status, setStatus]   = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    getCampaigns().then((list) => {
      const c = list.find((x) => x.id === id);
      if (c) {
        setCampaign(c);
        setName(c.name);
        setBank(c.bank || '');
        setDescription(c.description || '');
        setStartDate(c.startDate || '');
        setEndDate(c.endDate || '');
        setActive(c.active);
        setBannerPreview(c.bannerImage || null);
      }
    });
  }, [id]);

  function handleBannerChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setBannerPreview(reader.result as string);
    reader.readAsDataURL(file);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !campaign) return;
    setStatus('saving');
    try {
      await saveCampaign({
        ...campaign,
        name: name.trim(),
        bank: bank || undefined,
        description: description.trim() || undefined,
        bannerImage: bannerPreview || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        active,
      });
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
  const labelStyle = { display: 'block' as const, fontSize: '0.75rem', fontWeight: 600 as const, color: '#0A2E50', marginBottom: '0.35rem' };

  if (!campaign) return <div style={{ padding: '2rem', color: '#666' }}>Carregando...</div>;

  if (status === 'success') {
    return (
      <div style={{ maxWidth: '700px', margin: '0 auto', padding: '2rem 1.5rem' }}>
        <div style={{ backgroundColor: 'white', borderRadius: '14px', padding: '3rem 2rem', textAlign: 'center', boxShadow: '0 1px 8px rgba(10,46,80,0.07)' }}>
          <CheckCircle size={48} color="#2ECC71" style={{ marginBottom: '1rem' }} />
          <h2 style={{ fontFamily: 'var(--font-montserrat, Montserrat, sans-serif)', color: '#0A2E50', marginBottom: '1.5rem' }}>Grupo atualizado!</h2>
          <Link href="/gestao/campanhas" style={{ padding: '0.7rem 1.5rem', borderRadius: '8px', backgroundColor: '#1E6BB8', color: 'white', fontWeight: 700, fontSize: '0.875rem', textDecoration: 'none' }}>
            Ver grupos
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '700px', margin: '0 auto', padding: '2rem 1.5rem 6rem' }}>
      <Link href="/gestao/campanhas" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', color: '#1E6BB8', textDecoration: 'none', fontSize: '0.875rem', fontWeight: 600, marginBottom: '1.75rem' }}>
        <ArrowLeft size={16} /> Voltar aos Grupos
      </Link>

      <h1 style={{ fontFamily: 'var(--font-montserrat, Montserrat, sans-serif)', fontSize: '1.5rem', fontWeight: 800, color: '#0A2E50', margin: '0 0 1.75rem' }}>
        Editar Grupo
      </h1>

      <form onSubmit={handleSubmit}>
        <div style={{ backgroundColor: 'white', borderRadius: '14px', padding: '1.5rem', boxShadow: '0 1px 8px rgba(10,46,80,0.07)', marginBottom: '1.25rem' }}>
          <div style={{ marginBottom: '1rem' }}>
            <label style={labelStyle}>Nome do Grupo *</label>
            <input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} />
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
                <option value="true">Ativo</option>
                <option value="false">Inativo</option>
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
            <label style={labelStyle}>Descrição</label>
            <textarea style={{ ...inputStyle, resize: 'vertical', minHeight: '72px' }}
              value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
        </div>

        <div style={{ backgroundColor: 'white', borderRadius: '14px', padding: '1.5rem', boxShadow: '0 1px 8px rgba(10,46,80,0.07)', marginBottom: '1.25rem' }}>
          <h3 style={{ fontFamily: 'var(--font-montserrat, Montserrat, sans-serif)', fontSize: '0.875rem', fontWeight: 700, color: '#0A2E50', margin: '0 0 1rem', paddingBottom: '0.75rem', borderBottom: '1px solid #f0f0f0' }}>
            Banner
          </h3>
          {bannerPreview ? (
            <div style={{ position: 'relative' }}>
              <img src={bannerPreview} alt="Banner" style={{ width: '100%', maxHeight: '200px', objectFit: 'cover', borderRadius: '10px', display: 'block' }} />
              <button type="button" onClick={() => setBannerPreview(null)}
                style={{ position: 'absolute', top: '8px', right: '8px', width: '28px', height: '28px', borderRadius: '50%', backgroundColor: 'rgba(0,0,0,0.6)', border: 'none', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <X size={14} />
              </button>
            </div>
          ) : (
            <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.625rem', padding: '2rem', borderRadius: '10px', border: '2px dashed #d0d5dd', cursor: 'pointer' }}>
              <Upload size={24} color="#1E6BB8" style={{ opacity: 0.6 }} />
              <p style={{ margin: 0, fontWeight: 600, color: '#0A2E50', fontSize: '0.875rem' }}>Clique para selecionar o banner</p>
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
            <Save size={17} /> {status === 'saving' ? 'Salvando...' : 'Salvar Alterações'}
          </button>
          <Link href="/gestao/campanhas" style={{ color: '#666', fontSize: '0.875rem', fontWeight: 600, textDecoration: 'none' }}>Cancelar</Link>
        </div>
      </form>
    </div>
  );
}
