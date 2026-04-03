import { NextRequest, NextResponse } from 'next/server';
import {
  parseCaixaCSVText,
  convertToProperties,
  geocodeCities,
  STATE_CENTERS,
} from '@/lib/caixaParser';

async function fetchCSVText(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Fundamenta-Leiloes/1.0' },
    // No cache so we always get the latest file
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Erro ao buscar arquivo (HTTP ${res.status})`);

  const buffer = await res.arrayBuffer();
  // Try UTF-8 first; fall back to Latin-1 (common for Brazilian government sites)
  let text = new TextDecoder('utf-8').decode(buffer);
  if (text.includes('\ufffd')) {
    text = new TextDecoder('iso-8859-1').decode(buffer);
  }
  return text;
}

export async function POST(req: NextRequest) {
  try {
    let csvText: string | null = null;

    const contentType = req.headers.get('content-type') || '';

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const file = formData.get('file') as File | null;
      const url  = formData.get('url')  as string | null;

      if (file) {
        const buffer = await file.arrayBuffer();
        csvText = new TextDecoder('utf-8').decode(buffer);
        if (csvText.includes('\ufffd')) {
          csvText = new TextDecoder('iso-8859-1').decode(buffer);
        }
      } else if (url?.trim()) {
        csvText = await fetchCSVText(url.trim());
      }
    } else {
      const body = await req.json().catch(() => ({}));
      if (body.url) {
        csvText = await fetchCSVText(body.url);
      } else if (body.csvText) {
        csvText = body.csvText;
      }
    }

    if (!csvText) {
      return NextResponse.json({ error: 'Nenhum arquivo ou URL fornecido.' }, { status: 400 });
    }

    // 1. Parse CSV rows
    const rows = parseCaixaCSVText(csvText);
    if (!rows.length) {
      return NextResponse.json({ error: 'Arquivo sem dados válidos. Verifique se é um CSV da Caixa.' }, { status: 400 });
    }

    // 2. Geocode up to 20 unique cities; rest will use state center
    const uniqueCities = Array.from(
      new Map(rows.map((r) => [`${r.cidade}|${r.uf}`, { city: r.cidade, uf: r.uf }])).values()
    );
    const coordsMap = await geocodeCities(uniqueCities, 20);

    // Fill remaining cities with state center fallback
    for (const { city, uf } of uniqueCities) {
      const key = `${city}|${uf}`;
      if (!coordsMap.has(key) && STATE_CENTERS[uf]) {
        coordsMap.set(key, STATE_CENTERS[uf]);
      }
    }

    // 3. Convert to Property objects
    const properties = convertToProperties(rows, coordsMap);

    return NextResponse.json({
      success: true,
      count: properties.length,
      geocodedCities: coordsMap.size,
      uniqueCities: uniqueCities.length,
      properties,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
