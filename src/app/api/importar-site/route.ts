import { NextRequest, NextResponse } from 'next/server';
import * as cheerio from 'cheerio';
import { Property } from '@/types/property';

// Allow up to 120s for large imports (Vercel Pro / self-hosted)
export const maxDuration = 120;

// ── helpers ──────────────────────────────────────────────────────────────────

function slugToText(slug: string): string {
  return slug
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function parseMoney(text: string): number {
  // "R$ 4.004.178,24" → 4004178.24
  const m = text.match(/R\$\s*([\d.,]+)/);
  if (!m) return 0;
  return parseFloat(m[1].replace(/\./g, '').replace(',', '.')) || 0;
}

function parseArea(text: string): number | undefined {
  // m² e hectares
  const mSqm = text.match(/([\d.,]+)\s*m²/i);
  if (mSqm) return parseFloat(mSqm[1].replace(/\./g, '').replace(',', '.')) || undefined;
  const mHa = text.match(/([\d.,]+)\s*ha\b/i);
  if (mHa) {
    const ha = parseFloat(mHa[1].replace(/\./g, '').replace(',', '.'));
    return ha ? ha * 10000 : undefined; // converte para m²
  }
  return undefined;
}

function parseAuctionDate(text: string): string | undefined {
  // "06/05/2026 às 14:31"
  const m = text.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (!m) return undefined;
  return `${m[3]}-${m[2]}-${m[1]}`; // ISO format
}

function parseAuctionTime(text: string): string | undefined {
  const m = text.match(/às\s+(\d{2}:\d{2})/);
  return m ? m[1] : undefined;
}

function mapPropertyType(raw: string): Property['propertyType'] {
  const r = raw.toLowerCase();
  if (r.includes('apartamento') || r.includes('apto')) return 'APARTMENT';
  if (r.includes('terreno') || r.includes('lote')) return 'LAND';
  if (r.includes('rural') || r.includes('fazenda') || r.includes('sítio') || r.includes('sitio') || r.includes('chácara') || r.includes('chacara') || r.includes('área rural')) return 'RURAL';
  if (r.includes('comercial') || r.includes('industrial') || r.includes('sala') || r.includes('galpão') || r.includes('galpao') || r.includes('loja') || r.includes('escritório')) return 'COMMERCIAL';
  return 'HOUSE';
}

function mapOccupation(texts: string[]): Property['occupationStatus'] {
  const all = texts.join(' ').toLowerCase();
  if (all.includes('desocupado')) return 'VACANT';
  if (all.includes('ocupado')) return 'OCCUPIED';
  return 'UNKNOWN';
}

const COORD_BY_STATE: Record<string, [number, number]> = {
  AC: [-9.0, -70.0], AL: [-9.7, -36.7], AP: [1.4, -51.8], AM: [-3.5, -65.0],
  BA: [-12.5, -41.5], CE: [-5.1, -39.4], DF: [-15.78, -47.93], ES: [-19.5, -40.6],
  GO: [-15.8, -49.8], MA: [-4.9, -45.3], MT: [-12.7, -51.0], MS: [-20.5, -54.8],
  MG: [-18.1, -44.4], PA: [-4.5, -53.0], PB: [-7.2, -36.7], PR: [-24.9, -51.6],
  PE: [-8.3, -37.9], PI: [-7.7, -42.7], RJ: [-22.3, -43.0], RN: [-5.8, -36.5],
  RS: [-29.7, -53.2], RO: [-11.0, -62.8], RR: [2.1, -61.5], SC: [-27.3, -50.2],
  SP: [-22.3, -48.5], SE: [-10.6, -37.5], TO: [-10.2, -48.3],
};

// ── ZUK parser ────────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<Property['propertyType'], string> = {
  APARTMENT: 'Apartamento', LAND: 'Terreno',
  COMMERCIAL: 'Comercial', RURAL: 'Rural', HOUSE: 'Casa',
};

