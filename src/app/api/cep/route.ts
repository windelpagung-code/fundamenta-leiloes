import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const cep = req.nextUrl.searchParams.get('cep')?.replace(/\D/g, '');
  if (!cep || cep.length !== 8) {
    return NextResponse.json({ error: 'CEP inválido' }, { status: 400 });
  }

  try {
    // 1. ViaCEP → address fields
    const viaRes = await fetch(`https://viacep.com.br/ws/${cep}/json/`, {
      headers: { 'User-Agent': 'Fundamenta-Leiloes/1.0' },
    });
    if (!viaRes.ok) throw new Error('CEP não encontrado');
    const via = await viaRes.json();
    if (via.erro) return NextResponse.json({ error: 'CEP não encontrado' }, { status: 404 });

    const address = [via.logradouro, via.bairro].filter(Boolean).join(', ');
    const city    = via.localidade || '';
    const state   = via.uf || '';

    // 2. Nominatim → coordinates
    let latitude: number | null = null;
    let longitude: number | null = null;

    const query = `${via.logradouro || ''}, ${city}, ${state}, Brasil`;
    const geoRes = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&countrycodes=br`,
      { headers: { 'User-Agent': 'Fundamenta-Leiloes/1.0' } }
    );
    if (geoRes.ok) {
      const geo = await geoRes.json();
      if (geo.length > 0) {
        latitude  = parseFloat(geo[0].lat);
        longitude = parseFloat(geo[0].lon);
      }
    }

    return NextResponse.json({ address, city, state, latitude, longitude, zipCode: cep });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro ao buscar CEP' },
      { status: 500 }
    );
  }
}
