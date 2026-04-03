import { NextRequest, NextResponse } from 'next/server';
import * as cheerio from 'cheerio';
import { Property } from '@/types/property';

export const maxDuration = 120;

const BASE = 'https://www.leiloesjudiciaisbrasil.com.br';

// Subcategories with known property types
const SUBCATEGORIES: { path: string; type: Property['propertyType'] }[] = [
  { path: '/imoveis/casas',              type: 'HOUSE'       },
  { path: '/imoveis/apartamentos',       type: 'APARTMENT'   },
  { path: '/imoveis/terrenos-e-lotes',   type: 'LAND'        },
  { path: '/imoveis/fazendas',           type: 'RURAL'       },
  { path: '/imoveis/sitios',             type: 'RURAL'       },
  { path: '/imoveis/imoveis-comerciais', type: 'COMMERCIAL'  },
  { path: '/imoveis/imoveis-industriais',type: 'COMMERCIAL'  },
];

// ── helpers ──────────────────────────────────────────────────────────────────

function parseMoney(text: string): number {
  const m = text.match(/R\$\s*[\d.,]+/);
  if (!m) return 0;
  return parseFloat(m[0].replace('R$', '').trim().replace(/\./g, '').replace(',', '.')) || 0;
}

function parseDate(text: string): string | undefined {
  const m = text.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (!m) return undefined;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

function parseTime(text: string): string | undefined {
  const m = text.match(/às\s+(\d{2}:\d{2})/);
  return m ? m[1] : undefined;
}

function parseCityState(title: string): { city: string; state: string } {
  // "LEILÃO DA JUSTIÇA DO TRABALHO DE SÃO SEBASTIÃO DO PARAÍSO/MG"
  // "LEILÃO DA JUSTIÇA ESTADUAL DE NOVA BRASILÂNDIA D' OESTE/RO - VARA ÚNICA"
  const m = title.match(/\bDE\s+([A-ZÁÉÍÓÚÂÊÎÔÛÃÕÀÇÑ\s\d'D]+)\/([A-Z]{2})\b/i);
  if (m) {
    const raw = m[1].trim();
    const city = raw
      .split(' ')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ');
    return { city, state: m[2].toUpperCase() };
  }
  if (/distrito federal/i.test(title)) return { city: 'Brasília', state: 'DF' };
  return { city: 'Não informado', state: 'BR' };
}

function mapTypeFromTitle(title: string): Property['propertyType'] {
  const t = title.toLowerCase();
  if (t.includes('apartamento') || t.includes('apart.')) return 'APARTMENT';
  if (t.includes('terreno') || t.includes('lote')) return 'LAND';
  if (t.includes('fazenda') || t.includes('sítio') || t.includes('sitio') || t.includes('chácara') || t.includes('rural')) return 'RURAL';
  if (t.includes('sala') || t.includes('comercial') || t.includes('galpão') || t.includes('industrial') || t.includes('loja')) return 'COMMERCIAL';
  return 'HOUSE';
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

// ── parser ────────────────────────────────────────────────────────────────────

function parseLJBHtml(
  html: string,
  forcedType: Property['propertyType'] | null,
  campaignId?: string,
): Property[] {
  const $ = cheerio.load(html);
  const properties: Property[] = [];

  $('div.card-leilao').each((_, el) => {
    try {
      const $el = $(el);

      // Link → /lote/AUCTION_ID/LOTE_ID
      const href = $el.find('a[href*="/lote/"]').first().attr('href') || '';
      if (!href) return;
      const fullUrl = `${BASE}${href}`;
      const ids = href.replace('/lote/', '').split('/');
      const auctionId = ids[0] || '';
      const loteId    = ids[1] || '';

      // Skip multi-lot without price
      const valorText = $el.find('span.valor-inicial-preco').text().trim();
      if (!valorText || valorText.toLowerCase().includes('vide')) return;

      // Image
      const imgSrc = $el.find('img.imagem-capa').attr('src') || undefined;

      // Title
      const title = $el.find('h3.cidade-leilao').text().trim();
      if (!title) return;

      // Status
      const statusText = $el.find('div.status-leilao').text().trim();
      const active = !statusText.toLowerCase().includes('cancelado') &&
                     !statusText.toLowerCase().includes('encerrado');

      // Number of lots
      const lotsCount = parseInt($el.find('div.tag-num').first().text().trim()) || 1;

      // Prices
      const initialBid  = parseMoney(valorText);
      const avaliacaoText = $el.find('div.base-avaliacao').text().trim();
      const marketValue = parseMoney(avaliacaoText) || initialBid;
      if (initialBid === 0) return;

      const discount = marketValue > initialBid
        ? Math.round(((marketValue - initialBid) / marketValue) * 100)
        : 0;

      // Dates — prefer 2ª praça (active one), fallback to 1ª
      const dateDivs = $el.find('div.data-leilao').map((_, d) => $(d).text().trim()).get();
      const activeDate = dateDivs[1] || dateDivs[0] || '';
      const auctionDate = parseDate(activeDate) || new Date().toISOString().split('T')[0];
      const auctionTime = parseTime(activeDate);
      const modalidade  = dateDivs[1]
        ? (activeDate.includes('2º') ? '2ª Praça' : '2ª Praça')
        : '1ª Praça';

      // Location
      const { city, state } = parseCityState(title);
      const [lat, lng] = COORD_BY_STATE[state] || [-15.78, -47.93];

      // Type
      const propertyType = forcedType ?? mapTypeFromTitle(title);

      const id = `ljb-${auctionId}-${loteId}`;

      properties.push({
        id,
        title: `${title
          .split(' ')
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
          .join(' ')}`,
        address: city,
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
        sourceAuctioneer: 'Leilões Judiciais Brasil',
        active,
        campaignId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        auction: {
          id: `ljb-auction-${auctionId}`,
          auctioneerName: 'Leilões Judiciais Brasil',
          auctioneerWebsite: BASE,
          auctionWebsiteUrl: fullUrl,
          modalidade,
          auctionNumber: `${auctionId}/${loteId}`,
        },
      });

      void lotsCount; // available if needed later
    } catch { /* skip malformed */ }
  });

  return properties;
}

// ── fetcher ───────────────────────────────────────────────────────────────────

async function fetchPage(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'pt-BR,pt;q=0.9',
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

// ── bulk importer ─────────────────────────────────────────────────────────────
// LJB note: all subcategory paths (/imoveis/casas, /imoveis/apartamentos, etc.)
// return identical content. We scrape a single path page-by-page with dedup,
// stopping after MAX_EMPTY consecutive pages that yield no new properties.

async function bulkImportLJB(inputUrl: string, campaignId?: string): Promise<Property[]> {
  const parsed = new URL(inputUrl);
  const pathLower = parsed.pathname.toLowerCase();

  // Determine base path and forced type (if user gave a specific subcategory URL)
  const sub = SUBCATEGORIES.find((s) => pathLower.startsWith(s.path));
  const basePath = sub ? sub.path : '/imoveis';
  const forcedType = sub ? sub.type : null;

  const all: Property[] = [];
  const seen = new Set<string>();
  const MAX_EMPTY = 3; // stop after this many consecutive pages with no new items
  const MAX_PAGES = 150;

  let page = 0;
  let consecutiveEmpty = 0;

  while (page <= MAX_PAGES && consecutiveEmpty < MAX_EMPTY) {
    const html = await fetchPage(`${BASE}${basePath}?pagina=${page}`);
    const props = parseLJBHtml(html, forcedType, campaignId);

    let newCount = 0;
    for (const p of props) {
      if (!seen.has(p.id)) {
        seen.add(p.id);
        all.push(p);
        newCount++;
      }
    }

    if (newCount === 0) {
      consecutiveEmpty++;
    } else {
      consecutiveEmpty = 0;
    }

    console.log(`[LJB] page ${page}: +${newCount} new / ${props.length} parsed (total unique: ${all.length})`);
    page++;

    if (page > 1) await new Promise((r) => setTimeout(r, 300));
  }

  console.log(`[LJB] done — ${all.length} unique properties across ${page} pages`);
  return all;
}

// ── route handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const { url, campaignId } = await req.json();
    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'URL inválida' }, { status: 400 });
    }

    const host = new URL(url).hostname.toLowerCase();
    if (!host.includes('leiloesjudiciaisbrasil.com.br')) {
      return NextResponse.json({ error: 'Este endpoint suporta apenas leiloesjudiciaisbrasil.com.br' }, { status: 400 });
    }

    const properties = await bulkImportLJB(url, campaignId);

    if (properties.length === 0) {
      return NextResponse.json({ error: 'Nenhum imóvel encontrado.' }, { status: 404 });
    }

    return NextResponse.json({ properties, count: properties.length });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro desconhecido';
    console.error('[LJB route] error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
