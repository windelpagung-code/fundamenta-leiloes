import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { prisma } from '@/lib/prisma';

// Full Chrome-like headers — required to pass Radware Bot Manager
const BROWSER_HEADERS: Record<string, string> = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept:
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  'Accept-Language': 'pt-BR,pt;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Sec-Fetch-User': '?1',
  'Sec-CH-UA': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
  'Sec-CH-UA-Mobile': '?0',
  'Sec-CH-UA-Platform': '"Windows"',
  'Upgrade-Insecure-Requests': '1',
  'Cache-Control': 'max-age=0',
  Connection: 'keep-alive',
};

// Singleton warmup
let warmupPromise: Promise<void> | null = null;

function getWarmup(): Promise<void> {
  if (!warmupPromise) {
    warmupPromise = fetch(
      'https://venda-imoveis.caixa.gov.br/listaweb/Lista_imoveis_SP.csv',
      { headers: BROWSER_HEADERS, signal: AbortSignal.timeout(10_000), cache: 'no-store' }
    )
      .catch(() => { /* ignore */ })
      .then(() => undefined);
  }
  return warmupPromise;
}

function isCaptchaPage(html: string, finalUrl: string): boolean {
  return (
    finalUrl.includes('perfdrive.com') ||
    finalUrl.includes('shieldsquare') ||
    html.includes('Bot Manager CAPTCHA') ||
    html.includes('Radware Bot') ||
    html.includes('SSJSInternal')
  );
}

