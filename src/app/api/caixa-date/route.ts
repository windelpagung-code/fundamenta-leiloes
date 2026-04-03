import { NextRequest, NextResponse } from 'next/server';

/** Convert "06/04/2026" → "2026-04-06" */
function brDateToISO(ddmmyyyy: string): string {
  const [dd, mm, yyyy] = ddmmyyyy.split('/');
  return `${yyyy}-${mm}-${dd}`;
}

/** Convert "10h00" → "10:00" */
function parseTime(raw: string): string {
  return raw.replace('h', ':');
}

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

// Singleton warmup: all concurrent requests share the same promise
// so we never run more than one warmup at a time.
let warmupPromise: Promise<void> | null = null;

function getWarmup(): Promise<void> {
  if (!warmupPromise) {
    warmupPromise = fetch(
      'https://venda-imoveis.caixa.gov.br/listaweb/Lista_imoveis_SP.csv',
      { headers: BROWSER_HEADERS, signal: AbortSignal.timeout(10_000), cache: 'no-store' }
    )
      .catch(() => { /* ignore — detail fetch might still succeed */ })
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

/**
 * GET /api/caixa-date?numero=8787717076923
 *
 * Fetches the Caixa detail page server-side (avoids CORS / Radware challenge
 * in the user's browser) and extracts auction dates.
 *
 * Returns:
 *   { found: true, auctionDate: "2026-04-06", auctionTime: "10:00", allDates: [...] }
 *   { found: false }
 *   { error: string }
 */
export async function GET(req: NextRequest) {
  const numero = req.nextUrl.searchParams.get('numero');
  if (!numero || !/^\d+$/.test(numero)) {
    return NextResponse.json({ error: 'Parâmetro "numero" inválido.' }, { status: 400 });
  }

  try {
    // Wait for the shared warmup (concurrent calls reuse the same promise)
    await getWarmup();

    const detailUrl = `https://venda-imoveis.caixa.gov.br/sistema/detalhe-imovel.asp?hdnimovel=${encodeURIComponent(numero)}`;

    const fetchDetail = async () => {
      const res = await fetch(detailUrl, {
        headers: BROWSER_HEADERS,
        redirect: 'follow',
        signal: AbortSignal.timeout(12_000),
        cache: 'no-store',
      });
      const buffer = await res.arrayBuffer();
      let html = new TextDecoder('utf-8').decode(buffer);
      if (html.includes('\ufffd')) html = new TextDecoder('iso-8859-1').decode(buffer);
      return { html, finalUrl: res.url, size: buffer.byteLength };
    };

    let { html, finalUrl, size } = await fetchDetail();

    // If we hit a CAPTCHA, reset warmup and retry once
    if (size < 500 || isCaptchaPage(html, finalUrl)) {
      warmupPromise = null; // force fresh warmup on retry
      await getWarmup();
      ({ html, finalUrl, size } = await fetchDetail());
    }

    if (size < 500 || isCaptchaPage(html, finalUrl)) {
      return NextResponse.json({ found: false, reason: 'blocked' });
    }

    // Pattern: "Data do 1º Leilão - DD/MM/YYYY - HHhMM"
    // Captures: (ordinal) (date) (time)
    const re = /Data\s+do\s+([\d]+[º°o]|[ÚUúu]nico)\s+Leil[aã]o\s*[-\u2013]\s*(\d{2}\/\d{2}\/\d{4})\s*[-\u2013]\s*(\d{1,2}h\d{2})/gi;
    const allDates: Array<{ label: string; auctionDate: string; auctionTime: string }> = [];
    let m: RegExpExecArray | null;
    while ((m = re.exec(html)) !== null) {
      allDates.push({
        label:       m[1],
        auctionDate: brDateToISO(m[2]),
        auctionTime: parseTime(m[3]),
      });
    }

    // Area extraction — HTML has tags between "=" and value:
    // e.g. "Área total = <strong>84,71m2</strong>"
    const parseBR = (v: string) => parseFloat(v.replace(',', '.')) || null;
    const totalM   = html.match(/[aáÁ]rea\s+total\s*=\s*(?:<[^>]*>)?\s*([\d,]+)\s*m/i);
    const privateM = html.match(/[aáÁ]rea\s+privativa\s*=\s*(?:<[^>]*>)?\s*([\d,]+)\s*m/i);
    const areaTotal   = totalM   ? parseBR(totalM[1])   : null;
    const areaPrivate = privateM ? parseBR(privateM[1]) : null;

    // Payment methods — parse from the "FORMAS DE PAGAMENTO ACEITAS" block in the Caixa page
    // The block looks like: "Recursos próprios." / "Permite utilização de FGTS." / "Financiamento SBPE" / etc.
    const h = html.toLowerCase();
    const paymentMethods: string[] = [];

    // Locate the payment block to avoid false positives elsewhere on the page
    const payBlock = (() => {
      const start = h.indexOf('formas de pagamento');
      if (start === -1) return h;                // not found — search whole page
      const end = h.indexOf('regras para pagamento', start);
      return end === -1 ? h.slice(start) : h.slice(start, end);
    })();

    if (/recursos\s+pr[oó]prios/.test(payBlock))                paymentMethods.push('À Vista');
    if (/fgts/.test(payBlock))                                  paymentMethods.push('FGTS');
    if (/sbpe/.test(payBlock))                                  paymentMethods.push('Financiamento SBPE');
    else if (/financiamento/.test(payBlock))                    paymentMethods.push('Financiamento');
    if (/parcelamento\s+direto|parcelamento\s+caixa/.test(payBlock)) paymentMethods.push('Parcelamento Caixa');
    else if (/parcelamento/.test(payBlock))                     paymentMethods.push('Parcelamento');
    if (/carta\s+de\s+cr[eé]dito/.test(payBlock))              paymentMethods.push('Carta de Crédito');

    // Fallback if block not found but page has clues
    if (paymentMethods.length === 0) {
      if (/fgts/.test(h))         paymentMethods.push('FGTS');
      if (/sbpe/.test(h))         paymentMethods.push('Financiamento SBPE');
      if (paymentMethods.length === 0) paymentMethods.push('À Vista');
    }

    if (!allDates.length) {
      return NextResponse.json({ found: false, areaTotal, areaPrivate, paymentMethods });
    }

    return NextResponse.json({
      found: true,
      auctionDate: allDates[0].auctionDate,
      auctionTime: allDates[0].auctionTime,
      auctionLabel: allDates[0].label,
      allDates,
      areaTotal,
      areaPrivate,
      paymentMethods,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro desconhecido';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
