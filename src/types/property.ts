export type OccupationStatus = 'OCCUPIED' | 'VACANT' | 'UNKNOWN';
export type PropertyType = 'HOUSE' | 'APARTMENT' | 'LAND' | 'COMMERCIAL' | 'RURAL';

export interface AuctionCampaign {
  id: string;
  name: string;
  bank?: string;
  description?: string;
  bannerImage?: string;      // base64 or URL
  startDate?: string;
  endDate?: string;
  active: boolean;
  propertyIds?: string[];    // optional pinned list; if empty, match via campaignId on property
  createdAt: string;
}

export interface Property {
  id: string;
  title: string;
  description?: string;
  mainImage?: string;
  galleryImages?: string[];
  address: string;
  city: string;
  state: string;
  zipCode?: string;
  latitude?: number;
  longitude?: number;
  marketValue: number;
  initialBid: number;
  discountPercentage: number;
  auctionDate: string;
  auctionTime?: string;
  occupationStatus: OccupationStatus;
  propertyType: PropertyType;
  sourceBank?: string;
  sourceAuctioneer?: string;
  registrationNumber?: string;
  legalIssues?: string[];
  areaTotal?: number;
  areaPrivate?: number;
  active: boolean;
  campaignId?: string;
  createdAt: string;
  updatedAt: string;
  auction?: {
    id: string;
    auctioneerName: string;
    auctioneerWebsite?: string;
    auctionWebsiteUrl?: string;
    officialNoticeUrl?: string;
    registrationDocumentUrl?: string;
    modalidade?: string;
    auctionNumber?: string;
  };
  paymentMethods?: string[];   // e.g. ['À Vista', 'FGTS', 'Financiamento']
  isSaved?: boolean;
}

export type SortBy =
  | 'price_asc'
  | 'price_desc'
  | 'discount_desc'
  | 'discount_asc'
  | 'value_asc'
  | 'value_desc';

export interface PropertyFilters {
  state?: string;
  propertyType?: PropertyType;
  minValue?: number;
  maxValue?: number;
  sourceBank?: string;
  sourceAuctioneer?: string;
  occupationStatus?: OccupationStatus;
  modalidade?: string;
  paymentMethod?: string;
  campaignId?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  searchAddress?: boolean;
  sortBy?: SortBy;
}

export const PROPERTY_TYPE_LABELS: Record<PropertyType, string> = {
  HOUSE: 'Casa',
  APARTMENT: 'Apartamento',
  LAND: 'Terreno',
  COMMERCIAL: 'Comercial',
  RURAL: 'Rural',
};

export const OCCUPATION_STATUS_LABELS: Record<OccupationStatus, string> = {
  OCCUPIED: 'Ocupado',
  VACANT: 'Desocupado',
  UNKNOWN: 'Não Informado',
};

export const BRAZIL_STATES = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO',
  'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI',
  'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
];

export const BANKS = [
  'Caixa Econômica Federal',
  'Banco do Brasil',
  'Itaú',
  'Bradesco',
  'Santander',
  'BTG Pactual',
  'Votorantim',
];

export const AUCTIONEERS = [
  'Zuk Leilões',
  'Mega Leilões',
  'Sodré Santoro',
  'Lance Certo',
  'Sold',
  'Superbid',
  'Leiloeiro Oficial',
];
