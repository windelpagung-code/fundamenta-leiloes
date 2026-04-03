'use client';

import { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp, CheckCircle2, Circle, AlertTriangle, ClipboardList, ShieldCheck } from 'lucide-react';

// ── Types ───────────────────────────────────────────────────────────────────

interface ChecklistItem {
  id: string;
  label: string;
  tip?: string;
  critical?: boolean;   // item bloqueador — destaque vermelho se desmarcado
  warning?: boolean;    // item importante — destaque laranja se desmarcado
}

interface ChecklistGroup {
  id: string;
  emoji: string;
  label: string;
  color: string;
  bgColor: string;
  items: ChecklistItem[];
}

type ChecklistType = 'PRE' | 'POST';

// ── Dados dos checklists ─────────────────────────────────────────────────────

const PRE_CHECKLIST: ChecklistGroup[] = [
  {
    id: 'edital',
    emoji: '📋',
    label: 'Edital e Documentação',
    color: '#1E6BB8',
    bgColor: 'rgba(30,107,184,0.06)',
    items: [
      { id: 'e1', label: 'Li o edital completo do leilão', tip: 'O edital é o documento mais importante. Contém todas as condições, restrições e prazos do leilão.', critical: true },
      { id: 'e2', label: 'Anotei a data, horário e plataforma/local do leilão', tip: 'Confirme se é leilão presencial, online ou combinado. Plataformas: Zuk, Superbid, Mega Leilões, etc.' },
      { id: 'e3', label: 'Entendi as condições e prazo de pagamento após arrematação', tip: 'Geralmente 24h para sinal e 30 dias para quitação. Fique atento: imóveis da Caixa têm regras específicas.', critical: true },
      { id: 'e4', label: 'Verifiquei a modalidade: 1ª ou 2ª praça e o valor mínimo de lance', tip: 'Na 2ª praça o valor mínimo é menor, mas pode ter mais riscos. Confirme o valor de avaliação oficial.' },
    ],
  },
  {
    id: 'imovel',
    emoji: '🏠',
    label: 'Análise do Imóvel',
    color: '#27ae60',
    bgColor: 'rgba(46,204,113,0.06)',
    items: [
      { id: 'i1', label: 'Localizei e identifiquei o imóvel fisicamente (mapa, Street View)', tip: 'Use Google Maps para avaliar localização, vizinhança, acesso ao transporte e comércio próximo.', warning: true },
      { id: 'i2', label: 'Verifiquei o estado geral do imóvel (fotos do edital, vistoria externa)', tip: 'Tente realizar uma vistoria externa. Anote irregularidades visíveis como rachaduras, infiltrações ou abandono.' },
      { id: 'i3', label: 'Estimei o custo de reforma necessária', tip: 'Pede orçamentos para marceneiro, pintor, elétrica e hidráulica. Inclua sempre 20% de margem de segurança.' },
      { id: 'i4', label: 'Confirmei área real (m²), número de quartos e características', tip: 'Compare as informações do edital com fotos e anúncios similares na região para validar os dados.' },
      { id: 'i5', label: 'Pesquisei preços de imóveis similares na região (valor de mercado real)', tip: 'Use Zap Imóveis, Viva Real e OLX para entender o valor real de mercado e potencial de venda/locação.' },
    ],
  },
  {
    id: 'juridico',
    emoji: '⚖️',
    label: 'Análise Jurídica e Débitos',
    color: '#c0392b',
    bgColor: 'rgba(231,76,60,0.06)',
    items: [
      { id: 'j1', label: 'Consultei a matrícula do imóvel no Cartório de Registro de Imóveis', tip: 'A matrícula é a certidão de nascimento do imóvel. Solicite a certidão atualizada com todos os atos.', critical: true },
      { id: 'j2', label: 'Verifiquei ônus, penhoras, hipotecas e gravames na matrícula', tip: 'Penhoras e hipotecas podem continuar com o imóvel após arrematação em alguns casos. Consulte um advogado.', critical: true },
      { id: 'j3', label: 'Pesquisei débitos de IPTU junto à prefeitura municipal', tip: 'Débitos de IPTU geralmente são assumidos pelo arrematante. Ligue para a prefeitura ou consulte no site.', warning: true },
      { id: 'j4', label: 'Pesquisei débitos de condomínio (se imóvel em condomínio)', tip: 'Dívidas de condomínio têm caráter propter rem (acompanham o imóvel). Solicite declaração da administradora.', warning: true },
      { id: 'j5', label: 'Confirmei e entendo o status de ocupação do imóvel', tip: 'Imóvel ocupado = risco adicional. Inclua custos de desocupação (advogado + honorários) no seu cálculo.', critical: true },
      { id: 'j6', label: 'Consultei ou fui orientado por advogado especializado em leilões', tip: 'Recomendado mesmo para arrematantes experientes. Honorários de R$300–R$800 podem evitar prejuízos de dezenas de milhares.' },
    ],
  },
  {
    id: 'financeiro',
    emoji: '💰',
    label: 'Planejamento Financeiro',
    color: '#f39c12',
    bgColor: 'rgba(243,156,18,0.06)',
    items: [
      { id: 'f1', label: 'Calculei todos os custos: ITBI (2–3%), cartório, comissão leiloeiro (5%)', tip: 'Use a calculadora de viabilidade desta página. ITBI varia por município — consulte a alíquota local.', warning: true },
      { id: 'f2', label: 'Incluí custo de desocupação no planejamento (se imóvel ocupado)', tip: 'Reintegração de posse pode custar de R$8.000 a R$30.000 e levar de 60 dias a 2 anos.' },
      { id: 'f3', label: 'Defini meu lance máximo e comprometo-me a não ultrapassá-lo', tip: 'Lance máximo = Valor de venda esperado – todos os custos – margem de lucro mínima. Não ceda à emoção do momento!', critical: true },
      { id: 'f4', label: 'Tenho capital disponível para o pagamento dentro do prazo exigido', tip: 'Confirmei saldo em conta ou crédito disponível para quitação. Atrasos geram multas e podem anular a arrematação.', critical: true },
      { id: 'f5', label: 'Analisei o ROI na calculadora de viabilidade e aprovei a operação', tip: 'ROI líquido esperado calculado considerando todos os custos, IR e comissão na venda. Mínimo recomendado: 15%.' },
    ],
  },
];

