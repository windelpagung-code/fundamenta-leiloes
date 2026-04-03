import { NextRequest, NextResponse } from 'next/server';
import * as cheerio from 'cheerio';
import { Property } from '@/types/property';

// Tell TypeScript about globals available inside page.evaluate()
declare global {
  interface Window {
    jQuery: ((selector: string) => { trigger: (event: string) => void });
    countLotes: string;
    arr_bounds: unknown[];
    _clo: unknown;
  }
}

export const maxDuration = 120;

// ── helpers (same as importar-site) ──────────────────────────────────────────

function slugToText(slug: string): string {
  return slug.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function parseMoney(text: string): number {
  const m = text.match(/R\$\s*[\d.,]+/);
  if (!m) return 0;
  return parseFloat(m[0].replace('R$', '').trim().replace(/\./g, '').replace(',', '.')) || 0;
}

function parseArea(text: string): number | undefined {
  const mSqm = text.match(/([\d.,]+)\s*m²/i);
  if (mSqm) return parseFloat(mSqm[1].replace(/\./g, '').replace(',', '.')) || undefined;
  const mHa = text.match(/([\d.,]+)\s*ha\b/i);
  if (mHa) { const ha = parseFloat(mHa[1].replace(/\./g, '').replace(',', '.')); return ha ? ha * 10000 : undefined; }
  return undefined;
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

function mapPropertyType(raw: string): Property['propertyType'] {
  const r = raw.toLowerCase();
  if (r.includes('apartamento') || r.includes('apto')) return 'APARTMENT';
  if (r.includes('terreno') || r.includes('lote')) return 'LAND';
  if (r.includes('rural') || r.includes('fazenda') || r.includes('sítio') || r.includes('sitio') || r.includes('chácara') || r.includes('área rural')) return 'RURAL';
  if (r.includes('comercial') || r.includes('industrial') || r.includes('sala') || r.includes('galpão') || r.includes('loja') || r.includes('escritório')) return 'COMMERCIAL';
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

const TYPE_LABELS: Record<Property['propertyType'], string> = {
  APARTMENT: 'Apartamento', LAND: 'Terreno', COMMERCIAL: 'Comercial', RURAL: 'Rural', HOUSE: 'Casa',
};

function parseZUKHtml(html: string, sourceUrl: string, campaignId?: string): Property[] {
  const $ = cheerio.load(html);
  const properties: Property[] = [];

  $('div.card-property').each((_, el) => {
    try {
      const $el = $(el);
      const href = $el.find('a[href*="/imovel/"]').first().attr('href') || '';
      if (!href.includes('/imovel/')) return;

      const imgSrc = $el.find('img').first().attr('src') || '';
      const path = href.replace(/^https?:\/\/[^/]+/, '');
      const parts = path.split('/').filter(Boolean);
      const stateSlug = parts[1] || '';
      const citySlug  = parts[2] || '';
      const neighSlug = parts[3] || '';
      const propId    = parts[5] || parts[4] || String(Date.now());

      const state = stateSlug.toUpperCase();
      const city  = slugToText(citySlug);
      const neighborhood = slugToText(neighSlug);

      const statusRaw  = $el.find('.card-property-proposta-open, .card-property-status').text().trim();
      const propTypRaw = $el.find('.card-property-price-lote').text().trim();

      let streetLine = '';
      $el.find('.card-property-address span').each((i, s) => {
        if (i === 1 && $(s).text().trim()) streetLine = $(s).text().trim();
      });

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

      let auctionDate = '';
      let auctionTime: string | undefined;
      $el.find('.card-property-infos li').each((_, li) => {
        const t = $(li).text().trim();
        if (!auctionDate) {
          const d = parseAuctionDate(t);
          if (d) { auctionDate = d; auctionTime = parseAuctionTime(t); }
        }
      });

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
        else if (!modalidade && low.includes('leil')) modalidade = low.includes('2') ? '2º Leilão' : '1º Leilão';
      });

      const pracasEl = $el.find('[data-pracas]');
      if (pracasEl.length && !modalidade) {
        modalidade = (pracasEl.attr('data-pracas') || '1') === '2' ? '2º Leilão' : '1º Leilão';
      }

      const statusTexts: string[] = [];
      if (statusRaw) statusTexts.push(statusRaw.toLowerCase());
      if (!modalidade && statusRaw.toLowerCase().includes('venda direta')) modalidade = 'Venda Direta';

      const propertyType = propTypRaw ? mapPropertyType(propTypRaw) : 'HOUSE';
      const address = streetLine || (neighSlug ? slugToText(neighSlug) : city);
      const fullAddress = [address, neighborhood].filter(Boolean).join(', ');

      const marketValue = maxBid > initialBid ? maxBid : (initialBid > 0 ? Math.round(initialBid / 0.72) : 0);
      const discount    = marketValue > 0 ? Math.round(((marketValue - initialBid) / marketValue) * 100) : 0;
      const [lat, lng]  = COORD_BY_STATE[state] || [-15.78, -47.93];

      const bankMatch = sourceUrl.match(/\/v\/([^/?]+)/);
      const sourceBank = bankMatch
        ? bankMatch[1].split('-').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
        : undefined;

      const id = `zuk-${propId.replace(/[^a-z0-9]/gi, '-')}`;

      properties.push({
        id, title: `${TYPE_LABELS[propertyType]} — ${city} / ${state}${neighborhood ? ' - ' + neighborhood : ''}`,
        address: fullAddress, city, state, latitude: lat, longitude: lng,
        mainImage: imgSrc || undefined, marketValue, initialBid, discountPercentage: discount,
        auctionDate: auctionDate || new Date().toISOString().split('T')[0], auctionTime,
        occupationStatus: mapOccupation(statusTexts), propertyType,
        sourceAuctioneer: 'Zuk Leilões', sourceBank, areaTotal, areaPrivate, active: true, campaignId,
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
        auction: {
          id: `zuk-auction-${propId}`, auctioneerName: 'Zuk Leilões',
          auctioneerWebsite: 'https://www.portalzuk.com.br',
          auctionWebsiteUrl: href, modalidade: modalidade || undefined,
          auctionNumber: propId,
        },
      });
    } catch { /* skip malformed */ }
  });

  return properties;
}

// ── Puppeteer scraper ─────────────────────────────────────────────────────────

async function scrapeWithBrowser(url: string, campaignId?: string): Promise<Property[]> {
  const puppeteer = await import('puppeteer');
  const browser = await puppeteer.default.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-blink-features=AutomationControlled',
    ],
  });

  try {
    const page = await browser.newPage();

    // Mask headless detection
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
    });

    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1280, height: 900 });

    console.log('[Puppeteer] Loading:', url);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });

    // Wait for at least one card to appear (ZUK loads cards via JS)
    try {
      await page.waitForSelector('div.card-property', { timeout: 15_000 });
    } catch {
      const title = await page.title();
      const finalUrl = page.url();
      console.error('[Puppeteer] No cards found. Title:', title, 'URL:', finalUrl);
    }

    const initial = await page.evaluate(function() {
      return document.querySelectorAll('div.card-property').length;
    });
    console.log('[Puppeteer] Initial cards:', initial);

    if (initial === 0) {
      const html = await page.content();
      console.error('[Puppeteer] Zero cards on page. HTML snippet:', html.substring(0, 500));
    }

    let count = initial;
    let rounds = 0;
    const MAX_ROUNDS = 50;

    while (rounds < MAX_ROUNDS) {
      // Fetch next batch directly from browser context (cookies included automatically)
      const result = await page.evaluate(async function(currentCount: number) {
        const tokenInput = document.querySelector('input[name="_token"]') as HTMLInputElement | null;
        const tokenMeta = document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement | null;
        const token = tokenInput?.value || tokenMeta?.content || '';
        if (!token) return { newCards: 0 };

        let res: Response;
        try {
          res = await fetch('/leilao-de-imoveis/mais', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
              'X-Requested-With': 'XMLHttpRequest',
              'Accept': '*/*',
            },
            body: 'limit=30&count_imovel_zuk=' + currentCount +
                  '&path=' + encodeURIComponent(window.location.href) +
                  '&order=data_leilao&div_parceiro_count=0&_token=' + encodeURIComponent(token),
            credentials: 'include',
          });
        } catch (e) { return { newCards: 0, error: String(e) }; }

        if (!res.ok) return { newCards: 0, status: res.status };

        const html = await res.text();
        const tmp = document.createElement('div');
        tmp.innerHTML = html;
        const cards = Array.from(tmp.querySelectorAll('div.card-property'));
        if (cards.length === 0) return { newCards: 0, status: res.status };

        // Append new cards to the existing container
        const container = document.querySelector('div.card-property')?.parentElement;
        if (container) cards.forEach(function(c) { container.appendChild(c); });

        return { newCards: cards.length, status: res.status };
      }, count);

      if (!result.newCards) {
        console.log('[Puppeteer] No new cards — status:', result.status, 'error:', (result as { error?: string }).error);
        break;
      }

      count += result.newCards;
      console.log(`[Puppeteer] Round ${rounds + 1}: +${result.newCards} (total: ${count})`);
      rounds++;

      await new Promise(function(r) { setTimeout(r, 200); });
    }

    const html = await page.content();
    console.log('[Puppeteer] Done:', count, 'cards after', rounds, 'rounds');

    return parseZUKHtml(html, url, campaignId);
  } finally {
    await browser.close();
  }
}

// ── route handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const { url, campaignId } = await req.json();
    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'URL inválida' }, { status: 400 });
    }

    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();

    if (!host.includes('portalzuk.com.br')) {
      return NextResponse.json({ error: 'Este endpoint suporta apenas portalzuk.com.br' }, { status: 400 });
    }

    const properties = await scrapeWithBrowser(url, campaignId);

    if (properties.length === 0) {
      return NextResponse.json({ error: 'Nenhum imóvel encontrado.' }, { status: 404 });
    }

    return NextResponse.json({ properties, count: properties.length });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro desconhecido';
    console.error('[Puppeteer route] error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