function parseZUK(html: string, sourceUrl: string, campaignId?: string): Property[] {
  const $ = cheerio.load(html);
  const properties: Property[] = [];

  $('div.card-property').each((_, el) => {
    try {
      const $el = $(el);

      // Property link (e.g. /imovel/sp/sao-paulo/bela-vista/avenida-paulista-1374/35626-221907)
      const href = $el.find('a[href*="/imovel/"]').first().attr('href') || '';
      if (!href.includes('/imovel/')) return;

      const imgSrc = $el.find('img').first().attr('src') || '';

      // URL → /imovel/[state]/[city]/[neighborhood]/[address]/[id1-id2]
      const path  = href.replace(/^https?:\/\/[^/]+/, '');
      const parts = path.split('/').filter(Boolean);
      const stateSlug = parts[1] || '';
      const citySlug  = parts[2] || '';
      const neighSlug = parts[3] || '';
      const propId    = parts[5] || parts[4] || String(Date.now());

      const state = stateSlug.toUpperCase();
      const city  = slugToText(citySlug);
      const neighborhood = slugToText(neighSlug);

      // ── Extract fields from known selectors ──────────────────────────────

      // Status badge: "Venda Direta", "Aberto para proposta", "Ocupado", etc.
      const statusRaw = $el.find('.card-property-proposta-open, .card-property-status').text().trim();

      // Property type label: "Comercial / Industrial", "Apartamento", etc.
      const propTypRaw = $el.find('.card-property-price-lote').text().trim();

      // Address spans inside <address class="card-property-address">
      // First span: "São Paulo / SP - Bela Vista"
      // Second span: "Avenida Paulista, 1374"
      let streetLine = '';
      $el.find('.card-property-address span').each((i, s) => {
        const t = $(s).text().trim();
        if (i === 1 && t) streetLine = t; // second span = street
      });

      // Area info from .card-property-infos li items
      let areaTotal: number | undefined;
      let areaPrivate: number | undefined;
      $el.find('.card-property-infos li').each((_, li) => {
        const t = $(li).text().trim();
        const low = t.toLowerCase();
        if (t.includes('m²') || /\d+[.,]\d+\s*ha\b/i.test(t)) {
          const area = parseArea(t);
          if (area) {
            if (low.includes('útil') || low.includes('util') || low.includes('privat')) areaPrivate = area;
            else areaTotal = area;
          }
        }
      });

      // Auction date/time from .card-property-infos or data attributes
      let auctionDate = '';
      let auctionTime: string | undefined;
      $el.find('.card-property-infos li, .card-property-date, .card-date').each((_, li) => {
        const t = $(li).text().trim();
        if (!auctionDate) {
          const d = parseAuctionDate(t);
          if (d) { auctionDate = d; auctionTime = parseAuctionTime(t); }
        }
      });

      // Bid value — capture both min (initialBid) and max (marketValue = 1ª praça)
      let initialBid = 0;
      let maxBid = 0;
      let modalidade = '';
      $el.find('.card-property-price-value, .card-property-price').each((_, priceEl) => {
        const t = $(priceEl).text().trim();
        const bid = parseMoney(t);
        if (bid > 0) {
          if (!initialBid || bid < initialBid) initialBid = bid;
          if (bid > maxBid) maxBid = bid;
        }
        const low = t.toLowerCase();
        if (low.includes('venda direta')) modalidade = 'Venda Direta';
        else if (!modalidade && low.includes('leil')) {
          modalidade = low.includes('2') ? '2º Leilão' : '1º Leilão';
        }
      });

      // Also check pracas (auction rounds) data attribute
      const pracasEl = $el.find('[data-pracas]');
      if (pracasEl.length && !modalidade) {
        const p = pracasEl.attr('data-pracas') || '1';
        modalidade = p === '2' ? '2º Leilão' : '1º Leilão';
      }

      // Status / occupation
      const statusTexts: string[] = [];
      if (statusRaw) statusTexts.push(statusRaw.toLowerCase());
      if (!modalidade && statusRaw.toLowerCase().includes('venda direta')) modalidade = 'Venda Direta';

      // Property type
      const propertyType = propTypRaw ? mapPropertyType(propTypRaw) : 'HOUSE';

      // Address
      const address = streetLine || (neighSlug ? slugToText(neighSlug) : city);
      const fullAddress = [address, neighborhood].filter(Boolean).join(', ');

      // Market value: use highest price if 2 rounds exist, else estimate
      const marketValue = maxBid > initialBid ? maxBid : (initialBid > 0 ? Math.round(initialBid / 0.72) : 0);
      const discount    = marketValue > 0 ? Math.round(((marketValue - initialBid) / marketValue) * 100) : 0;
      const [lat, lng]  = COORD_BY_STATE[state] || [-15.78, -47.93];

      // Bank from listing URL (e.g. /v/banco-santander/)
      const bankMatch = sourceUrl.match(/\/v\/([^/?]+)/);
      const sourceBank = bankMatch
        ? bankMatch[1].split('-').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
        : undefined;

      const id = `zuk-${propId.replace(/[^a-z0-9]/gi, '-')}`;

      properties.push({
        id,
        title: `${TYPE_LABELS[propertyType]} — ${city} / ${state}${neighborhood ? ' - ' + neighborhood : ''}`,
        address: fullAddress,
        city,
        state,
        latitude: lat,
        longitude: lng,
        mainImage: imgSrc || undefined,
        marketValue,
        initialBid,
        discountPercentage: discount,
        auctionDate: auctionDate || new Date().toISOString().split('T')[0],
        auctionTime,
        occupationStatus: mapOccupation(statusTexts),
        propertyType,
        sourceAuctioneer: 'Zuk Leilões',
        sourceBank,
        areaTotal,
        areaPrivate,
        active: true,
        campaignId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        auction: {
          id: `zuk-auction-${propId}`,
          auctioneerName: 'Zuk Leilões',
          auctioneerWebsite: 'https://www.portalzuk.com.br',
          auctionWebsiteUrl: href,
          modalidade: modalidade || undefined,
          auctionNumber: propId,
        },
      });
    } catch {
      // silently skip malformed cards
    }
  });

  return properties;
}