const POST_CHECKLIST: ChecklistGroup[] = [
  {
    id: 'primeiros',
    emoji: '📋',
    label: 'Primeiros 30 Dias — Urgente',
    color: '#c0392b',
    bgColor: 'rgba(231,76,60,0.06)',
    items: [
      { id: 'p1', label: 'Recebi o auto de arrematação ou carta de arrematação assinada', tip: 'Documente tudo. Este é o comprovante legal de que você é o novo proprietário até o registro em cartório.', critical: true },
      { id: 'p2', label: 'Realizei o pagamento do saldo devedor dentro do prazo estipulado', tip: 'Guarde todos os comprovantes de pagamento. O não pagamento no prazo pode anular a arrematação.', critical: true },
      { id: 'p3', label: 'Recolhi o ITBI junto à prefeitura municipal', tip: 'Necessário para o registro em cartório. Valor: 2–3% do valor venal. Prazo: verifique na prefeitura.', critical: true },
      { id: 'p4', label: 'Agendei o registro da carta de arrematação no Cartório de Registro', tip: 'O registro é o que oficializa você como proprietário perante terceiros. Não postergue — tem custo e prazo.', critical: true },
      { id: 'p5', label: 'Guardei todos os comprovantes e documentos relacionados à arrematação', tip: 'Organize: auto de arrematação, comprovantes de pagamento, guias de ITBI, recibos de cartório.' },
    ],
  },
  {
    id: 'posse',
    emoji: '🏠',
    label: 'Posse e Regularização (30–90 dias)',
    color: '#1E6BB8',
    bgColor: 'rgba(30,107,184,0.06)',
    items: [
      { id: 'po1', label: 'Matrícula atualizada com meu nome como novo proprietário', tip: 'Solicite certidão atualizada no cartório após o registro para confirmar a atualização.', critical: true },
      { id: 'po2', label: 'Realizei vistoria técnica completa com fotos de todos os cômodos', tip: 'Documente tudo com fotos datadas. Fundamental para qualquer disputa futura e para planejamento de reforma.' },
      { id: 'po3', label: 'Notifiquei formalmente os ocupantes (se houver), com prazo para saída', tip: 'A notificação formal (preferencialmente via cartório) é o primeiro passo legal antes de iniciar a reintegração de posse.', warning: true },
      { id: 'po4', label: 'Iniciei ação de reintegração de posse (se necessário)', tip: 'Contrate advogado especializado. Com liminar, pode demorar 30–90 dias; sem liminar, pode levar anos.' },
      { id: 'po5', label: 'Recebi as chaves e tenho pleno acesso ao imóvel', tip: 'Troque as fechaduras imediatamente ao receber as chaves. Faça novo registro fotográfico e documente o estado do imóvel.' },
    ],
  },
  {
    id: 'debitos',
    emoji: '💰',
    label: 'Débitos e Regularização Financeira',
    color: '#f39c12',
    bgColor: 'rgba(243,156,18,0.06)',
    items: [
      { id: 'd1', label: 'Pesquisei e negociei/quitei os débitos de IPTU em aberto', tip: 'Prefeituras geralmente oferecem parcelamento e descontos para regularização. Peça certidão de débitos.', warning: true },
      { id: 'd2', label: 'Pesquisei e negociei/quitei os débitos de condomínio em aberto', tip: 'Negocie com a administradora. Dívidas de condomínio podem bloquear a venda futura.', warning: true },
      { id: 'd3', label: 'Contratei seguro do imóvel (incêndio, danos estruturais)', tip: 'Custo mensal de R$30–R$150 para imóvel segurado. Proteção essencial enquanto o imóvel está em reforma/vago.' },
      { id: 'd4', label: 'Regularizei conta de água, luz e gás (transferência ou religação)', tip: 'Imóveis abandonados muitas vezes têm as contas cortadas. Solicite religação e transfira para seu CPF.' },
      { id: 'd5', label: 'Verifiquei e regularizei eventuais débitos condominiais extras', tip: 'Fundo de obras, multas e outras taxas do condomínio. Peça extrato completo à administradora.' },
    ],
  },
  {
    id: 'reforma',
    emoji: '🔨',
    label: 'Reforma, Valorização e Saída',
    color: '#9b59b6',
    bgColor: 'rgba(155,89,182,0.06)',
    items: [
      { id: 'r1', label: 'Obtive no mínimo 3 orçamentos de reforma e aprovei o melhor custo-benefício', tip: 'Compare escopo, materiais e prazos. Peça referências dos prestadores. Jamais pague mais de 30% adiantado.' },
      { id: 'r2', label: 'Elaborei cronograma de reforma com etapas e datas previstas', tip: 'Cada mês extra de reforma = mais custos de holding (IPTU, condomínio, seguro). Cumpra os prazos.' },
      { id: 'r3', label: 'Documentei todas as etapas da reforma com fotos e recibos', tip: 'Além do controle de custos, fotos antes/depois valorizam o imóvel na apresentação para compradores.' },
      { id: 'r4', label: 'Imóvel avaliado por corretor credenciado após conclusão da reforma', tip: 'A avaliação profissional ajuda a definir o preço de venda correto e acelera a transação.', warning: true },
      { id: 'r5', label: 'Imóvel anunciado para venda ou locação em plataformas relevantes', tip: 'Anuncie no Zap Imóveis, Viva Real, OLX e com corretores locais para maximizar o alcance.' },
      { id: 'r6', label: 'Documentação completa para venda organizada e pronta para apresentar', tip: 'Separe: matrícula atualizada, certidões negativas de débitos (IPTU, condomínio), habite-se (se aplicável).' },
    ],
  },
];