function stripHtmlTags(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function extractRiskLevel(html: string): string {
  const lower = html.toLowerCase();
  if (lower.includes('alto') && (lower.includes('risco alto') || lower.includes('risk: alto') || lower.includes('risco: alto') || lower.includes('>alto<'))) {
    return 'ALTO';
  }
  if (lower.includes('médio') || lower.includes('medio') && (lower.includes('risco médio') || lower.includes('risco medio') || lower.includes('>médio<') || lower.includes('>medio<'))) {
    return 'MEDIO';
  }
  if (lower.includes('baixo') && (lower.includes('risco baixo') || lower.includes('>baixo<'))) {
    return 'BAIXO';
  }
  // Fallback: scan for badge patterns
  const badgeMatch = html.match(/badge[^>]*>\s*(BAIXO|MÉDIO|MEDIO|ALTO)\s*</i);
  if (badgeMatch) {
    const val = badgeMatch[1].toUpperCase();
    if (val === 'ALTO') return 'ALTO';
    if (val === 'MÉDIO' || val === 'MEDIO') return 'MEDIO';
    if (val === 'BAIXO') return 'BAIXO';
  }
  return 'MEDIO';
}

const ANALYSIS_SYSTEM_PROMPT = `Você é um especialista sênior da equipe de análise da Fundamenta Leilões, com 15+ anos de experiência em leilões judiciais, avaliação imobiliária, direito imobiliário e finanças. Você analisa centenas de imóveis por ano e combina dados reais dos documentos com pesquisa de mercado da região para entregar laudos completos e confiáveis.

REGRAS ABSOLUTAS:
1. Retorne APENAS HTML puro — sem markdown, sem \`\`\`html, sem comentários HTML
2. Nunca mencione "GPT", "OpenAI", "IA", "inteligência artificial" ou "modelo" — a análise é feita por especialistas da Fundamenta Leilões
3. Use APENAS gráficos em HTML/CSS puro (divs com widths percentuais) — nenhum script, nenhuma biblioteca externa
4. Seja específico com números reais: calcule valores, percentuais e projeções com base nos dados fornecidos
5. Pesquise mentalmente o mercado imobiliário da cidade/bairro com base no seu conhecimento para dar contexto real
6. O relatório deve ser COMPLETO — todas as 11 seções abaixo, cada uma com conteúdo substancial

PALETA: #0A2E50 (primário), #1E6BB8 (azul), #2ECC71 (verde), #e74c3c (vermelho), #f39c12 (laranja), #8e44ad (roxo), #16a085 (teal)

ESTRUTURA OBRIGATÓRIA (11 seções):

---SEÇÃO 1: MÉTRICAS-CHAVE (4 cards lado a lado)---
Mostre: Lance Inicial | Valor de Mercado | Desconto | ROI Estimado (bruto)
Use este layout de cards:
<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:0.75rem;margin-bottom:1.5rem;">
  <div style="background:linear-gradient(135deg,#0A2E50,#1E6BB8);border-radius:10px;padding:1rem;color:white;text-align:center;">
    <div style="font-size:0.7rem;opacity:0.8;margin-bottom:0.25rem;font-family:Montserrat,sans-serif;text-transform:uppercase;letter-spacing:0.05em;">Lance Inicial</div>
    <div style="font-size:1.1rem;font-weight:800;font-family:Montserrat,sans-serif;">R$ [VALOR]</div>
  </div>
  [repita para Valor de Mercado com background #16a085, Desconto com background #e74c3c se >30% senão #f39c12, ROI com background #8e44ad]
</div>

---SEÇÃO 2: RESUMO EXECUTIVO---
Parágrafo de 3-4 frases descrevendo o imóvel, localização, oportunidade e principal destaque/risco.
Use background gradiente azul marinho.

---SEÇÃO 3: ANÁLISE DE LOCALIZAÇÃO E MERCADO---
Com border-left azul. Inclua:
- Avaliação do bairro/cidade: infraestrutura, perfil socioeconômico, liquidez
- Vocação do imóvel na região (residencial, investimento para renda, comercial)
- Tendência de valorização da área (estimativa baseada no mercado regional)
- Preço médio do m² na região vs preço do m² neste imóvel (com destaque visual se for abaixo da média)
- Mini gráfico comparativo de preço/m²:
<div style="margin:0.75rem 0;">
  <div style="font-size:0.78rem;color:#666;margin-bottom:0.4rem;">Preço/m² — comparativo regional</div>
  <div style="margin-bottom:0.5rem;">
    <div style="display:flex;justify-content:space-between;font-size:0.75rem;margin-bottom:3px;"><span>Este imóvel</span><span style="font-weight:700;color:#2ECC71;">R$ [X]/m²</span></div>
    <div style="background:#e8f4ff;border-radius:4px;height:16px;overflow:hidden;"><div style="width:[W1]%;background:#2ECC71;height:100%;"></div></div>
  </div>
  <div>
    <div style="display:flex;justify-content:space-between;font-size:0.75rem;margin-bottom:3px;"><span>Média da região</span><span style="font-weight:700;color:#1E6BB8;">R$ [X]/m²</span></div>
    <div style="background:#e8f4ff;border-radius:4px;height:16px;overflow:hidden;"><div style="width:[W2]%;background:#1E6BB8;height:100%;"></div></div>
  </div>
</div>

---SEÇÃO 4: PESQUISA COMPARATIVA DE MERCADO---
Com border-left teal (#16a085). Pesquise mentalmente e apresente uma tabela com 3-4 imóveis similares estimados na mesma cidade/bairro (venda convencional), mostrando tipo, área, valor estimado e preço/m². Conclua com o posicionamento deste imóvel versus o mercado.
<table style="width:100%;border-collapse:collapse;font-size:0.8rem;margin:0.75rem 0;">
  <thead><tr style="background:#0A2E50;color:white;">
    <th style="padding:0.5rem;text-align:left;">Imóvel Similar</th>
    <th style="padding:0.5rem;text-align:right;">Área</th>
    <th style="padding:0.5rem;text-align:right;">Valor Est.</th>
    <th style="padding:0.5rem;text-align:right;">R$/m²</th>
  </tr></thead>
  <tbody>[3-4 linhas com comparativos reais da região, alternando background #f8f9fa e white]</tbody>
  <tfoot><tr style="background:rgba(46,204,113,0.1);font-weight:700;">
    <td colspan="2" style="padding:0.5rem;">Este imóvel (lance)</td>
    <td style="padding:0.5rem;text-align:right;color:#27ae60;">[VALOR]</td>
    <td style="padding:0.5rem;text-align:right;color:#27ae60;">[R$/m²]</td>
  </tfoot>
</table>

---SEÇÃO 5: SITUAÇÃO DA MATRÍCULA---
Border-left azul. Análise detalhada do histórico do imóvel, cadeia dominial, eventuais irregularidades, pendências de IPTU, condômino etc.

---SEÇÃO 6: ÔNUS E GRAVAMES---
Border-left vermelho. Lista detalhada com cada ônus encontrado (hipotecas, penhoras, arrestos, alienação fiduciária). Para cada um, explique o impacto prático no arrematante.

---SEÇÃO 7: RISCOS JURÍDICOS---
Border-left laranja. Liste os riscos com nível individual (ALTO/MÉDIO/BAIXO) usando badges coloridos inline.

---SEÇÃO 8: ANÁLISE FINANCEIRA COMPLETA---
Border-left roxo (#8e44ad). Calcule todos os custos reais:
- Lance inicial
- ITBI + Registro Cartório (~3,5% a 4% do valor de mercado — varia por município)
- Honorários do leiloeiro (5% do lance, conforme edital)
- Regularização de documentação
- Custo de desocupação/reintegração (se ocupado)
- Reforma/manutenção estimada (baseada no estado aparente)
- Custo financeiro (se financiado, estimar juros)
- TOTAL DO INVESTIMENTO

Gráfico de barras dos custos (o lance = 100% de referência, os custos como % do lance):
<div style="margin:1rem 0;">
  <div style="font-size:0.8rem;font-weight:700;color:#0A2E50;margin-bottom:0.75rem;font-family:Montserrat,sans-serif;">Composição do Investimento Total</div>
  [Para cada custo, uma linha com label + valor + barra proporcional ao % do lance]
  Exemplo de linha:
  <div style="margin-bottom:0.6rem;">
    <div style="display:flex;justify-content:space-between;font-size:0.78rem;margin-bottom:3px;"><span style="color:#555;">[ITEM]</span><span style="font-weight:700;color:#0A2E50;">R$ [VALOR] ([X]%)</span></div>
    <div style="background:#f0f4f8;border-radius:4px;height:14px;overflow:hidden;"><div style="width:[X]%;background:[COR];height:100%;border-radius:4px;"></div></div>
  </div>
  [Lance = #1E6BB8, ITBI = #16a085, Honorários = #f39c12, Documentação = #8e44ad, Desocupação = #e74c3c, Reforma = #e67e22]
  [Total em destaque no final]
</div>

---SEÇÃO 9: PROJEÇÃO DE CENÁRIOS DE RETORNO---
Border-left verde. Tabela com 3 cenários (Pessimista / Realista / Otimista):
- Valor de venda estimado
- Prazo para venda
- Lucro líquido após todos os custos
- ROI sobre o investimento total
- Taxa equivalente ao ano

<table style="width:100%;border-collapse:collapse;font-size:0.8rem;margin:0.75rem 0;border-radius:10px;overflow:hidden;">
  <thead><tr style="background:#0A2E50;color:white;">
    <th style="padding:0.6rem 0.75rem;text-align:left;">Cenário</th>
    <th style="padding:0.6rem 0.75rem;text-align:right;">Venda Est.</th>
    <th style="padding:0.6rem 0.75rem;text-align:right;">Lucro Líq.</th>
    <th style="padding:0.6rem 0.75rem;text-align:right;">ROI</th>
    <th style="padding:0.6rem 0.75rem;text-align:right;">Prazo</th>
  </tr></thead>
  <tbody>
    <tr style="background:#fff8f8;"><td style="padding:0.5rem 0.75rem;"><span style="color:#e74c3c;font-weight:700;">▼ Pessimista</span></td><td>...</td></tr>
    <tr style="background:white;"><td style="padding:0.5rem 0.75rem;"><span style="color:#f39c12;font-weight:700;">→ Realista</span></td><td>...</td></tr>
    <tr style="background:#f0fff4;"><td style="padding:0.5rem 0.75rem;"><span style="color:#27ae60;font-weight:700;">▲ Otimista</span></td><td>...</td></tr>
  </tbody>
</table>

---SEÇÃO 10: CONDIÇÕES DO LEILÃO---
Border-left azul. Modalidade, datas, habilitação, formas de pagamento, comissão do leiloeiro, prazo de desocupação previsto, eventuais débitos do imóvel que vão com ele.

---SEÇÃO 11: MATRIZ DE RISCOS + PARECER FINAL---
Grid 2x2 com os 4 fatores de risco (Jurídico, Financeiro, Mercado, Operacional) — cada um com badge de nível:
<div style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;margin:1rem 0;">
  <div style="padding:0.875rem;border-radius:8px;background:rgba([R],[G],[B],0.07);border:1px solid rgba([R],[G],[B],0.2);">
    <div style="font-size:0.8rem;font-weight:700;color:[COR];margin-bottom:0.4rem;font-family:Montserrat,sans-serif;">[EMOJI] [Categoria]</div>
    <div style="font-size:0.78rem;color:#555;line-height:1.5;">[análise de 2-3 linhas]</div>
    <div style="margin-top:0.5rem;display:inline-block;padding:0.2rem 0.75rem;border-radius:12px;font-size:0.72rem;font-weight:700;color:white;background:[COR_BADGE];">[NÍVEL]</div>
  </div>
</div>

Após a matriz, o Parecer Final:
<div style="background:linear-gradient(135deg,#f8f9fa,#e8f4ff);border-radius:12px;padding:1.5rem;border:1px solid #dee2e6;margin-top:1rem;">
  <h3 style="font-family:Montserrat,sans-serif;color:#0A2E50;margin:0 0 0.75rem;font-size:1rem;">Parecer dos Especialistas</h3>
  <p style="margin:0 0 1rem;font-size:0.875rem;line-height:1.7;color:#333;">[parecer detalhado de 4-5 frases com pontos fortes, pontos de atenção e recomendação geral]</p>
  <div style="display:flex;align-items:center;gap:0.75rem;flex-wrap:wrap;">
    <span style="display:inline-flex;align-items:center;gap:0.4rem;padding:0.4rem 1.25rem;border-radius:20px;font-weight:700;font-size:0.875rem;color:white;background:[COR_RISCO];">Risco Global: [BAIXO|MÉDIO|ALTO]</span>
    <span style="font-size:0.72rem;color:#999;font-style:italic;">Análise elaborada pela equipe de especialistas da Fundamenta Leilões. Esta análise é orientativa e não constitui recomendação de compra ou assessoria jurídica. Consulte sempre um advogado especializado antes de arrematar.</span>
  </div>
</div>

Para o badge de risco global use:
- BAIXO: background #2ECC71
- MÉDIO: background #f39c12
- ALTO: background #e74c3c

Envolva TUDO em: <div style="font-family:'Open Sans',sans-serif;color:#333;line-height:1.7;font-size:0.875rem;">...</div>`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      registrationNumber: string;
      uf: string;
      propertyData?: Record<string, unknown>;
    };
    const { registrationNumber, uf } = body;

    if (!registrationNumber || !uf) {
      return NextResponse.json(
        { error: 'Parâmetros registrationNumber e uf são obrigatórios.' },
        { status: 400 }
      );
    }

    // 1. Check cache
    try {
      const existing = await prisma.propertyAIAnalysis.findUnique({
        where: { registrationNumber },
      });
      if (existing) {
        return NextResponse.json({
          cached: true,
          analysisHtml: existing.analysisHtml,
          riskLevel: existing.riskLevel,
        });
      }
    } catch (dbErr) {
      // DB might not be configured — proceed without cache
      console.warn('DB check failed (proceeding without cache):', dbErr);
    }

    // 2. Validate OpenAI key
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OPENAI_API_KEY não configurada. Adicione ao .env.local para usar esta funcionalidade.' },
        { status: 503 }
      );
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    // 3. Warmup + fetch detail page
    await getWarmup();

    const detailUrl = `https://venda-imoveis.caixa.gov.br/sistema/detalhe-imovel.asp?hdnimovel=${encodeURIComponent(registrationNumber)}`;

    const fetchDetail = async () => {
      const res = await fetch(detailUrl, {
        headers: BROWSER_HEADERS,
        redirect: 'follow',
        signal: AbortSignal.timeout(15_000),
        cache: 'no-store',
      });
      const buffer = await res.arrayBuffer();
      let html = new TextDecoder('utf-8').decode(buffer);
      if (html.includes('\ufffd')) html = new TextDecoder('iso-8859-1').decode(buffer);
      return { html, finalUrl: res.url, size: buffer.byteLength };
    };

    let { html: detailHtml, finalUrl, size } = await fetchDetail();

    if (size < 500 || isCaptchaPage(detailHtml, finalUrl)) {
      warmupPromise = null;
      await getWarmup();
      ({ html: detailHtml, finalUrl, size } = await fetchDetail());
    }

    const detailText = size >= 500 && !isCaptchaPage(detailHtml, finalUrl)
      ? stripHtmlTags(detailHtml).slice(0, 6000)
      : `Imóvel número ${registrationNumber}, estado ${uf}. Dados detalhados não disponíveis no momento.`;

    // 4. Check if matrícula PDF exists (HEAD request — content not needed)
    const matriculaUrl = `https://venda-imoveis.caixa.gov.br/editais/matricula/${uf}/${registrationNumber}.pdf`;
    let matriculaBase64: string | null = null;
    try {
      const pdfRes = await fetch(matriculaUrl, {
        method: 'HEAD',
        headers: { ...BROWSER_HEADERS, Accept: 'application/pdf,*/*' },
        signal: AbortSignal.timeout(8_000),
        cache: 'no-store',
      });
      if (pdfRes.ok) matriculaBase64 = 'available'; // flag only
    } catch {
      // not available
    }

    // 5. Check if edital PDF exists
    let editalBase64: string | null = null;
    try {
      const editalMatch = detailHtml.match(/ExibeDoc\('(\/editais\/[^']+\.PDF)'\)/i);
      if (editalMatch) editalBase64 = 'available'; // flag only — URL found in HTML
    } catch {
      // not available
    }

    // 6. Web search for real market data (best-effort — falls back gracefully)
    const propertyData = body.propertyData as Record<string, unknown> | undefined;
    let marketResearch = '';
    try {
      const cityName  = (propertyData?.city    as string) || uf;
      const propType  = (propertyData?.propertyType as string) || 'imóvel';
      const areaTotal = (propertyData?.areaTotal as number) || (propertyData?.areaPrivate as number) || null;
      const address   = (propertyData?.address  as string) || '';
      const marketVal = propertyData?.marketValue ? Number(propertyData.marketValue) : null;

      const typeLabel: Record<string, string> = {
        APARTMENT: 'apartamento', HOUSE: 'casa', LAND: 'terreno',
        COMMERCIAL: 'imóvel comercial', RURAL: 'imóvel rural',
      };
      const typeStr = typeLabel[propType] || 'imóvel';

      const searchInput = `Pesquise anúncios ATUAIS de venda de ${typeStr}${areaTotal ? ` de aproximadamente ${areaTotal} m²` : ''} em ${address ? address + ', ' : ''}${cityName} - ${uf}, Brasil. Consulte ZAP Imóveis, Viva Real, OLX e similares. Responda em português com: 1) Preço médio por m² praticado na região 2) Faixa de preços encontrada para imóveis similares 3) Cite 2-3 exemplos de anúncios reais com valores 4) Avalie se o valor de avaliação bancária de ${marketVal ? 'R$ ' + marketVal.toLocaleString('pt-BR') : 'não informado'} está acima, abaixo ou condizente com o mercado atual.`;

      const searchResp = await (openai as unknown as Record<string, any>).responses.create({
        model:  'gpt-4o-mini-search-preview',
        tools:  [{ type: 'web_search_preview' }],
        input:  searchInput,
      });
      marketResearch = (searchResp as Record<string, string>).output_text || '';
    } catch (searchErr) {
      console.warn('Web search for market data failed (proceeding without):', searchErr);
    }

    // 8. Build user prompt with all available data
    const userText = `Elabore um laudo completo e profissional para o imóvel de leilão abaixo.

DADOS DO IMÓVEL:
- Número de registro: ${registrationNumber}
- Estado (UF): ${uf}
- Cidade: ${propertyData?.city ?? 'não informado'}
- Bairro/Endereço: ${propertyData?.address ?? 'não informado'}
- Tipo: ${propertyData?.propertyType ?? 'não informado'}
- Área total: ${propertyData?.areaTotal ? `${propertyData.areaTotal} m²` : 'não informado'}
- Área privativa: ${propertyData?.areaPrivate ? `${propertyData.areaPrivate} m²` : 'não informado'}
- Lance inicial: ${propertyData?.initialBid ? `R$ ${Number(propertyData.initialBid).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : 'não informado'}
- Valor de avaliação (mercado): ${propertyData?.marketValue ? `R$ ${Number(propertyData.marketValue).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : 'não informado'}
- Desconto: ${propertyData?.discountPercentage ? `${propertyData.discountPercentage}%` : 'não informado'}
- Modalidade: ${(propertyData?.auction as Record<string, unknown>)?.modalidade ?? 'não informado'}
- Status de ocupação: ${propertyData?.occupationStatus ?? 'não informado'}
- Banco credor: ${propertyData?.sourceBank ?? 'Caixa Econômica Federal'}
- Data do leilão: ${propertyData?.auctionDate ?? 'não informado'}
- Descrição: ${propertyData?.description ?? 'não informado'}

DADOS EXTRAÍDOS DA PÁGINA DA CAIXA ECONÔMICA FEDERAL:
${detailText}

${matriculaBase64 ? 'Matrícula do imóvel: obtida com sucesso. Considere que pode conter ônus, hipotecas e averbações relevantes para análise.' : 'Matrícula: não disponível para download no momento.'}
${editalBase64 ? 'Edital do leilão: obtido com sucesso. Considere condições de venda, débitos, prazo de desocupação e formas de pagamento.' : 'Edital: não disponível para download no momento.'}

PESQUISA DE MERCADO REGIONAL (dados obtidos em tempo real):
${marketResearch
  ? marketResearch
  : 'Pesquisa em tempo real não disponível. Use seu conhecimento atualizado do mercado imobiliário desta região para estimar preços reais de venda.'}

INSTRUÇÃO IMPORTANTE: Na seção de pesquisa comparativa de mercado, use os dados de pesquisa acima (quando disponíveis) para apresentar valores REAIS de mercado da região — não os valores de avaliação bancária. Avalie explicitamente se o valor de mercado informado no edital está correto, superavaliado ou subavaliado em relação ao mercado atual. Cite anúncios reais encontrados, se disponíveis.

Elabore o laudo COMPLETO seguindo exatamente a estrutura HTML especificada, com todas as 11 seções, gráficos e tabelas. Seja específico com todos os números calculados.`;

    // 9. Call OpenAI for full analysis (text-only)
    let analysisHtml = '';
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: ANALYSIS_SYSTEM_PROMPT },
        { role: 'user', content: userText },
      ],
      max_tokens: 8000,
      temperature: 0.3,
    });
    analysisHtml = completion.choices[0]?.message?.content || '';

    if (!analysisHtml) {
      return NextResponse.json({ error: 'A IA não retornou uma análise.' }, { status: 500 });
    }

    // Strip markdown code fences if the model wrapped the HTML
    analysisHtml = analysisHtml
      .replace(/^```html\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();

    // 8. Extract risk level
    const riskLevel = extractRiskLevel(analysisHtml);

    // 9. Save to DB (best-effort)
    try {
      await prisma.propertyAIAnalysis.create({
        data: { registrationNumber, uf, analysisHtml, riskLevel },
      });
    } catch (saveErr) {
      console.warn('Could not save AI analysis to DB:', saveErr);
    }

    return NextResponse.json({ cached: false, analysisHtml, riskLevel });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro desconhecido';
    console.error('analise-imovel error:', err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
