import { NextRequest, NextResponse } from 'next/server';
import * as cheerio from 'cheerio';
import { Property } from '@/types/property';

export const maxDuration = 120;

// ── helpers ──────────────────────────────────────────────────────────────────

function parseMoney(text: string): number {
  const m = text.match(/R\$\s*[\d.,]+/);
  if (!m) return 0;
  return parseFloat(m[0].replace('R$', '').trim().replace(/\./g, '').replace(',', '.')) || 0;
}

function parseAreaFromTitle(title: string): { areaTotal?: number; areaPrivate?: number } {
  const vals: number[] = [];
  for (const m of title.matchAll(/([\d.,]+)\s*m²/gi)) {
    const v = parseFloat(m[1].replace(/\./g, '').replace(',', '.'));
    if (v) vals.push(v);
  }
  const haMatch = title.match(/([\d.,]+)\s*ha\b/i);
  if (haMatch) {
    const ha = parseFloat(haMatch[1].replace(/\./g, '').replace(',', '.'));
    if (ha) vals.push(ha * 10000);
  }
  if (vals.length === 0) return {};
  if (vals.length === 1) return { areaTotal: vals[0] };
  return { areaTotal: Math.max(...vals), areaPrivate: Math.min(...vals) };
}

function parseBankFromIcon(iconUrl: string): string | undefined {
  const m = iconUrl.match(/bank_icons\/leilao-([^.]+)\.png/);
  if (!m || m[1] === 'megaleiloes') return undefined;
  return m[1].split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function parseMegaAddress(title: string, city: string): string {
  // Title: "Casa 70 m² - Bairro - Cidade - SP"
  // Remove state suffix, then city, get last segment as neighborhood
  const clean = title
    .replace(/\s*-\s*[A-Z]{2}\s*$/, '')
    .replace(new RegExp(`\\s*-\\s*${city.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'i'), '')
    .trim();
  const parts = clean.split(/\s*-\s*/);
  const neighborhood = parts[parts.length - 1]?.trim();
  return neighborhood && neighborhood.length > 2 ? `${neighborhood}, ${city}` : city;
}

function parseAuctionDate(text: string): string | undefined {
  const m = text.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (!m) return undefined;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

function parseAuctionTime(text: string): string | undefined {
  const m = text.match(/às\s+(\d{2}:\d{2})/);
  return m ? m[1] : undefined;
}

function slugToText(slug: string): string {
  return slug.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function mapMegaType(typeSlug: string): Property['propertyType'] {
  switch (typeSlug) {
    case 'apartamentos': return 'APARTMENT';
    case 'terrenos-e-lotes':
    case 'terrenos':
    case 'lotes': return 'LAND';
    case 'areas-rurais':
    case 'fazendas':
    case 'sitios':
    case 'chacaras': return 'RURAL';
    case 'comerciais':
    case 'salas-comerciais':
    case 'galpoes':
    case 'lojas': return 'COMMERCIAL';
    default: return 'HOUSE';
  }
}

const TYPE_LABELS: Record<Property['propertyType'], string> = {
  APARTMENT: 'Apartamento', LAND: 'Terreno', COMMERCIAL: 'Comercial', RURAL: 'Rural', HOUSE: 'Casa',
};

const COORD_BY_STATE: Record<string, [number, number]> = {
  AC: [-9.0, -70.0], AL: [-9.7, -36.7], AP: [1.4, -51.8], AM: [-3.5, -65.0],
  BA: [-12.5, -41.5], CE: [-5.1, -39.4], DF: [-15.78, -47.93], ES: [-19.5, -40.6],
  GO: [-15.8, -49.8], MA: [-4.9, -45.3], MT: [-12.7, -51.0], MS: [-20.5, -54.8],
  MG: [-18.1, -44.4], PA: [-4.5, -53.0], PB: [-7.2, -36.7], PR: [-24.9, -51.6],
  PE: [-8.3, -37.9], PI: [-7.7, -42.7], RJ: [-22.3, -43.0], RN: [-5.8, -36.5],
  RS: [-29.7, -53.2], RO: [-11.0, -62.8], RR: [2.1, -61.5], SC: [-27.3, -50.2],
  SP: [-22.3, -48.5], SE: [-10.6, -37.5], TO: [-10.2, -48.3],
};

// ── parser ───────────────────────────────────────────────────────────────────

function parseMegaHtml(html: string, campaignId?: string): Property[] {
  const $ = cheerio.load(html);
  const properties: Property[] = [];

  $('div.card').each((_, el) => {
    try {
      const $el = $(el);

      // URL (strip UTM params)
      const rawHref =
        $el.find('a.card-image').attr('href') ||
        $el.find('a.card-title').attr('href') || '';
      const href = rawHref.split('?')[0];
      if (!href.includes('/imoveis/')) return;

      // Image
      const imgSrc = $el.find('a.card-image').attr('data-bg') || undefined;

      // Parse URL segments: /imoveis/[type]/[state]/[city]/[slug]
      const parts = href.replace(/^https?:\/\/[^/]+/, '').split('/').filter(Boolean);
      const typeSlug  = parts[1] || '';
      const stateSlug = parts[2] || '';
      const citySlug  = parts[3] || '';
      const slug      = parts[4] || '';

      // Lot ID (e.g. J119928 or X234567)
      const lotId = $el.find('.card-number').text().trim() ||
                    slug.match(/[jxJX]\d+$/i)?.[0] || String(Date.now());
      const propId = lotId.replace(/[^a-z0-9]/gi, '');

      // Location
      const locationTitle = $el.find('a.card-locality').attr('title') ||
                            $el.find('a.card-locality').text().trim();
      const [cityRaw, stateRaw] = locationTitle.split(',').map((s) => s.trim());
      const state = (stateRaw || stateSlug).toUpperCase();
      const city  = cityRaw || slugToText(citySlug);

      // Title
      const title = $el.find('a.card-title').text().trim() ||
                    `${TYPE_LABELS[mapMegaType(typeSlug)]} — ${city} / ${state}`;

      // Prices: 1ª praça = market value, 2ª praça = initial bid
      const instanceValues = $el.find('span.card-instance-value')
        .map((_, v) => parseMoney($(v).text())).get() as number[];
      const cardPrice = parseMoney($el.find('.card-price').text());

      const marketValue = instanceValues[0] || cardPrice;
      const initialBid  = instanceValues[1] || instanceValues[0] || cardPrice;

      // Dates — prefer 2ª praça (active), fallback 1ª
      const firstDateText  = $el.find('span.card-first-instance-date').text().trim();
      const secondDateText = $el.find('span.card-second-instance-date').text().trim();
      const activeDateText = secondDateText || firstDateText;

      const auctionDate = parseAuctionDate(activeDateText) ||
                          new Date().toISOString().split('T')[0];
      const auctionTime = parseAuctionTime(activeDateText);

      // Discount
      const discountRaw = parseInt($el.find('.card-down .value').text()) || 0;
      const discount = discountRaw ||
        (marketValue > 0 ? Math.round(((marketValue - initialBid) / marketValue) * 100) : 0);

      // Modalidade
      const hasTwoPracas = secondDateText.length > 0;
      const auctionTypeText = $el.find('.card-instance-title > a').first().text().trim();
      const modalidade = hasTwoPracas ? '2ª Praça' : '1ª Praça';

      // Bank
      const bankIconUrl = $el.find('.card-bank img').attr('src') || '';
      const sourceBank = parseBankFromIcon(bankIconUrl);

      // Area from title
      const { areaTotal, areaPrivate } = parseAreaFromTitle(title);

      // Address (neighborhood from title)
      const address = parseMegaAddress(title, city);

      const propertyType = mapMegaType(typeSlug);
      const [lat, lng]   = COORD_BY_STATE[state] || [-15.78, -47.93];
      const id = `mega-${propId.toLowerCase()}`;

      properties.push({
        id,
        title,
        address,
        city,
        state,
        latitude: lat,
        longitude: lng,
        mainImage: imgSrc,
        marketValue,
        initialBid,
        discountPercentage: discount,
        auctionDate,
        auctionTime,
        occupationStatus: 'UNKNOWN',
        propertyType,
        sourceAuctioneer: 'Mega Leilões',
        sourceBank,
        areaTotal,
        areaPrivate,
        active: true,
        campaignId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        auction: {
          id: `mega-auction-${propId}`,
          auctioneerName: 'Mega Leilões',
          auctioneerWebsite: 'https://www.megaleiloes.com.br',
          auctionWebsiteUrl: href,
          modalidade: auctionTypeText ? `${modalidade} (${auctionTypeText})` : modalidade,
          auctionNumber: lotId,
        },
      });
    } catch { /* skip malformed */ }
  });

  return properties;
}

// ── fetcher ───────────────────────────────────────────────────────────────────

async function fetchPage(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'pt-BR,pt;q=0.9',
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

// ── bulk importer ─────────────────────────────────────────────────────────────

async function bulkImportMega(baseUrl: string, campaignId?: string): Promise<Property[]> {
  // Strip query params to get clean base URL
  const cleanBase = baseUrl.split('?')[0];

  // Fetch page 1 to determine total pages
  const firstHtml = await fetchPage(`${cleanBase}?pagina=1`);
  const pageNums = [...firstHtml.matchAll(/pagina=(\d+)/g)].map((m) => parseInt(m[1]));
  const totalPages = pageNums.length > 0 ? Math.max(...pageNums) : 1;

  console.log(`[Mega] Total pages: ${totalPages}`);

  const allProps: Property[] = [];
  allProps.push(...parseMegaHtml(firstHtml, campaignId));

  // Fetch remaining pages in batches of 8
  const BATCH = 8;
  for (let i = 2; i <= totalPages; i += BATCH) {
    const pageNrs = Array.from({ length: Math.min(BATCH, totalPages - i + 1) }, (_, k) => i + k);
    const htmlPages = await Promise.all(pageNrs.map((p) => fetchPage(`${cleanBase}?pagina=${p}`)));
    htmlPages.forEach((html) => allProps.push(...parseMegaHtml(html, campaignId)));
    console.log(`[Mega] Pages ${pageNrs[0]}-${pageNrs[pageNrs.length - 1]} / ${totalPages} — ${allProps.length} props so far`);
    await new Promise((r) => setTimeout(r, 300));
  }

  return allProps;
}

// ── route handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const { url, campaignId } = await req.json();
    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'URL inválida' }, { status: 400 });
    }

    const host = new URL(url).hostname.toLowerCase();
    if (!host.includes('megaleiloes.com.br')) {
      return NextResponse.json({ error: 'Este endpoint suporta apenas megaleiloes.com.br' }, { status: 400 });
    }

    const properties = await bulkImportMega(url, campaignId);

    if (properties.length === 0) {
      return NextResponse.json({ error: 'Nenhum imóvel encontrado.' }, { status: 404 });
    }

    return NextResponse.json({ properties, count: properties.length });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro desconhecido';
    console.error('[Mega route] error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