// ── Basic checklists (FREE plan) ─────────────────────────────────────────────

const BASIC_PRE: ChecklistGroup[] = [
  {
    id: 'basico_pre',
    emoji: '📋',
    label: 'Verificações Essenciais — Pré-Arrematação',
    color: '#1E6BB8',
    bgColor: 'rgba(30,107,184,0.06)',
    items: [
      { id: 'b1', label: 'Li o edital completo do leilão', tip: 'O edital é o documento mais importante. Contém todas as condições, restrições e prazos.', critical: true },
      { id: 'b2', label: 'Entendi as condições e prazo de pagamento após arrematação', tip: 'Geralmente 24h para sinal e 30 dias para quitação.', critical: true },
      { id: 'b3', label: 'Consultei a matrícula e verifiquei ônus e penhoras', tip: 'A matrícula é a certidão de nascimento do imóvel. Verifique penhoras e hipotecas.', critical: true },
      { id: 'b4', label: 'Confirmei o status de ocupação do imóvel', tip: 'Imóvel ocupado = custo extra de desocupação. Inclua no seu cálculo.', critical: true },
      { id: 'b5', label: 'Calculei todos os custos: ITBI, leiloeiro e documentação', tip: 'Use a calculadora de viabilidade para estimar o custo total da operação.', warning: true },
    ],
  },
];

