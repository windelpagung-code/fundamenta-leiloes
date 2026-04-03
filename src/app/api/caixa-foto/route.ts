import { NextRequest, NextResponse } from 'next/server';

// Fetch and extract photo URLs from a Caixa property detail page
export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url');
  if (!url) return NextResponse.json({ images: [] });

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'pt-BR,pt;q=0.9',
      },
      signal: AbortSignal.timeout(8000),
      cache: 'force-cache', // Cache at the edge — photo URLs don't change
    });

    if (!res.ok) return NextResponse.json({ images: [] });

    const html = await res.text();

    // Extract <img> src attributes that look like property photos
    const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*/gi;
    const found: string[] = [];
    let match: RegExpExecArray | null;

    const BASE = 'https://venda-imoveis.caixa.gov.br';

    while ((match = imgRegex.exec(html)) !== null) {
      const src = match[1].trim();
      if (!src) continue;

      // Skip icons, logos, spacers, buttons
      const skip =
        src.includes('logo') ||
        src.includes('icon') ||
        src.includes('btn') ||
        src.includes('barra') ||
        src.includes('header') ||
        src.includes('footer') ||
        src.includes('menu') ||
        src.includes('gif') ||
        src.includes('spacer') ||
        src.endsWith('.ico') ||
        src.includes('data:image');

      if (skip) continue;

      // Only images that likely are property photos
      const isPhoto =
        src.includes('foto') ||
        src.includes('imagem') ||
        src.includes('imovel') ||
        src.match(/\.(jpg|jpeg|png|webp)(\?.*)?$/i);

      if (!isPhoto) continue;

      const absolute = src.startsWith('http') ? src : `${BASE}${src.startsWith('/') ? '' : '/'}${src}`;
      if (!found.includes(absolute)) found.push(absolute);
      if (found.length >= 5) break;
    }

    // Cache response for 1 hour
    return NextResponse.json(
      { images: found },
      { headers: { 'Cache-Control': 'public, max-age=3600, s-maxage=3600' } }
    );
  } catch {
    return NextResponse.json({ images: [] });
  }
}
