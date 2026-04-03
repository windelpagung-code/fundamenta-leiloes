export type EvictionStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';

export interface RenovationEntry {
  id: string;
  journalId: string;
  date: string;
  description: string;
  cost: number;
  photoUrls?: string[];
  stage?: string;
  createdAt: string;
}

export interface JournalDocument {
  id: string;
  journalId: string;
  name: string;
  url: string;
  type: string;
  uploadedAt: string;
}

export interface BidderJournal {
  id: string;
  userId: string;
  propertyId: string;
  evictionStatus: EvictionStatus;
  actualEvictionCosts: number;
  actualDocumentationCosts: number;
  actualRenovationCosts: number;
  notes?: string;
  acquiredAt?: string;
  acquiredValue?: number;
  targetSaleValue?: number;
  createdAt: string;
  updatedAt: string;
  renovationLog: RenovationEntry[];
  documents: JournalDocument[];
  property?: {
    id: string;
    title: string;
    address: string;
    city: string;
    state: string;
    mainImage?: string;
    propertyType: string;
  };
}

export const EVICTION_STATUS_LABELS: Record<EvictionStatus, string> = {
  PENDING: 'Pendente',
  IN_PROGRESS: 'Em Andamento',
  COMPLETED: 'Concluída',
};

export const RENOVATION_STAGES = [
  'Planejamento',
  'Demolição',
  'Estrutura',
  'Elétrica',
  'Hidráulica',
  'Alvenaria',
  'Acabamento',
  'Pintura',
  'Instalações',
  'Limpeza Final',
  'Concluído',
];