const BASIC_POST: ChecklistGroup[] = [
  {
    id: 'basico_post',
    emoji: '✅',
    label: 'Ações Essenciais — Pós-Arrematação',
    color: '#27ae60',
    bgColor: 'rgba(46,204,113,0.06)',
    items: [
      { id: 'p1', label: 'Recebi o auto ou carta de arrematação assinada', tip: 'Comprovante legal de que você é o novo proprietário até o registro em cartório.', critical: true },
      { id: 'p2', label: 'Realizei o pagamento do saldo dentro do prazo', tip: 'Guarde todos os comprovantes. O não pagamento pode anular a arrematação.', critical: true },
      { id: 'p3', label: 'Recolhi o ITBI junto à prefeitura municipal', tip: 'Necessário para o registro em cartório. Valor: 2–3% do valor venal.', critical: true },
      { id: 'p4', label: 'Registrei a carta de arrematação no Cartório de Registro', tip: 'O registro oficializa você como proprietário. Não postergue.', critical: true },
      { id: 'p5', label: 'Organizei todos os comprovantes e documentos', tip: 'Separe: auto de arrematação, comprovantes de pagamento, guias de ITBI e recibos.' },
    ],
  },
];

// ── Component ────────────────────────────────────────────────────────────────

interface PropertyChecklistProps {
  propertyId: string;
  type: ChecklistType;
  occupationStatus?: string;
  isInCondominium?: boolean;
  basic?: boolean;
}

