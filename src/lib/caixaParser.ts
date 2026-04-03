import { Property, PropertyType, OccupationStatus } from '@/types/property';

// Parse Brazilian number format: "213.500,00" -> 213500
function parseBRNumber(value: string): number {
  if (!value || value.trim() === '') return 0;
  return parseFloat(value.trim().replace(/\./g, '').replace(',', '.')) || 0;
}

// Detect property type from Caixa description field.
// The description always starts with the property type keyword, e.g.:
//   "Apartamento, 84.71 de área total, ..."
//   "Casa, 175.54 de área total, ..."
//   "Terreno, 0.00 de área total, ..."
//   "Sala Comercial, ..."
// Checking startsWith avoids false positives like "1 sala(s)" inside house descriptions.
function detectPropertyType(descricao: string): PropertyType {
  const d = descricao.toLowerCase().trim();

  // --- Primary: check the first word/phrase (most reliable) ---
  if (d.startsWith('apartamento') || d.startsWith('apto')) return 'APARTMENT';
  if (d.startsWith('terreno') || d.startsWith('lote') || d.startsWith('gleba')) return 'LAND';
  if (
    d.startsWith('sala') ||       // "Sala Comercial", "Sala/Conjunto"
    d.startsWith('loja') ||
    d.startsWith('galpão') ||
    d.startsWith('pavilhão') ||
    d.startsWith('prédio') ||
    d.startsWith('comercial') ||
    d.startsWith('conjunto')
  ) return 'COMMERCIAL';
  if (
    d.startsWith('rural') ||
    d.startsWith('sítio') ||
    d.startsWith('fazenda') ||
    d.startsWith('chácara') ||
    d.startsWith('haras')
  ) return 'RURAL';
  if (d.startsWith('casa') || d.startsWith('sobrado') || d.startsWith('village')) return 'HOUSE';

  // --- Fallback: search anywhere, but never match "sala(s)" (= living room) ---
  if (d.includes('terreno') || d.includes('lote') || d.includes('gleba')) return 'LAND';
  if (
    d.includes('sala comercial') || d.includes('loja') ||
    d.includes('galpão') || d.includes('pavilhão') || d.includes('prédio comercial')
  ) return 'COMMERCIAL';
  if (d.includes('rural') || d.includes('sítio') || d.includes('fazenda') || d.includes('chácara')) return 'RURAL';
  if (d.includes('apartamento') || d.includes('apto')) return 'APARTMENT';

  return 'HOUSE';
}

// Parse areas directly from the CSV description.
// Format: "84.71 de área total, 40.95 de área privativa, 390.00 de área do terreno"
function parseAreasFromDescription(descricao: string): { areaTotal?: number; areaPrivate?: number } {
  const totalM   = descricao.match(/([\d.]+)\s+de\s+[aá]rea\s+total/i);
  const privateM = descricao.match(/([\d.]+)\s+de\s+[aá]rea\s+privativa/i);
  const terrenoM = descricao.match(/([\d.]+)\s+de\s+[aá]rea\s+do\s+terreno/i);

  const parse = (v: string) => { const n = parseFloat(v); return n > 0 ? n : undefined; };

  const areaTotal   = parse(totalM?.[1] ?? '0') ?? parse(terrenoM?.[1] ?? '0');
  const areaPrivate = parse(privateM?.[1] ?? '0');

  return {
    ...(areaTotal   ? { areaTotal }   : {}),
    ...(areaPrivate ? { areaPrivate } : {}),
  };
}

// Convert ALL CAPS city name to Title Case respecting Portuguese prepositions
function toTitleCase(str: string): string {
  const lower = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'a', 'o', 'em', 'no', 'na', 'por', 'para']);
  return str
    .toLowerCase()
    .split(' ')
    .map((word, i) => (i > 0 && lower.has(word) ? word : word.charAt(0).toUpperCase() + word.slice(1)))
    .join(' ');
}

// Parse a single CSV line respecting semicolons and optional quotes
function parseCSVLine(line: string): string[] {
  return line.split(';').map((v) => v.trim().replace(/^"|"$/g, ''));
}

// State geographic centers used as fallback when geocoding fails
export const STATE_CENTERS: Record<string, [number, number]> = {
  AC: [-9.97, -67.8],   AL: [-9.7, -35.7],   AP: [0.0, -51.1],    AM: [-3.1, -60.0],
  BA: [-12.9, -38.5],   CE: [-3.7, -38.5],   DF: [-15.8, -47.9],  ES: [-20.3, -40.3],
  GO: [-16.0, -49.3],   MA: [-2.5, -44.3],   MT: [-15.6, -56.1],  MS: [-20.4, -54.6],
  MG: [-19.9, -43.9],   PA: [-1.5, -48.5],   PB: [-7.1, -34.9],   PR: [-25.4, -49.3],
  PE: [-8.1, -34.9],    PI: [-5.1, -42.8],   RJ: [-22.9, -43.2],  RN: [-5.8, -35.2],
  RS: [-30.0, -51.2],   RO: [-8.8, -63.9],   RR: [2.8, -60.7],    SC: [-27.6, -48.5],
  SP: [-23.5, -46.6],   SE: [-10.9, -37.1],  TO: [-10.2, -48.3],
};

