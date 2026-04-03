'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { ArrowLeft, CheckCircle, AlertCircle, Save, Upload, X, Image as ImageIcon, Loader2 } from 'lucide-react';
import { saveProperties, getCampaigns } from '@/lib/propertyStorage';
import { Property, AuctionCampaign, BRAZIL_STATES, BANKS, AUCTIONEERS } from '@/types/property';

const COORD_BY_STATE: Record<string, [number, number]> = {
  AC: [-9.0, -70.0], AL: [-9.7, -36.7], AP: [1.4, -51.8], AM: [-3.5, -65.0],
  BA: [-12.5, -41.5], CE: [-5.1, -39.4], DF: [-15.78, -47.93], ES: [-19.5, -40.6],
  GO: [-15.8, -49.8], MA: [-4.9, -45.3], MT: [-12.7, -51.0], MS: [-20.5, -54.8],
  MG: [-18.1, -44.4], PA: [-4.5, -53.0], PB: [-7.2, -36.7], PR: [-24.9, -51.6],
  PE: [-8.3, -37.9], PI: [-7.7, -42.7], RJ: [-22.3, -43.0], RN: [-5.8, -36.5],
  RS: [-29.7, -53.2], RO: [-11.0, -62.8], RR: [2.1, -61.5], SC: [-27.3, -50.2],
  SP: [-22.3, -48.5], SE: [-10.6, -37.5], TO: [-10.2, -48.3],
};

interface FormData {
  title: string; address: string; city: string; state: string; zipCode: string;
  propertyType: string; occupationStatus: string;
  marketValue: string; initialBid: string; areaTotal: string; areaPrivate: string;
  auctionDate: string; auctionTime: string;
  sourceBank: string; sourceAuctioneer: string; registrationNumber: string;
  officialNoticeUrl: string; registrationDocumentUrl: string; auctionWebsiteUrl: string;
  modalidade: string; description: string; latitude: string; longitude: string;
  campaignId: string;
}

const EMPTY: FormData = {
  title: '', address: '', city: '', state: '', zipCode: '',
  propertyType: 'HOUSE', occupationStatus: 'UNKNOWN',
  marketValue: '', initialBid: '', areaTotal: '', areaPrivate: '',
  auctionDate: '', auctionTime: '',
  sourceBank: '', sourceAuctioneer: '', registrationNumber: '',
  officialNoticeUrl: '', registrationDocumentUrl: '', auctionWebsiteUrl: '',
  modalidade: '', description: '', latitude: '', longitude: '', campaignId: '',
};