// ── ZUK paginator ─────────────────────────────────────────────────────────────
// ZUK loads 30 cards server-side and the rest via POST /leilao-de-imoveis/mais.
// We replicate the "Carregar mais" AJAX call until no new cards arrive.

async function fetchAllZUK(
  initialHtml: string,
  parsedUrl: URL,
  initialRes: Response,
  campaignId?: string,
): Promise<Property[]> {
  const $ = cheerio.load(initialHtml);

  // CSRF token from hidden input (Laravel ties it to the session)
  const token = $('input[name="_token"]').first().val() as string || '';

  // Try to find the `y` path variable from inline JS  (e.g. var y="/leilao-de-imoveis/";)
  const pathMatch = initialHtml.match(/var\s+y\s*=\s*["']([^"']+)["']/);
  const path = pathMatch ? pathMatch[1] : parsedUrl.pathname;

  const order = parsedUrl.searchParams.get('order') || '';

  // Collect ALL Set-Cookie headers properly (Node fetch may expose getSetCookie())
  const rawHeaders = initialRes.headers as Headers & { getSetCookie?: () => string[] };
  const setCookies: string[] = typeof rawHeaders.getSetCookie === 'function'
    ? rawHeaders.getSetCookie()
    : (initialRes.headers.get('set-cookie') || '').split(/,(?=\s*\w+=)/);

  // Build Cookie header: take only the name=value part of each cookie
  const cookieHeader = setCookies
    .map((c) => c.split(';')[0].trim())
    .filter(Boolean)
    .join('; ');

  let combinedHtml = initialHtml;
  let currentCount = $('div.card-property').length;

  const baseUrl = `${parsedUrl.protocol}//${parsedUrl.hostname}`;
  const FETCH_HEADERS: Record<string, string> = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': '*/*',
    'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
    'Referer': parsedUrl.href,
    'Origin': `${parsedUrl.protocol}//${parsedUrl.hostname}`,
    'X-Requested-With': 'XMLHttpRequest',
    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
  };
  if (cookieHeader) FETCH_HEADERS['Cookie'] = cookieHeader;

  // Paginate: keep posting until no new cards arrive (max 60 rounds ≈ 1 800 cards)
  for (let round = 0; round < 60; round++) {
    const body = new URLSearchParams({
      limit: String(currentCount),
      count_imovel_zuk: String(currentCount),
      path,
      order,
      'bounds[]': '',       // jQuery serialises empty array as bounds[]=
      div_parceiro_count: '0',
      _token: token,
    });

    let moreHtml: string;
    let moreStatus = 0;
    try {
      const moreRes = await fetch(`${baseUrl}/leilao-de-imoveis/mais`, {
        method: 'POST',
        headers: FETCH_HEADERS,
        body: body.toString(),
        signal: AbortSignal.timeout(20_000),
      });
      moreStatus = moreRes.status;
      if (!moreRes.ok) {
        console.error(`[ZUK] round ${round}: POST returned ${moreStatus}`);
        break;
      }
      moreHtml = await moreRes.text();
    } catch (e) {
      console.error(`[ZUK] round ${round}: fetch error`, e);
      break;
    }

    const $more = cheerio.load(moreHtml);
    const newCards = $more('div.card-property').length;
    console.log(`[ZUK] round ${round}: status=${moreStatus} newCards=${newCards} total=${currentCount + newCards} snippet=${moreHtml.slice(0, 120)}`);

    if (newCards === 0) break;

    combinedHtml += moreHtml;
    currentCount += newCards;
  }

  return parseZUK(combinedHtml, parsedUrl.href, campaignId);
}

// ── ZUK bulk importer ─────────────────────────────────────────────────────────
// Discovers all bank/comitente sub-pages and fetches each one.
// For banks with ≥ 30 properties (can't AJAX-paginate), expands coverage by
// combining type-filters and sort orders within the same bank page.

const SORT_ORDERS = ['menor_valor', 'maior_desconto', 'lancamento', 'data_leilao'];
const TYPE_FILTERS = [
  '/tl/todos-imoveis/desocupados',
  '/tl/todos-imoveis/leilao-extra-judicial',
  '/tl/todos-imoveis/alienacao-fiduciaria',
  '/tl/proximos-leiloes',
  '/tl/todos-imoveis/leilao-judicial',
];

async function fetchZUKPage(url: string, campaignId?: string): Promise<Property[]> {
  const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, 'Accept': 'text/html', 'Accept-Language': 'pt-BR,pt;q=0.9', 'Cache-Control': 'no-cache' },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return [];
    const html = await res.text();
    return parseZUK(html, url, campaignId);
  } catch {
    return [];
  }
}

async function bulkImportZUK(mainHtml: string, baseUrl: string, campaignId?: string): Promise<Property[]> {
  const $main = cheerio.load(mainHtml);
  const origin = new URL(baseUrl).origin;

  // ── Phase 1: Fetch all bank base URLs concurrently ───────────────────────
  const bankBaseUrls: string[] = [];
  $main('a[href*="/leilao-de-imoveis/v/"]').each((_, el) => {
    const href = $main(el).attr('href') || '';
    if (href.includes('/v/')) {
      const clean = href.replace(/\/$/, '');
      if (!bankBaseUrls.includes(clean)) bankBaseUrls.push(clean);
    }
  });

  console.log(`[ZUK bulk] Phase 1: fetching ${bankBaseUrls.length} bank pages...`);
  const allProperties = new Map<string, Property>();

  // Also always fetch main page type-filter combos
  const alwaysUrls: string[] = [
    `${origin}/leilao-de-imoveis`,
    ...TYPE_FILTERS.map(t => `${origin}/leilao-de-imoveis${t}`),
    ...SORT_ORDERS.map(o => `${origin}/leilao-de-imoveis?order=${o}`),
  ];

  const phase1Urls = [...bankBaseUrls, ...alwaysUrls];
  const BATCH = 8;

  // Map: bankUrl → count returned in phase 1 (to detect large banks)
  const phase1Counts = new Map<string, number>();

  for (let i = 0; i < phase1Urls.length; i += BATCH) {
    const batch = phase1Urls.slice(i, i + BATCH);
    const results = await Promise.all(batch.map(async (u) => {
      const props = await fetchZUKPage(u, campaignId);
      phase1Counts.set(u, props.length);
      return props;
    }));
    results.flat().forEach(p => { if (!allProperties.has(p.id)) allProperties.set(p.id, p); });
  }
  console.log(`[ZUK bulk] Phase 1 done: ${allProperties.size} unique from ${phase1Urls.length} pages`);

  // ── Phase 2: Expand coverage for large banks (returned exactly 30 cards) ─
  // Cap at 12 to keep total time under 90s in the worst case
  const largeBankUrls = bankBaseUrls
    .filter(u => (phase1Counts.get(u) ?? 0) >= 30)
    .slice(0, 12);
  console.log(`[ZUK bulk] Phase 2: expanding ${largeBankUrls.length} large banks...`);

  const phase2Urls: string[] = [];
  for (const bankUrl of largeBankUrls) {
    // Sort orders on base bank URL
    SORT_ORDERS.forEach(o => phase2Urls.push(`${bankUrl}?order=${o}`));
    // Type filters on bank URL
    TYPE_FILTERS.forEach(t => phase2Urls.push(`${bankUrl}${t}`));
    // Nested: type-filter + sort-order (key for deep coverage)
    TYPE_FILTERS.forEach(t => SORT_ORDERS.forEach(o => phase2Urls.push(`${bankUrl}${t}?order=${o}`)));
  }
  // Expand type-filter pages that returned 30 (have more hidden)
  const largTypeUrls = TYPE_FILTERS
    .map(t => `${origin}/leilao-de-imoveis${t}`)
    .filter(u => (phase1Counts.get(u) ?? 0) >= 30);
  largTypeUrls.forEach(u => SORT_ORDERS.forEach(o => phase2Urls.push(`${u}?order=${o}`)));

  for (let i = 0; i < phase2Urls.length; i += BATCH) {
    const batch = phase2Urls.slice(i, i + BATCH);
    const results = await Promise.all(batch.map(u => fetchZUKPage(u, campaignId)));
    results.flat().forEach(p => { if (!allProperties.has(p.id)) allProperties.set(p.id, p); });
  }

  console.log(`[ZUK bulk] Complete: ${allProperties.size} unique properties from ${phase1Urls.length + phase2Urls.length} total URLs`);
  return Array.from(allProperties.values());
}

// ── route handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const { url, campaignId } = await req.json();
    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'URL inválida' }, { status: 400 });
    }

    const parsed = new URL(url);
    const host   = parsed.hostname.toLowerCase();

    // Fetch the page HTML
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
        'Cache-Control': 'no-cache',
      },
      signal: AbortSignal.timeout(20_000),
    });

    if (!res.ok) {
      return NextResponse.json({ error: `Site retornou erro ${res.status}` }, { status: 502 });
    }

    const html = await res.text();
    let properties: Property[] = [];

    if (host.includes('portalzuk.com.br') || host.includes('zuk')) {
      // Bulk mode: main listing page (no /v/ or /tl/ sub-path)
      const isBulk = !parsed.pathname.includes('/v/') && !parsed.pathname.includes('/tl/');
      if (isBulk) {
        properties = await bulkImportZUK(html, url, campaignId);
      } else {
        properties = await fetchAllZUK(html, parsed, res, campaignId);
      }
    } else {
      return NextResponse.json(
        { error: 'Site não suportado. Suporte atual: portalzuk.com.br' },
        { status: 400 }
      );
    }

    if (properties.length === 0) {
      return NextResponse.json(
        { error: 'Nenhum imóvel encontrado na página. Verifique se a URL está correta.' },
        { status: 404 }
      );
    }

    return NextResponse.json({ properties, count: properties.length });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro desconhecido';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