// Geocode up to maxCities unique city names via Nominatim (OpenStreetMap, no API key)
export async function geocodeCities(
  cities: Array<{ city: string; uf: string }>,
  maxCities = 20
): Promise<Map<string, [number, number]>> {
  const result = new Map<string, [number, number]>();
  const unique = Array.from(
    new Map(cities.map((c) => [`${c.city}|${c.uf}`, c])).values()
  ).slice(0, maxCities);

  for (let i = 0; i < unique.length; i++) {
    const { city, uf } = unique[i];
    const key = `${city}|${uf}`;
    try {
      const query = `${city}, ${uf}, Brasil`;
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&countrycodes=br`;
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Fundamenta-Leiloes/1.0 (contato@fundamentaleiloes.com.br)',
          'Accept-Language': 'pt-BR,pt;q=0.9',
        },
        signal: AbortSignal.timeout(3000),
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.[0]) {
          result.set(key, [parseFloat(data[0].lat), parseFloat(data[0].lon)]);
        }
      }
    } catch {
      // geocoding failure → state center used as fallback below
    }
    if (i < unique.length - 1) {
      // Nominatim policy: max 1 req/sec; 200ms gives ~5 req/sec with some margin
      await new Promise((r) => setTimeout(r, 200));
    }
  }
  return result;
}

export interface CaixaRow {
  numero: string;
  uf: string;
  cidade: string;
  bairro: string;
  endereco: string;
  preco: number;
  valorAvaliacao: number;
  desconto: number;
  financiamento: string;
  descricao: string;
  modalidade: string;
  link: string;
}

// Parse raw CSV text into structured rows
export function parseCaixaCSVText(csvText: string): CaixaRow[] {
  // Caixa may deliver Latin-1; replace common garbled sequences
  const lines = csvText.split('\n').filter((l) => l.trim());
  if (lines.length < 2) return [];

  const headers = parseCSVLine(lines[0]);

  const col = (keyword: string, fallback: number) => {
    const i = headers.findIndex((h) => h.toLowerCase().includes(keyword.toLowerCase()));
    return i !== -1 ? i : fallback;
  };

  const idxNumero      = col('imóvel', 0);
  const idxUF          = col('UF', 1);
  const idxCidade      = col('Cidade', 2);
  const idxBairro      = col('Bairro', 3);
  const idxEndereco    = col('Endereço', 4);
  const idxPreco       = col('Preço', 5);
  const idxValorAv     = col('avaliação', 6);
  const idxDesconto    = col('Desconto', 7);
  const idxFinanc      = col('Financiamento', 8);
  const idxDescricao   = col('Descrição', 9);
  const idxModalidade  = col('Modalidade', 10);
  const idxLink        = col('Link', 11);

  return lines
    .slice(1)
    .map((line) => {
      const v = parseCSVLine(line);
      return {
        numero:        v[idxNumero]    || '',
        uf:            (v[idxUF]       || '').trim().toUpperCase(),
        cidade:        v[idxCidade]    || '',
        bairro:        v[idxBairro]    || '',
        endereco:      v[idxEndereco]  || '',
        preco:         parseBRNumber(v[idxPreco]),
        valorAvaliacao:parseBRNumber(v[idxValorAv]),
        desconto:      parseBRNumber(v[idxDesconto]),
        financiamento: v[idxFinanc]    || '',
        descricao:     v[idxDescricao] || '',
        modalidade:    v[idxModalidade]|| '',
        link:          v[idxLink]      || '',
      };
    })
    .filter((r) => r.numero && r.uf);
}

// Convert parsed rows to Property objects using the resolved coords map
export function convertToProperties(
  rows: CaixaRow[],
  coordsMap: Map<string, [number, number]>
): Property[] {
  const now = new Date().toISOString();

  return rows.map((row, idx) => {
    const cityKey = `${row.cidade}|${row.uf}`;
    const coords  = coordsMap.get(cityKey);
    const fallback = STATE_CENTERS[row.uf];
    const lat = coords?.[0] ?? fallback?.[0];
    const lng = coords?.[1] ?? fallback?.[1];

    const marketValue = row.valorAvaliacao;
    const initialBid  = row.preco;
    const discountPct =
      row.desconto > 0
        ? row.desconto
        : marketValue > 0
        ? Math.round((1 - initialBid / marketValue) * 100)
        : 0;

    const cityDisplay  = row.cidade ? toTitleCase(row.cidade) : '';
    const bairroDisplay = row.bairro ? toTitleCase(row.bairro) : '';

    const propType  = detectPropertyType(row.descricao);
    const areas     = parseAreasFromDescription(row.descricao);
    const titleBase = row.descricao
      ? row.descricao.split(' ').slice(0, 6).join(' ')
      : 'Imóvel';
    const location  = bairroDisplay || cityDisplay;
    const title     = `${titleBase} – ${location}`;
    const address   = [row.endereco, bairroDisplay].filter(Boolean).join(', ') || cityDisplay;

    return {
      id: `caixa-${row.numero}`,
      title,
      description: row.descricao || undefined,
      address,
      city: cityDisplay,
      state: row.uf,
      latitude: lat,
      longitude: lng,
      marketValue,
      initialBid,
      discountPercentage: Math.max(0, discountPct),
      auctionDate: '', // CSV da Caixa não contém data — consultar página de detalhe
      occupationStatus: 'UNKNOWN' as OccupationStatus,
      propertyType: propType,
      ...areas,
      sourceBank: 'Caixa Econômica Federal',
      registrationNumber: row.numero,
      active: true,
      createdAt: now,
      updatedAt: now,
      auction: row.modalidade
        ? {
            id: `auc-caixa-${idx}`,
            auctioneerName: 'Caixa Econômica Federal',
            auctioneerWebsite: row.link || undefined,
            modalidade: row.modalidade,
          }
        : undefined,
    } as Property;
  });
}