export default function NovoImovelPage() {
  const [form, setForm] = useState<FormData>(EMPTY);
  const [campaigns, setCampaigns] = useState<AuctionCampaign[]>([]);
  const [mainImage, setMainImage] = useState<string | null>(null);
  const [gallery, setGallery] = useState<string[]>([]);
  const [status, setStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [cepLoading, setCepLoading] = useState(false);
  const [cepMsg, setCepMsg] = useState('');
  const mainImgRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getCampaigns().then((list) => setCampaigns(list.filter((c) => c.active)));
  }, []);

  function set(field: keyof FormData, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleCepBlur() {
    const cep = form.zipCode.replace(/\D/g, '');
    if (cep.length !== 8) return;
    setCepLoading(true);
    setCepMsg('');
    try {
      const res  = await fetch(`/api/cep?cep=${cep}`);
      const data = await res.json();
      if (!res.ok || data.error) { setCepMsg(data.error || 'CEP não encontrado'); return; }
      setForm((f) => ({
        ...f,
        address:   data.address  || f.address,
        city:      data.city     || f.city,
        state:     data.state    || f.state,
        latitude:  data.latitude  != null ? String(data.latitude)  : f.latitude,
        longitude: data.longitude != null ? String(data.longitude) : f.longitude,
      }));
      setCepMsg('✓ Endereço preenchido automaticamente');
    } catch {
      setCepMsg('Erro ao buscar CEP');
    } finally {
      setCepLoading(false);
    }
  }

  function readFilesAsBase64(files: FileList): Promise<string[]> {
    return Promise.all(
      Array.from(files).map(
        (f) =>
          new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.readAsDataURL(f);
          })
      )
    );
  }

  async function handleMainImage(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files?.length) return;
    const [b64] = await readFilesAsBase64(files);
    setMainImage(b64);
  }

  async function handleGallery(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files?.length) return;
    const b64s = await readFilesAsBase64(files);
    setGallery((prev) => [...prev, ...b64s]);
  }

  function removeGalleryImage(idx: number) {
    setGallery((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim() || !form.city.trim() || !form.state || !form.marketValue || !form.initialBid || !form.auctionDate) {
      setStatus('error');
      setErrorMsg('Preencha os campos obrigatórios: Título, Cidade, Estado, Valor de Mercado, Lance Inicial e Data do Leilão.');
      return;
    }
    setStatus('saving');
    setErrorMsg('');

    const mv = parseFloat(form.marketValue);
    const ib = parseFloat(form.initialBid);
    const [lat, lng] = form.latitude && form.longitude
      ? [parseFloat(form.latitude), parseFloat(form.longitude)]
      : (COORD_BY_STATE[form.state] || [-15.78, -47.93]);

    const property: Property = {
      id: `manual-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      title: form.title.trim(),
      description: form.description.trim() || undefined,
      mainImage: mainImage || undefined,
      galleryImages: gallery.length > 0 ? gallery : undefined,
      address: form.address.trim(),
      city: form.city.trim(),
      state: form.state,
      zipCode: form.zipCode.trim() || undefined,
      latitude: lat, longitude: lng,
      marketValue: mv, initialBid: ib,
      discountPercentage: mv > 0 ? Math.round(((mv - ib) / mv) * 100) : 0,
      auctionDate: form.auctionDate,
      auctionTime: form.auctionTime || undefined,
      occupationStatus: form.occupationStatus as Property['occupationStatus'],
      propertyType: form.propertyType as Property['propertyType'],
      sourceBank: form.sourceBank || undefined,
      sourceAuctioneer: form.sourceAuctioneer || undefined,
      registrationNumber: form.registrationNumber || undefined,
      areaTotal: form.areaTotal ? parseFloat(form.areaTotal) : undefined,
      areaPrivate: form.areaPrivate ? parseFloat(form.areaPrivate) : undefined,
      active: true,
      campaignId: form.campaignId || undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      auction: (form.officialNoticeUrl || form.registrationDocumentUrl || form.auctionWebsiteUrl || form.modalidade || form.sourceAuctioneer) ? {
        id: `auction-${Date.now()}`,
        auctioneerName: form.sourceAuctioneer || 'Não informado',
        auctionWebsiteUrl: form.auctionWebsiteUrl || undefined,
        officialNoticeUrl: form.officialNoticeUrl || undefined,
        registrationDocumentUrl: form.registrationDocumentUrl || undefined,
        modalidade: form.modalidade || undefined,
      } : undefined,
    };

    try {
      await saveProperties([property]);
      setStatus('success');
      setForm(EMPTY);
      setMainImage(null);
      setGallery([]);
    } catch (err) {
      setStatus('error');
      setErrorMsg(err instanceof Error ? err.message : 'Erro ao salvar imóvel.');
    }
  }

  const inputStyle = {
    width: '100%', padding: '0.625rem 0.875rem', borderRadius: '8px',
    border: '1.5px solid #e0e0e0', fontSize: '0.875rem', color: '#333',
    outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' as const,
  };
  const labelStyle = { display: 'block' as const, fontSize: '0.75rem', fontWeight: 600 as const, color: '#0A2E50', marginBottom: '0.35rem' };
  const sectionStyle = { backgroundColor: 'white', borderRadius: '14px', padding: '1.5rem', boxShadow: '0 1px 8px rgba(10,46,80,0.07)', marginBottom: '1.25rem' };
  const sectionTitle = { fontFamily: 'var(--font-montserrat, Montserrat, sans-serif)', fontSize: '0.875rem', fontWeight: 700 as const, color: '#0A2E50', margin: '0 0 1.125rem', paddingBottom: '0.75rem', borderBottom: '1px solid #f0f0f0' };
  const grid2 = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' } as const;
  const grid3 = { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' } as const;

  return (
    <div style={{ maxWidth: '860px', margin: '0 auto', padding: '2rem 1.5rem 6rem' }}>

      <Link href="/gestao" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', color: '#1E6BB8', textDecoration: 'none', fontSize: '0.875rem', fontWeight: 600, marginBottom: '1.75rem' }}>
        <ArrowLeft size={16} /> Voltar ao Painel de Gestão
      </Link>

      <div style={{ marginBottom: '1.75rem' }}>
        <h1 style={{ fontFamily: 'var(--font-montserrat, Montserrat, sans-serif)', fontSize: '1.625rem', fontWeight: 800, color: '#0A2E50', margin: '0 0 0.5rem' }}>
          Cadastrar Imóvel Manualmente
        </h1>
        <p style={{ color: '#666', margin: 0, lineHeight: 1.65, fontSize: '0.9rem' }}>
          Campos marcados com <span style={{ color: '#e74c3c' }}>*</span> são obrigatórios.
        </p>
      </div>

      {status === 'success' && (
        <div style={{ backgroundColor: 'rgba(46,204,113,0.06)', borderRadius: '12px', padding: '1.125rem 1.5rem', border: '1.5px solid rgba(46,204,113,0.3)', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <CheckCircle size={20} color="#2ECC71" />
            <p style={{ margin: 0, fontWeight: 700, color: '#1a7a43', fontSize: '0.9rem' }}>Imóvel cadastrado com sucesso!</p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <Link href="/dashboard" style={{ padding: '0.45rem 1rem', borderRadius: '8px', backgroundColor: '#2ECC71', color: 'white', fontWeight: 700, fontSize: '0.8rem', textDecoration: 'none' }}>
              Ver no Dashboard
            </Link>
            <button onClick={() => setStatus('idle')} style={{ padding: '0.45rem 1rem', borderRadius: '8px', border: '1.5px solid #ccc', backgroundColor: 'white', color: '#666', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer' }}>
              Cadastrar outro
            </button>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit}>

        {/* ── Fotos ─────────────────────────────────────────── */}
        <div style={sectionStyle}>
          <h3 style={sectionTitle}>Fotos do Imóvel</h3>

          {/* Main image */}
          <div style={{ marginBottom: '1.25rem' }}>
            <label style={labelStyle}>Foto Principal</label>
            {mainImage ? (
              <div style={{ position: 'relative', display: 'inline-block' }}>
                <img src={mainImage} alt="Foto principal"
                  style={{ width: '100%', maxHeight: '220px', objectFit: 'cover', borderRadius: '10px', display: 'block' }} />
                <button type="button" onClick={() => setMainImage(null)}
                  style={{ position: 'absolute', top: '8px', right: '8px', width: '28px', height: '28px', borderRadius: '50%', backgroundColor: 'rgba(0,0,0,0.6)', border: 'none', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <X size={14} />
                </button>
              </div>
            ) : (
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '1rem 1.25rem', borderRadius: '10px', border: '2px dashed #d0d5dd', cursor: 'pointer', backgroundColor: 'rgba(30,107,184,0.02)' }}>
                <ImageIcon size={22} color="#1E6BB8" style={{ opacity: 0.6, flexShrink: 0 }} />
                <span style={{ fontSize: '0.875rem', color: '#888' }}>Clique para selecionar a foto principal</span>
                <input ref={mainImgRef} type="file" accept="image/*" onChange={handleMainImage} style={{ display: 'none' }} />
              </label>
            )}
          </div>

          {/* Gallery */}
          <div>
            <label style={labelStyle}>Galeria de Fotos</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.625rem', marginBottom: gallery.length > 0 ? '0.75rem' : 0 }}>
              {gallery.map((src, idx) => (
                <div key={idx} style={{ position: 'relative', width: '100px', height: '80px' }}>
                  <img src={src} alt={`Foto ${idx + 1}`}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '8px', display: 'block' }} />
                  <button type="button" onClick={() => removeGalleryImage(idx)}
                    style={{ position: 'absolute', top: '3px', right: '3px', width: '22px', height: '22px', borderRadius: '50%', backgroundColor: 'rgba(0,0,0,0.6)', border: 'none', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1rem', borderRadius: '8px', border: '1.5px solid #1E6BB8', color: '#1E6BB8', fontSize: '0.825rem', fontWeight: 600, cursor: 'pointer' }}>
              <Upload size={15} /> Adicionar fotos
              <input ref={galleryRef} type="file" accept="image/*" multiple onChange={handleGallery} style={{ display: 'none' }} />
            </label>
            {gallery.length > 0 && (
              <span style={{ marginLeft: '0.75rem', fontSize: '0.78rem', color: '#888' }}>{gallery.length} foto(s) adicionada(s)</span>
            )}
          </div>
        </div>

        {/* ── Identificação ─────────────────────────────────── */}
        <div style={sectionStyle}>
          <h3 style={sectionTitle}>Identificação do Imóvel</h3>
          <div style={{ marginBottom: '1rem' }}>
            <label style={labelStyle}>Título <span style={{ color: '#e74c3c' }}>*</span></label>
            <input style={inputStyle} value={form.title} onChange={(e) => set('title', e.target.value)}
              placeholder="Ex: Apartamento 3 quartos - Centro / SP" />
          </div>
          <div style={{ ...grid2, marginBottom: '1rem' }}>
            <div>
              <label style={labelStyle}>Tipo de Imóvel</label>
              <select style={inputStyle} value={form.propertyType} onChange={(e) => set('propertyType', e.target.value)}>
                <option value="HOUSE">Casa</option>
                <option value="APARTMENT">Apartamento</option>
                <option value="LAND">Terreno</option>
                <option value="COMMERCIAL">Comercial / Sala</option>
                <option value="RURAL">Rural</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Ocupação</label>
              <select style={inputStyle} value={form.occupationStatus} onChange={(e) => set('occupationStatus', e.target.value)}>
                <option value="VACANT">Desocupado</option>
                <option value="OCCUPIED">Ocupado</option>
                <option value="UNKNOWN">Não informado</option>
              </select>
            </div>
          </div>
          {campaigns.length > 0 && (
            <div style={{ marginBottom: '1rem' }}>
              <label style={labelStyle}>Grupo de Leilão</label>
              <select style={inputStyle} value={form.campaignId} onChange={(e) => set('campaignId', e.target.value)}>
                <option value="">Sem grupo</option>
                {campaigns.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}{c.bank ? ` — ${c.bank}` : ''}</option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label style={labelStyle}>Descrição</label>
            <textarea style={{ ...inputStyle, resize: 'vertical', minHeight: '80px' }}
              value={form.description} onChange={(e) => set('description', e.target.value)}
              placeholder="Informações adicionais sobre o imóvel..." />
          </div>
        </div>

        {/* ── Localização ───────────────────────────────────── */}
        <div style={sectionStyle}>
          <h3 style={sectionTitle}>Localização</h3>
          <div style={{ marginBottom: '1rem' }}>
            <label style={labelStyle}>Endereço completo</label>
            <input style={inputStyle} value={form.address} onChange={(e) => set('address', e.target.value)}
              placeholder="Rua, número, complemento, bairro" />
          </div>
          <div style={{ ...grid3, marginBottom: '1rem' }}>
            <div>
              <label style={labelStyle}>Cidade <span style={{ color: '#e74c3c' }}>*</span></label>
              <input style={inputStyle} value={form.city} onChange={(e) => set('city', e.target.value)} placeholder="Ex: São Paulo" />
            </div>
            <div>
              <label style={labelStyle}>Estado <span style={{ color: '#e74c3c' }}>*</span></label>
              <select style={inputStyle} value={form.state} onChange={(e) => set('state', e.target.value)}>
                <option value="">Selecionar...</option>
                {BRAZIL_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>CEP</label>
              <div style={{ position: 'relative' }}>
                <input
                  style={{ ...inputStyle, paddingRight: cepLoading ? '2.25rem' : undefined }}
                  value={form.zipCode}
                  onChange={(e) => { set('zipCode', e.target.value); setCepMsg(''); }}
                  onBlur={handleCepBlur}
                  placeholder="00000-000"
                  maxLength={9}
                />
                {cepLoading && (
                  <Loader2 size={15} style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#1E6BB8', animation: 'spin 1s linear infinite' }} />
                )}
              </div>
              {cepMsg && (
                <p style={{ margin: '0.3rem 0 0', fontSize: '0.72rem', color: cepMsg.startsWith('✓') ? '#2ECC71' : '#e74c3c', fontWeight: 600 }}>
                  {cepMsg}
                </p>
              )}
            </div>
          </div>
          <div style={grid2}>
            <div>
              <label style={labelStyle}>Latitude</label>
              <input style={inputStyle} type="number" step="any" value={form.latitude} onChange={(e) => set('latitude', e.target.value)} placeholder="Preenchido via CEP..." />
            </div>
            <div>
              <label style={labelStyle}>Longitude</label>
              <input style={inputStyle} type="number" step="any" value={form.longitude} onChange={(e) => set('longitude', e.target.value)} placeholder="Preenchido via CEP..." />
            </div>
          </div>
          <p style={{ fontSize: '0.72rem', color: '#888', margin: '0.5rem 0 0' }}>
            Preencha o CEP para buscar endereço e coordenadas automaticamente. Se não informar coordenadas, será usada a posição aproximada do estado.
          </p>
        </div>

        {/* ── Valores ───────────────────────────────────────── */}
        <div style={sectionStyle}>
          <h3 style={sectionTitle}>Valores e Área</h3>
          <div style={{ ...grid2, marginBottom: '1rem' }}>
            <div>
              <label style={labelStyle}>Valor de Mercado (R$) <span style={{ color: '#e74c3c' }}>*</span></label>
              <input style={inputStyle} type="number" min="0" step="0.01" value={form.marketValue} onChange={(e) => set('marketValue', e.target.value)} placeholder="Ex: 350000" />
            </div>
            <div>
              <label style={labelStyle}>Lance Inicial (R$) <span style={{ color: '#e74c3c' }}>*</span></label>
              <input style={inputStyle} type="number" min="0" step="0.01" value={form.initialBid} onChange={(e) => set('initialBid', e.target.value)} placeholder="Ex: 200000" />
            </div>
          </div>
          <div style={grid2}>
            <div>
              <label style={labelStyle}>Área Total (m²)</label>
              <input style={inputStyle} type="number" min="0" step="0.01" value={form.areaTotal} onChange={(e) => set('areaTotal', e.target.value)} placeholder="Ex: 120" />
            </div>
            <div>
              <label style={labelStyle}>Área Privativa (m²)</label>
              <input style={inputStyle} type="number" min="0" step="0.01" value={form.areaPrivate} onChange={(e) => set('areaPrivate', e.target.value)} placeholder="Ex: 85" />
            </div>
          </div>
          {form.marketValue && form.initialBid && parseFloat(form.marketValue) > 0 && (
            <div style={{ marginTop: '0.75rem', padding: '0.625rem 0.875rem', backgroundColor: 'rgba(46,204,113,0.08)', borderRadius: '8px', border: '1px solid rgba(46,204,113,0.2)' }}>
              <span style={{ fontSize: '0.825rem', fontWeight: 700, color: '#1a7a43' }}>
                Desconto calculado: {Math.round(((parseFloat(form.marketValue) - parseFloat(form.initialBid)) / parseFloat(form.marketValue)) * 100)}%
              </span>
            </div>
          )}
        </div>

        {/* ── Leilão ────────────────────────────────────────── */}
        <div style={sectionStyle}>
          <h3 style={sectionTitle}>Dados do Leilão</h3>
          <div style={{ ...grid2, marginBottom: '1rem' }}>
            <div>
              <label style={labelStyle}>Data do Leilão <span style={{ color: '#e74c3c' }}>*</span></label>
              <input style={inputStyle} type="date" value={form.auctionDate} onChange={(e) => set('auctionDate', e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Horário</label>
              <input style={inputStyle} type="time" value={form.auctionTime} onChange={(e) => set('auctionTime', e.target.value)} />
            </div>
          </div>
          <div style={{ ...grid2, marginBottom: '1rem' }}>
            <div>
              <label style={labelStyle}>Banco / Credor</label>
              <select style={inputStyle} value={form.sourceBank} onChange={(e) => set('sourceBank', e.target.value)}>
                <option value="">Selecionar banco...</option>
                {BANKS.map((b) => <option key={b} value={b}>{b}</option>)}
                <option value="Outro">Outro</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Leiloeiro</label>
              <select style={inputStyle} value={form.sourceAuctioneer} onChange={(e) => set('sourceAuctioneer', e.target.value)}>
                <option value="">Selecionar leiloeiro...</option>
                {AUCTIONEERS.map((a) => <option key={a} value={a}>{a}</option>)}
                <option value="Outro">Outro</option>
              </select>
            </div>
          </div>
          <div style={{ ...grid2, marginBottom: '1rem' }}>
            <div>
              <label style={labelStyle}>Modalidade de Venda</label>
              <input style={inputStyle} value={form.modalidade} onChange={(e) => set('modalidade', e.target.value)}
                placeholder="Ex: Leilão SFI, Venda Direta..." />
            </div>
            <div>
              <label style={labelStyle}>Nº de Matrícula / Registro</label>
              <input style={inputStyle} value={form.registrationNumber} onChange={(e) => set('registrationNumber', e.target.value)}
                placeholder="Ex: 12345" />
            </div>
          </div>
          <div style={{ ...grid3 }}>
            <div>
              <label style={labelStyle}>Link do Leilão (site)</label>
              <input style={inputStyle} type="url" value={form.auctionWebsiteUrl} onChange={(e) => set('auctionWebsiteUrl', e.target.value)}
                placeholder="https://leiloeiro.com.br/..." />
            </div>
            <div>
              <label style={labelStyle}>URL do Edital</label>
              <input style={inputStyle} type="url" value={form.officialNoticeUrl} onChange={(e) => set('officialNoticeUrl', e.target.value)}
                placeholder="https://..." />
            </div>
            <div>
              <label style={labelStyle}>URL da Matrícula</label>
              <input style={inputStyle} type="url" value={form.registrationDocumentUrl} onChange={(e) => set('registrationDocumentUrl', e.target.value)}
                placeholder="https://..." />
            </div>
          </div>
        </div>

        {status === 'error' && (
          <div style={{ backgroundColor: 'rgba(231,76,60,0.05)', borderRadius: '12px', padding: '1rem 1.25rem', border: '1.5px solid rgba(231,76,60,0.2)', marginBottom: '1.25rem', display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
            <AlertCircle size={18} color="#e74c3c" style={{ flexShrink: 0, marginTop: '2px' }} />
            <p style={{ margin: 0, color: '#a93226', fontSize: '0.875rem' }}>{errorMsg}</p>
          </div>
        )}

        <div style={{ display: 'flex', gap: '0.875rem', alignItems: 'center' }}>
          <button type="submit" disabled={status === 'saving'}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.875rem 2rem', borderRadius: '10px', border: 'none', backgroundColor: status === 'saving' ? '#ccc' : '#1E6BB8', color: 'white', fontWeight: 700, fontSize: '0.95rem', cursor: status === 'saving' ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-montserrat, Montserrat, sans-serif)' }}>
            <Save size={17} />
            {status === 'saving' ? 'Salvando...' : 'Salvar Imóvel'}
          </button>
          <Link href="/gestao" style={{ color: '#666', fontSize: '0.875rem', fontWeight: 600, textDecoration: 'none' }}>
            Cancelar
          </Link>
        </div>
      </form>
    </div>
  );
}
