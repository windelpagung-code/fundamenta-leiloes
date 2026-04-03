'use client';

import { useState } from 'react';
import { User, Bell, CreditCard, Shield, Crown, CheckCircle, Star } from 'lucide-react';

type Plan = 'FREE' | 'PREMIUM';

const PLAN_FEATURES = {
  FREE: [
    'Visualização de até 52 imóveis do banco de dados',
    'Calculadora financeira — simulação básica',
    'Checklist essencial pré e pós-arrematação (5 itens)',
    'Registro de arrematações',
  ],
  PREMIUM: [
    'Banco completo de imóveis — acesso ilimitado',
    'Filtros avançados: estado, banco, modalidade e forma de pagamento',
    'Laudo técnico completo por Especialista por imóvel',
    'Calculadora completa: Simulação + Gráficos + Cenários comparativos',
    'Checklist completo pré (19 itens) e pós-arrematação (21 itens)',
    'Mapa interativo de oportunidades',
    'Formas de pagamento reais por imóvel (Caixa)',
    'Suporte prioritário',
  ],
};

export default function PerfilPage() {
  const [activeTab, setActiveTab] = useState<'profile' | 'plan' | 'notifications' | 'security'>('profile');
  const [name, setName] = useState('Demo Investidor');
  const [email, setEmail] = useState('demo@fundamentaleiloes.com.br');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // eslint-disable-next-line @typescript-eslint/no-inferrable-types
  const currentPlan = ('PREMIUM' as Plan); // Demo is premium - set by auth in production

  const [billing, setBilling] = useState<'monthly' | 'annual'>('monthly');

  const [notifications, setNotifications] = useState({
    newAuctions: true,
    statusChanges: true,
    deadlines: true,
    newsletter: false,
  });

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await new Promise((r) => setTimeout(r, 800));
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  const tabs = [
    { id: 'profile', label: 'Dados Pessoais', icon: User },
    { id: 'plan', label: 'Meu Plano', icon: CreditCard },
    { id: 'notifications', label: 'Notificações', icon: Bell },
    { id: 'security', label: 'Segurança', icon: Shield },
  ] as const;

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '1.5rem 1.5rem 5rem' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontFamily: 'var(--font-montserrat, Montserrat, sans-serif)', fontSize: '1.625rem', fontWeight: 800, color: '#0A2E50', margin: '0 0 0.25rem' }}>
          Meu Perfil
        </h1>
        <p style={{ color: '#666', fontSize: '0.875rem', margin: 0 }}>Gerencie suas informações e preferências</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: '1.5rem', alignItems: 'start' }}>
        {/* Sidebar */}
        <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '1rem', boxShadow: '0 2px 8px rgba(10,46,80,0.08)', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          {/* Avatar */}
          <div style={{ textAlign: 'center', padding: '1rem 0 0.75rem', borderBottom: '1px solid #f0f0f0', marginBottom: '0.75rem' }}>
            <div style={{ width: '64px', height: '64px', borderRadius: '50%', backgroundColor: '#1E6BB8', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 0.5rem', color: 'white', fontSize: '1.5rem', fontWeight: 700, fontFamily: 'var(--font-montserrat, Montserrat, sans-serif)' }}>
              {name.charAt(0)}
            </div>
            <div style={{ fontWeight: 700, color: '#0A2E50', fontSize: '0.9rem', fontFamily: 'var(--font-montserrat, Montserrat, sans-serif)' }}>{name}</div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.375rem', marginTop: '0.375rem' }}>
              <Crown size={12} color="#FFD700" />
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#a0830a' }}>PREMIUM</span>
            </div>
          </div>

          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.625rem',
                padding: '0.625rem 0.875rem',
                borderRadius: '8px',
                border: 'none',
                cursor: 'pointer',
                textAlign: 'left',
                fontSize: '0.875rem',
                fontWeight: activeTab === tab.id ? 700 : 500,
                color: activeTab === tab.id ? '#1E6BB8' : '#555',
                backgroundColor: activeTab === tab.id ? 'rgba(30,107,184,0.08)' : 'transparent',
                transition: 'all 0.15s',
                fontFamily: 'var(--font-montserrat, Montserrat, sans-serif)',
              }}
            >
              <tab.icon size={16} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '1.5rem', boxShadow: '0 2px 8px rgba(10,46,80,0.08)' }}>

          {/* Profile tab */}
          {activeTab === 'profile' && (
            <form onSubmit={handleSaveProfile}>
              <h2 style={{ fontFamily: 'var(--font-montserrat, Montserrat, sans-serif)', fontSize: '1.1rem', fontWeight: 700, color: '#0A2E50', margin: '0 0 1.5rem' }}>
                Dados Pessoais
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.125rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#0A2E50', marginBottom: '0.375rem' }}>Nome completo</label>
                  <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="input-field" />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#0A2E50', marginBottom: '0.375rem' }}>Email</label>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input-field" />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#0A2E50', marginBottom: '0.375rem' }}>Telefone</label>
                  <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(11) 99999-9999" className="input-field" />
                </div>
                <div style={{ paddingTop: '0.5rem', borderTop: '1px solid #f0f0f0', display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                  <button type="submit" disabled={saving} className="btn-primary" style={{ fontSize: '0.875rem', opacity: saving ? 0.7 : 1 }}>
                    {saving ? 'Salvando...' : 'Salvar alterações'}
                  </button>
                  {saved && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', color: '#2ECC71', fontSize: '0.875rem', fontWeight: 600 }}>
                      <CheckCircle size={16} />
                      Salvo com sucesso!
                    </div>
                  )}
                </div>
              </div>
            </form>
          )}

          {/* Plan tab */}
          {activeTab === 'plan' && (
            <div>
              <h2 style={{ fontFamily: 'var(--font-montserrat, Montserrat, sans-serif)', fontSize: '1.1rem', fontWeight: 700, color: '#0A2E50', margin: '0 0 1.25rem' }}>
                Meu Plano
              </h2>

              {/* Billing toggle */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
                <button
                  onClick={() => setBilling('monthly')}
                  style={{ padding: '0.4rem 1rem', borderRadius: '999px', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '0.825rem', backgroundColor: billing === 'monthly' ? '#0A2E50' : '#f0f0f0', color: billing === 'monthly' ? 'white' : '#666' }}
                >
                  Mensal
                </button>
                <button
                  onClick={() => setBilling('annual')}
                  style={{ padding: '0.4rem 1rem', borderRadius: '999px', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '0.825rem', backgroundColor: billing === 'annual' ? '#0A2E50' : '#f0f0f0', color: billing === 'annual' ? 'white' : '#666', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                >
                  Anual
                  <span style={{ backgroundColor: '#2ECC71', color: 'white', fontSize: '0.65rem', fontWeight: 800, padding: '0.1rem 0.45rem', borderRadius: '999px' }}>-30%</span>
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '1rem' }}>

                {/* Free plan */}
                <div style={{ borderRadius: '12px', border: `2px solid ${currentPlan === 'FREE' ? '#1E6BB8' : '#e0e0e0'}`, padding: '1.5rem', position: 'relative' }}>
                  {currentPlan === 'FREE' && (
                    <div style={{ position: 'absolute', top: '-12px', left: '50%', transform: 'translateX(-50%)', backgroundColor: '#1E6BB8', color: 'white', padding: '0.2rem 0.875rem', borderRadius: '999px', fontSize: '0.72rem', fontWeight: 700, whiteSpace: 'nowrap' }}>
                      PLANO ATUAL
                    </div>
                  )}
                  <h3 style={{ fontFamily: 'var(--font-montserrat, Montserrat, sans-serif)', fontWeight: 700, color: '#0A2E50', margin: '0 0 0.25rem' }}>Gratuito</h3>
                  <p style={{ fontSize: '0.8rem', color: '#888', margin: '0 0 1rem' }}>Para quem está começando</p>
                  <div style={{ fontSize: '2rem', fontWeight: 800, color: '#0A2E50', fontFamily: 'var(--font-montserrat, Montserrat, sans-serif)', marginBottom: '1.25rem' }}>
                    R$ 0<span style={{ fontSize: '0.875rem', fontWeight: 400, color: '#999' }}>/mês</span>
                  </div>
                  <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                    {PLAN_FEATURES.FREE.map((text, i) => (
                      <li key={i} style={{ display: 'flex', gap: '0.5rem', fontSize: '0.825rem', color: '#0A2E50' }}>
                        <CheckCircle size={14} color="#2ECC71" style={{ flexShrink: 0, marginTop: '2px' }} />
                        {text}
                      </li>
                    ))}
                  </ul>
                  {currentPlan === 'PREMIUM' && (
                    <button className="btn-outline" style={{ width: '100%', justifyContent: 'center', fontSize: '0.825rem' }}>Fazer downgrade</button>
                  )}
                </div>

                {/* Premium plan */}
                <div style={{ borderRadius: '12px', border: `2px solid ${currentPlan === 'PREMIUM' ? '#FFD700' : '#e0e0e0'}`, padding: '1.5rem', position: 'relative', background: 'linear-gradient(135deg, rgba(255,215,0,0.05), rgba(10,46,80,0.02))' }}>
                  {currentPlan === 'PREMIUM' && (
                    <div style={{ position: 'absolute', top: '-12px', left: '50%', transform: 'translateX(-50%)', background: 'linear-gradient(135deg, #FFD700, #e6c200)', color: '#0A2E50', padding: '0.2rem 0.875rem', borderRadius: '999px', fontSize: '0.72rem', fontWeight: 700, whiteSpace: 'nowrap' }}>
                      PLANO ATUAL
                    </div>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                    <h3 style={{ fontFamily: 'var(--font-montserrat, Montserrat, sans-serif)', fontWeight: 700, color: '#0A2E50', margin: 0 }}>Premium</h3>
                    <Crown size={16} color="#FFD700" />
                  </div>
                  <p style={{ fontSize: '0.8rem', color: '#888', margin: '0 0 1rem' }}>Para investidores sérios</p>

                  {billing === 'monthly' ? (
                    <div style={{ marginBottom: '1.25rem' }}>
                      <div style={{ fontSize: '2rem', fontWeight: 800, color: '#0A2E50', fontFamily: 'var(--font-montserrat, Montserrat, sans-serif)' }}>
                        R$ 97<span style={{ fontSize: '0.875rem', fontWeight: 400, color: '#999' }}>/mês</span>
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#aaa', marginTop: '0.2rem' }}>Cobrado mensalmente · Cancele quando quiser</div>
                    </div>
                  ) : (
                    <div style={{ marginBottom: '1.25rem' }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
                        <span style={{ fontSize: '1rem', color: '#bbb', textDecoration: 'line-through' }}>R$ 97</span>
                        <span style={{ fontSize: '2rem', fontWeight: 800, color: '#0A2E50', fontFamily: 'var(--font-montserrat, Montserrat, sans-serif)' }}>R$ 67</span>
                        <span style={{ fontSize: '0.875rem', color: '#999' }}>/mês</span>
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#2ECC71', fontWeight: 700, marginTop: '0.2rem' }}>
                        Cobrado R$ 804/ano · Economia de R$ 360
                      </div>
                    </div>
                  )}

                  <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                    {PLAN_FEATURES.PREMIUM.map((text, i) => (
                      <li key={i} style={{ display: 'flex', gap: '0.5rem', fontSize: '0.825rem', color: '#0A2E50' }}>
                        <Star size={14} color="#FFD700" style={{ flexShrink: 0, marginTop: '2px' }} />
                        {text}
                      </li>
                    ))}
                  </ul>

                  {currentPlan === 'FREE' ? (
                    <button className="btn-primary" style={{ width: '100%', justifyContent: 'center', fontSize: '0.875rem', background: 'linear-gradient(135deg, #0A2E50, #1E6BB8)', fontFamily: 'var(--font-montserrat, Montserrat, sans-serif)' }}>
                      <Crown size={14} /> Assinar {billing === 'annual' ? 'plano anual' : 'plano mensal'}
                    </button>
                  ) : (
                    <button className="btn-outline" style={{ width: '100%', justifyContent: 'center', fontSize: '0.825rem', color: '#666', borderColor: '#ddd' }}>
                      Gerenciar assinatura
                    </button>
                  )}
                </div>
              </div>

              <div style={{ marginTop: '1.25rem', padding: '0.875rem 1rem', backgroundColor: 'rgba(30,107,184,0.06)', borderRadius: '8px', fontSize: '0.8rem', color: '#555' }}>
                Configure as chaves do Stripe (<code>.env.local</code>) para ativar os pagamentos reais.
              </div>
            </div>
          )}

          {/* Notifications tab */}
          {activeTab === 'notifications' && (
            <div>
              <h2 style={{ fontFamily: 'var(--font-montserrat, Montserrat, sans-serif)', fontSize: '1.1rem', fontWeight: 700, color: '#0A2E50', margin: '0 0 1.5rem' }}>
                Preferências de Notificação
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {[
                  { key: 'newAuctions', label: 'Novos leilões', desc: 'Notificar quando novos leilões forem adicionados conforme seus filtros' },
                  { key: 'statusChanges', label: 'Mudanças de status', desc: 'Notificar quando o status de um imóvel salvo mudar' },
                  { key: 'deadlines', label: 'Prazos e vencimentos', desc: 'Lembretes de datas importantes dos seus imóveis no diário' },
                  { key: 'newsletter', label: 'Newsletter semanal', desc: 'Resumo semanal com as melhores oportunidades e insights de mercado' },
                ].map((item) => (
                  <div
                    key={item.key}
                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', backgroundColor: '#f9f9f9', borderRadius: '10px', gap: '1rem' }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, color: '#0A2E50', fontSize: '0.875rem', marginBottom: '0.25rem' }}>{item.label}</div>
                      <div style={{ fontSize: '0.8rem', color: '#666' }}>{item.desc}</div>
                    </div>
                    <button
                      onClick={() => setNotifications((prev) => ({ ...prev, [item.key]: !prev[item.key as keyof typeof prev] }))}
                      style={{
                        width: '44px',
                        height: '24px',
                        borderRadius: '12px',
                        border: 'none',
                        cursor: 'pointer',
                        backgroundColor: notifications[item.key as keyof typeof notifications] ? '#1E6BB8' : '#ddd',
                        position: 'relative',
                        transition: 'background-color 0.2s',
                        flexShrink: 0,
                      }}
                    >
                      <div
                        style={{
                          position: 'absolute',
                          top: '2px',
                          left: notifications[item.key as keyof typeof notifications] ? '22px' : '2px',
                          width: '20px',
                          height: '20px',
                          borderRadius: '50%',
                          backgroundColor: 'white',
                          transition: 'left 0.2s',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                        }}
                      />
                    </button>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: '1.25rem' }}>
                <button className="btn-primary" style={{ fontSize: '0.875rem' }}>Salvar preferências</button>
              </div>
            </div>
          )}

          {/* Security tab */}
          {activeTab === 'security' && (
            <div>
              <h2 style={{ fontFamily: 'var(--font-montserrat, Montserrat, sans-serif)', fontSize: '1.1rem', fontWeight: 700, color: '#0A2E50', margin: '0 0 1.5rem' }}>
                Segurança
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div>
                  <h3 style={{ fontFamily: 'var(--font-montserrat, Montserrat, sans-serif)', fontSize: '0.95rem', fontWeight: 700, color: '#0A2E50', margin: '0 0 1rem' }}>
                    Alterar Senha
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#0A2E50', marginBottom: '0.375rem' }}>Senha atual</label>
                      <input type="password" placeholder="••••••••" className="input-field" />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#0A2E50', marginBottom: '0.375rem' }}>Nova senha</label>
                      <input type="password" placeholder="Mínimo 6 caracteres" className="input-field" />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#0A2E50', marginBottom: '0.375rem' }}>Confirmar nova senha</label>
                      <input type="password" placeholder="Repita a nova senha" className="input-field" />
                    </div>
                    <button className="btn-primary" style={{ fontSize: '0.875rem', alignSelf: 'flex-start' }}>Alterar senha</button>
                  </div>
                </div>

                <div style={{ paddingTop: '1.25rem', borderTop: '1px solid #f0f0f0' }}>
                  <h3 style={{ fontFamily: 'var(--font-montserrat, Montserrat, sans-serif)', fontSize: '0.95rem', fontWeight: 700, color: '#e74c3c', margin: '0 0 0.75rem' }}>
                    Zona de Perigo
                  </h3>
                  <button style={{ padding: '0.625rem 1rem', borderRadius: '8px', border: '2px solid rgba(231,76,60,0.4)', backgroundColor: 'rgba(231,76,60,0.06)', color: '#e74c3c', fontWeight: 600, fontSize: '0.825rem', cursor: 'pointer' }}>
                    Excluir minha conta
                  </button>
                  <p style={{ fontSize: '0.75rem', color: '#999', marginTop: '0.5rem' }}>Esta ação é irreversível. Todos os seus dados serão removidos permanentemente.</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