export default function PropertyChecklist({
  propertyId,
  type,
  occupationStatus,
  isInCondominium = true,
  basic = false,
}: PropertyChecklistProps) {
  const CHECKLIST = basic
    ? (type === 'PRE' ? BASIC_PRE : BASIC_POST)
    : (type === 'PRE' ? PRE_CHECKLIST : POST_CHECKLIST);
  const storageKey = `fundamenta_checklist_${type.toLowerCase()}_${propertyId}`;

  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const [collapsed, setCollapsed] = useState(false);

  // Load from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        setChecked(JSON.parse(stored));
      }
    } catch { /* ignore */ }
    // Open all groups by default
    const initial: Record<string, boolean> = {};
    CHECKLIST.forEach((g) => { initial[g.id] = true; });
    setOpenGroups(initial);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  function toggle(itemId: string) {
    const next = { ...checked, [itemId]: !checked[itemId] };
    setChecked(next);
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch { /* ignore */ }
  }

  function toggleGroup(groupId: string) {
    setOpenGroups((prev) => ({ ...prev, [groupId]: !prev[groupId] }));
  }

  // Stats
  const allItems = CHECKLIST.flatMap((g) => g.items);
  const totalCount = allItems.length;
  const doneCount  = allItems.filter((i) => checked[i.id]).length;
  const criticalUndone = allItems.filter((i) => (i.critical || i.warning) && !checked[i.id]);
  const pct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

  const statusColor  = pct === 100 ? '#2ECC71' : criticalUndone.length > 0 ? '#e74c3c' : '#f39c12';
  const statusLabel  = pct === 100 ? 'Concluído ✓' : criticalUndone.length > 0 ? `${criticalUndone.length} ponto(s) crítico(s) pendente(s)` : `${doneCount}/${totalCount} itens concluídos`;
  const barColor     = pct === 100 ? '#2ECC71' : pct >= 70 ? '#f39c12' : '#e74c3c';

  const title = type === 'PRE'
    ? '✅ Checklist Pré-Arrematação'
    : '📦 Checklist Pós-Arrematação';
  const subtitle = type === 'PRE'
    ? 'Conclua todos os itens antes de dar seu lance. Itens críticos (🔴) são obrigatórios.'
    : 'Acompanhe cada etapa após arrematar. Não pule os itens críticos (🔴).';

  return (
    <div style={{ backgroundColor: 'white', borderRadius: '14px', boxShadow: '0 2px 8px rgba(10,46,80,0.08)', overflow: 'hidden' }}>
      <style>{`
        .checklist-item { display:flex; align-items:flex-start; gap:0.75rem; padding:0.7rem 0.875rem; border-radius:9px; cursor:pointer; transition:background 0.15s; }
        .checklist-item:hover { background: rgba(10,46,80,0.03); }
        .checklist-item.done .item-label { text-decoration:line-through; color:#aaa; }
        .checklist-item.critical-pending { background: rgba(231,76,60,0.04); border-left:3px solid rgba(231,76,60,0.4); }
        .checklist-item.warning-pending  { background: rgba(243,156,18,0.04); border-left:3px solid rgba(243,156,18,0.4); }
        .tip-text { font-size:0.72rem; color:#888; margin-top:0.2rem; line-height:1.5; }
        @keyframes checkPop { 0%{transform:scale(1)} 50%{transform:scale(1.25)} 100%{transform:scale(1)} }
        .check-anim { animation: checkPop 0.25s ease; }
      `}</style>

      {/* Header */}
      <div
        style={{ padding: '1.25rem 1.25rem 1rem', cursor: 'pointer', userSelect: 'none' }}
        onClick={() => setCollapsed(!collapsed)}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem' }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '0.25rem' }}>
              {type === 'PRE'
                ? <ClipboardList size={20} color="#1E6BB8" />
                : <ShieldCheck size={20} color="#27ae60" />
              }
              <h2 style={{ fontFamily: 'var(--font-montserrat, Montserrat, sans-serif)', fontSize: '1.05rem', fontWeight: 800, color: '#0A2E50', margin: 0 }}>
                {title}
              </h2>
            </div>
            <p style={{ color: '#888', fontSize: '0.78rem', margin: 0 }}>{subtitle}</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexShrink: 0 }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '1.3rem', fontWeight: 800, color: barColor, fontFamily: 'var(--font-montserrat, Montserrat, sans-serif)', lineHeight: 1 }}>{pct}%</div>
              <div style={{ fontSize: '0.65rem', color: statusColor, fontWeight: 700 }}>{statusLabel}</div>
            </div>
            {collapsed ? <ChevronDown size={20} color="#999" /> : <ChevronUp size={20} color="#999" />}
          </div>
        </div>

        {/* Progress bar */}
        <div style={{ marginTop: '0.875rem', height: '6px', backgroundColor: '#f0f0f0', borderRadius: '3px', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${pct}%`, backgroundColor: barColor, borderRadius: '3px', transition: 'width 0.4s ease' }} />
        </div>

        {/* Critical warning */}
        {!collapsed && criticalUndone.length > 0 && (
          <div style={{ marginTop: '0.75rem', padding: '0.625rem 0.875rem', backgroundColor: 'rgba(231,76,60,0.07)', border: '1px solid rgba(231,76,60,0.2)', borderRadius: '8px', display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
            <AlertTriangle size={15} style={{ color: '#e74c3c', flexShrink: 0, marginTop: '1px' }} />
            <p style={{ margin: 0, fontSize: '0.78rem', color: '#c0392b', lineHeight: 1.5 }}>
              <strong>{criticalUndone.length} {criticalUndone.length === 1 ? 'item crítico pendente' : 'itens críticos pendentes'}.</strong>{' '}
              {type === 'PRE'
                ? 'Recomendamos fortemente concluir estes itens antes de participar do leilão.'
                : 'Execute estes itens com prioridade — podem gerar consequências legais ou financeiras.'}
            </p>
          </div>
        )}
      </div>

      {/* Groups */}
      {!collapsed && (
        <div style={{ borderTop: '1px solid #f0f0f0' }}>
          {CHECKLIST.map((group, gIdx) => {
            const groupItems = group.items;
            const groupDone = groupItems.filter((i) => checked[i.id]).length;
            const isOpen = openGroups[group.id] !== false;

            return (
              <div key={group.id} style={{ borderBottom: gIdx < CHECKLIST.length - 1 ? '1px solid #f5f5f5' : 'none' }}>
                {/* Group header */}
                <button
                  onClick={() => toggleGroup(group.id)}
                  style={{ width: '100%', background: 'none', border: 'none', padding: '0.875rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.625rem', cursor: 'pointer', textAlign: 'left' }}
                >
                  <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: group.bgColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', flexShrink: 0 }}>
                    {group.emoji}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: 'var(--font-montserrat, Montserrat, sans-serif)', fontWeight: 700, color: '#0A2E50', fontSize: '0.875rem' }}>
                      {group.label}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#888', marginTop: '0.1rem' }}>
                      {groupDone}/{groupItems.length} concluídos
                    </div>
                  </div>
                  {/* Group mini progress */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ width: '60px', height: '4px', backgroundColor: '#f0f0f0', borderRadius: '2px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${groupItems.length > 0 ? (groupDone / groupItems.length) * 100 : 0}%`, backgroundColor: groupDone === groupItems.length ? '#2ECC71' : group.color, transition: 'width 0.3s ease' }} />
                    </div>
                    {isOpen ? <ChevronUp size={16} color="#bbb" /> : <ChevronDown size={16} color="#bbb" />}
                  </div>
                </button>

                {/* Items */}
                {isOpen && (
                  <div style={{ padding: '0 1rem 0.875rem' }}>
                    {groupItems.map((item) => {
                      const isDone = !!checked[item.id];
                      const isCriticalPending = (item.critical) && !isDone;
                      const isWarningPending  = (item.warning) && !isDone;

                      return (
                        <div
                          key={item.id}
                          className={`checklist-item${isDone ? ' done' : ''}${isCriticalPending ? ' critical-pending' : ''}${isWarningPending && !isCriticalPending ? ' warning-pending' : ''}`}
                          onClick={() => toggle(item.id)}
                          role="checkbox"
                          aria-checked={isDone}
                          tabIndex={0}
                          onKeyDown={(e) => e.key === ' ' && toggle(item.id)}
                        >
                          {/* Checkbox icon */}
                          <div style={{ flexShrink: 0, marginTop: '1px' }}>
                            {isDone ? (
                              <CheckCircle2 size={20} color="#2ECC71" className="check-anim" />
                            ) : isCriticalPending ? (
                              <Circle size={20} color="#e74c3c" />
                            ) : isWarningPending ? (
                              <Circle size={20} color="#f39c12" />
                            ) : (
                              <Circle size={20} color="#ccc" />
                            )}
                          </div>

                          {/* Content */}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div className="item-label" style={{ fontSize: '0.85rem', color: isDone ? '#aaa' : '#333', fontWeight: isCriticalPending ? 600 : 500, lineHeight: 1.4, display: 'flex', alignItems: 'center', gap: '0.375rem', flexWrap: 'wrap' }}>
                              {item.label}
                              {item.critical && !isDone && (
                                <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#e74c3c', backgroundColor: 'rgba(231,76,60,0.1)', padding: '0.1rem 0.4rem', borderRadius: '4px', whiteSpace: 'nowrap' }}>
                                  CRÍTICO
                                </span>
                              )}
                              {item.warning && !item.critical && !isDone && (
                                <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#e67e22', backgroundColor: 'rgba(230,126,34,0.1)', padding: '0.1rem 0.4rem', borderRadius: '4px', whiteSpace: 'nowrap' }}>
                                  IMPORTANTE
                                </span>
                              )}
                            </div>
                            {item.tip && (
                              <div className="tip-text">{item.tip}</div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          {/* Footer */}
          <div style={{ padding: '1rem 1.25rem', backgroundColor: pct === 100 ? 'rgba(46,204,113,0.06)' : '#fafafa', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              {pct === 100 ? (
                <>
                  <CheckCircle2 size={18} color="#2ECC71" />
                  <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#27ae60' }}>
                    {type === 'PRE' ? 'Checklist completo! Você está preparado para o leilão.' : 'Parabéns! Todos os passos foram concluídos.'}
                  </span>
                </>
              ) : (
                <span style={{ fontSize: '0.78rem', color: '#888' }}>
                  Clique em cada item para marcar como concluído. O progresso é salvo automaticamente.
                </span>
              )}
            </div>
            {doneCount > 0 && (
              <button
                onClick={() => {
                  const reset: Record<string, boolean> = {};
                  setChecked(reset);
                  try { localStorage.setItem(storageKey, JSON.stringify(reset)); } catch { /* ignore */ }
                }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ccc', fontSize: '0.72rem', fontWeight: 600 }}
              >
                Limpar tudo
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
