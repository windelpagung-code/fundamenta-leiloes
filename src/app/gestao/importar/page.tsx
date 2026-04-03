'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import {
  Upload, Link as LinkIcon, CheckCircle, AlertCircle,
  ArrowLeft, FileSpreadsheet, Trash2, ExternalLink,
} from 'lucide-react';
import { Property } from '@/types/property';
import { saveProperties, clearProperties, getImportMeta } from '@/lib/propertyStorage';

const UF_LINKS = ['SP', 'RJ', 'MG', 'GO', 'PR', 'RS', 'BA', 'PE', 'CE', 'DF', 'SC', 'MT', 'MS', 'PA', 'ES', 'RN', 'PB', 'AL', 'SE', 'PI', 'MA', 'TO', 'RO', 'AC', 'AM', 'RR', 'AP'];

export default function GestaoImportarPage() {
  const [url, setUrl]           = useState('');
  const [fileName, setFileName] = useState('');
  const [status, setStatus]     = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage]   = useState('');
  const [geocodedCities, setGeocodedCities] = useState(0);
  const [totalCities, setTotalCities]       = useState(0);
  const [dedupStats, setDedupStats] = useState({ added: 0, updated: 0, skipped: 0, total: 0 });
  const [existingInfo, setExistingInfo] = useState<{ at: string; count: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getImportMeta().then(({ importedAt, count }) => {
      if (importedAt && count > 0) {
        setExistingInfo({ at: new Date(importedAt).toLocaleString('pt-BR'), count });
      }
    });
  }, []);

  async function handleImport(source: 'url' | 'file') {
    if (source === 'url' && !url.trim()) {
      setStatus('error'); setMessage('Informe uma URL válida do CSV da Caixa.'); return;
    }
    if (source === 'file' && !fileRef.current?.files?.[0]) {
      setStatus('error'); setMessage('Selecione um arquivo CSV para fazer o upload.'); return;
    }

    setStatus('loading');
    setMessage('');

    const formData = new FormData();
    if (source === 'url') formData.append('url', url.trim());
    else formData.append('file', fileRef.current!.files![0]);

    try {
      const res  = await fetch('/api/importar-caixa', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Erro ao processar arquivo.');

      const stats = await saveProperties(data.properties as Property[]);

      setGeocodedCities(data.geocodedCities);
      setTotalCities(data.uniqueCities);
      setDedupStats(stats);
      setExistingInfo({ at: new Date().toLocaleString('pt-BR'), count: stats.total });
      setStatus('success');
    } catch (err) {
      setStatus('error');
      setMessage(err instanceof Error ? err.message : 'Erro desconhecido.');
    }
  }

  async function handleClear() {
    await clearProperties();
    setExistingInfo(null);
    setStatus('idle');
    setMessage('');
    setUrl('');
    setFileName('');
    if (fileRef.current) fileRef.current.value = '';
  }

  return (
    <div style={{ maxWidth: '820px', margin: '0 auto', padding: '2rem 1.5rem 6rem' }}>

      <Link href="/gestao" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', color: '#1E6BB8', textDecoration: 'none', fontSize: '0.875rem', fontWeight: 600, marginBottom: '1.75rem' }}>
        <ArrowLeft size={16} /> Voltar ao Painel de Gestão
      </Link>

      <div style={{ marginBottom: '1.75rem' }}>
        <h1 style={{ fontFamily: 'var(--font-montserrat, Montserrat, sans-serif)', fontSize: '1.625rem', fontWeight: 800, color: '#0A2E50', margin: '0 0 0.5rem' }}>
          Importar Imóveis da Caixa
        </h1>
        <p style={{ color: '#666', margin: 0, lineHeight: 1.65, fontSize: '0.9rem' }}>
          Importe a lista oficial de imóveis em leilão da Caixa Econômica Federal por estado.
          Os imóveis ficam disponíveis no dashboard para todos os usuários.
        </p>
      </div>

      {existingInfo && status === 'idle' && (
        <div style={{ backgroundColor: 'rgba(30,107,184,0.05)', border: '1.5px solid rgba(30,107,184,0.2)', borderRadius: '12px', padding: '1rem 1.25rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
          <div>
            <p style={{ margin: '0 0 0.2rem', fontWeight: 700, color: '#0A2E50', fontSize: '0.875rem' }}>
              Importação ativa: {existingInfo.count.toLocaleString('pt-BR')} imóveis
            </p>
            <p style={{ margin: 0, color: '#666', fontSize: '0.775rem' }}>{existingInfo.at}</p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <Link href="/dashboard" style={{ padding: '0.4rem 0.875rem', borderRadius: '7px', backgroundColor: '#1E6BB8', color: 'white', fontWeight: 600, fontSize: '0.8rem', textDecoration: 'none' }}>
              Ver no Dashboard
            </Link>
            <button onClick={handleClear} style={{ padding: '0.4rem 0.75rem', borderRadius: '7px', border: '1.5px solid #e74c3c', backgroundColor: 'transparent', color: '#e74c3c', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <Trash2 size={14} /> Limpar tudo
            </button>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

        {/* Option 1: URL */}
        <div style={{ backgroundColor: 'white', borderRadius: '14px', padding: '1.5rem', boxShadow: '0 1px 8px rgba(10,46,80,0.07)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', marginBottom: '1.125rem' }}>
            <div style={{ width: '42px', height: '42px', borderRadius: '11px', backgroundColor: 'rgba(30,107,184,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <LinkIcon size={20} color="#1E6BB8" />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#0A2E50', fontFamily: 'var(--font-montserrat, Montserrat, sans-serif)' }}>Importar por URL</h3>
              <p style={{ margin: 0, fontSize: '0.78rem', color: '#888' }}>Cole o link direto do arquivo .csv da Caixa</p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.625rem', flexWrap: 'wrap' }}>
            <input type="url" value={url} onChange={(e) => setUrl(e.target.value)}
              placeholder="https://venda-imoveis.caixa.gov.br/listaweb/Lista_imoveis_GO.csv"
              disabled={status === 'loading'}
              style={{ flex: 1, minWidth: '220px', padding: '0.625rem 0.875rem', borderRadius: '8px', border: '1.5px solid #e0e0e0', fontSize: '0.82rem', color: '#333', outline: 'none', fontFamily: 'monospace', backgroundColor: status === 'loading' ? '#f5f5f5' : 'white' }}
            />
            <button onClick={() => handleImport('url')} disabled={status === 'loading' || !url.trim()}
              style={{ padding: '0.625rem 1.375rem', borderRadius: '8px', border: 'none', backgroundColor: status === 'loading' || !url.trim() ? '#ccc' : '#1E6BB8', color: 'white', fontWeight: 700, fontSize: '0.875rem', cursor: status === 'loading' || !url.trim() ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-montserrat, Montserrat, sans-serif)', whiteSpace: 'nowrap' }}>
              Importar
            </button>
          </div>
          <div style={{ marginTop: '0.875rem' }}>
            <p style={{ fontSize: '0.72rem', color: '#999', margin: '0 0 0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Selecionar por estado:</p>
            <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
              {UF_LINKS.map((uf) => (
                <button key={uf} onClick={() => setUrl(`https://venda-imoveis.caixa.gov.br/listaweb/Lista_imoveis_${uf}.csv`)}
                  style={{ padding: '0.22rem 0.6rem', borderRadius: '6px', border: '1.5px solid #1E6BB8', backgroundColor: url.includes(`_${uf}.csv`) ? '#1E6BB8' : 'transparent', color: url.includes(`_${uf}.csv`) ? 'white' : '#1E6BB8', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer' }}>
                  {uf}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Option 2: File Upload */}
        <div style={{ backgroundColor: 'white', borderRadius: '14px', padding: '1.5rem', boxShadow: '0 1px 8px rgba(10,46,80,0.07)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', marginBottom: '1.125rem' }}>
            <div style={{ width: '42px', height: '42px', borderRadius: '11px', backgroundColor: 'rgba(46,204,113,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <FileSpreadsheet size={20} color="#2ECC71" />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#0A2E50', fontFamily: 'var(--font-montserrat, Montserrat, sans-serif)' }}>Upload de Arquivo CSV</h3>
              <p style={{ margin: 0, fontSize: '0.78rem', color: '#888' }}>Faça upload do arquivo .csv baixado do site da Caixa</p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.625rem', alignItems: 'stretch', flexWrap: 'wrap' }}>
            <label style={{ flex: 1, minWidth: '220px', padding: '0.625rem 0.875rem', borderRadius: '8px', border: '1.5px dashed #ccc', fontSize: '0.82rem', color: fileName ? '#333' : '#999', cursor: status === 'loading' ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: status === 'loading' ? '#f5f5f5' : 'white' }}>
              <Upload size={15} style={{ flexShrink: 0 }} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fileName || 'Clique para selecionar o arquivo .csv'}</span>
              <input ref={fileRef} type="file" accept=".csv,text/csv" style={{ display: 'none' }} disabled={status === 'loading'} onChange={(e) => setFileName(e.target.files?.[0]?.name || '')} />
            </label>
            <button onClick={() => handleImport('file')} disabled={status === 'loading'}
              style={{ padding: '0.625rem 1.375rem', borderRadius: '8px', border: 'none', backgroundColor: status === 'loading' ? '#ccc' : '#2ECC71', color: 'white', fontWeight: 700, fontSize: '0.875rem', cursor: status === 'loading' ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-montserrat, Montserrat, sans-serif)', whiteSpace: 'nowrap' }}>
              Processar
            </button>
          </div>
        </div>

        {/* Loading */}
        {status === 'loading' && (
          <div style={{ backgroundColor: 'rgba(30,107,184,0.05)', borderRadius: '12px', padding: '1.25rem 1.5rem', border: '1.5px solid rgba(30,107,184,0.2)', display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            <div style={{ width: '26px', height: '26px', borderRadius: '50%', border: '3px solid #1E6BB8', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite', flexShrink: 0 }} />
            <div>
              <p style={{ margin: 0, fontWeight: 700, color: '#1E6BB8', fontSize: '0.9rem' }}>Processando...</p>
              <p style={{ margin: '0.2rem 0 0', color: '#666', fontSize: '0.8rem' }}>Analisando CSV e geocodificando cidades. Pode levar até 15 segundos.</p>
            </div>
          </div>
        )}

        {/* Success */}
        {status === 'success' && (
          <div style={{ backgroundColor: 'rgba(46,204,113,0.06)', borderRadius: '12px', padding: '1.25rem 1.5rem', border: '1.5px solid rgba(46,204,113,0.3)' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', marginBottom: '0.875rem' }}>
              <CheckCircle size={22} color="#2ECC71" style={{ flexShrink: 0, marginTop: '1px' }} />
              <div>
                <p style={{ margin: '0 0 0.5rem', fontWeight: 700, color: '#1a7a43', fontSize: '0.95rem' }}>
                  Importação concluída! — {dedupStats.total.toLocaleString('pt-BR')} imóveis no total
                </p>
                <div style={{ display: 'flex', gap: '0.625rem', flexWrap: 'wrap', marginBottom: '0.4rem' }}>
                  <span style={{ fontSize: '0.8rem', backgroundColor: 'rgba(46,204,113,0.15)', color: '#1a7a43', borderRadius: '6px', padding: '0.15rem 0.5rem', fontWeight: 700 }}>
                    +{dedupStats.added.toLocaleString('pt-BR')} novos
                  </span>
                  {dedupStats.updated > 0 && (
                    <span style={{ fontSize: '0.8rem', backgroundColor: 'rgba(255,215,0,0.2)', color: '#7a6000', borderRadius: '6px', padding: '0.15rem 0.5rem', fontWeight: 700 }}>
                      ↻ {dedupStats.updated} atualizados
                    </span>
                  )}
                  {dedupStats.skipped > 0 && (
                    <span style={{ fontSize: '0.8rem', backgroundColor: 'rgba(153,153,153,0.12)', color: '#666', borderRadius: '6px', padding: '0.15rem 0.5rem', fontWeight: 700 }}>
                      = {dedupStats.skipped.toLocaleString('pt-BR')} já existentes
                    </span>
                  )}
                </div>
                <p style={{ margin: 0, color: '#2d6a4f', fontSize: '0.8rem' }}>
                  {geocodedCities} de {totalCities} cidades geocodificadas{totalCities > geocodedCities ? ' (demais usam centro do estado).' : '.'}
                </p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.625rem', flexWrap: 'wrap' }}>
              <Link href="/dashboard" style={{ padding: '0.6rem 1.25rem', borderRadius: '8px', backgroundColor: '#2ECC71', color: 'white', fontWeight: 700, fontSize: '0.875rem', textDecoration: 'none', fontFamily: 'var(--font-montserrat, Montserrat, sans-serif)' }}>
                Ver no Dashboard
              </Link>
              <button onClick={handleClear} style={{ padding: '0.6rem 1rem', borderRadius: '8px', border: '1.5px solid #ccc', backgroundColor: 'white', color: '#666', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer' }}>
                Importar outro arquivo
              </button>
            </div>
          </div>
        )}

        {/* Error */}
        {status === 'error' && (
          <div style={{ backgroundColor: 'rgba(231,76,60,0.05)', borderRadius: '12px', padding: '1.25rem 1.5rem', border: '1.5px solid rgba(231,76,60,0.2)' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', marginBottom: '0.875rem' }}>
              <AlertCircle size={22} color="#e74c3c" style={{ flexShrink: 0, marginTop: '1px' }} />
              <div>
                <p style={{ margin: '0 0 0.3rem', fontWeight: 700, color: '#a93226', fontSize: '0.95rem' }}>Erro na importação</p>
                <p style={{ margin: 0, color: '#666', fontSize: '0.85rem' }}>{message}</p>
              </div>
            </div>
            <button onClick={() => setStatus('idle')} style={{ padding: '0.5rem 1rem', borderRadius: '8px', border: '1.5px solid #e74c3c', backgroundColor: 'transparent', color: '#e74c3c', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer' }}>
              Tentar novamente
            </button>
          </div>
        )}

        {/* How-to */}
        <div style={{ backgroundColor: 'rgba(10,46,80,0.03)', borderRadius: '12px', padding: '1.25rem 1.5rem', border: '1px solid rgba(10,46,80,0.08)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <h4 style={{ margin: 0, fontSize: '0.875rem', fontWeight: 700, color: '#0A2E50', fontFamily: 'var(--font-montserrat, Montserrat, sans-serif)' }}>Como obter o arquivo da Caixa?</h4>
            <a href="https://venda-imoveis.caixa.gov.br" target="_blank" rel="noopener noreferrer"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', color: '#1E6BB8', fontSize: '0.775rem', fontWeight: 600, textDecoration: 'none' }}>
              Abrir site da Caixa <ExternalLink size={12} />
            </a>
          </div>
          <ol style={{ margin: 0, paddingLeft: '1.25rem', color: '#555', fontSize: '0.82rem', lineHeight: 1.85 }}>
            <li>Acesse <strong>venda-imoveis.caixa.gov.br</strong></li>
            <li>Filtre os imóveis pelo estado desejado</li>
            <li>Clique em <strong>&quot;Baixar lista de imóveis (.csv)&quot;</strong></li>
            <li>Copie o link de download ou salve e faça upload aqui</li>
          </ol>
          <p style={{ margin: '0.875rem 0 0', fontSize: '0.78rem', color: '#888', lineHeight: 1.6 }}>
            <strong>Armazenamento:</strong> Os imóveis são guardados no IndexedDB do navegador — sem limite de tamanho, suporta centenas de milhares de registros.
          </p>
        </div>

      </div>
    </div>
  );
}
