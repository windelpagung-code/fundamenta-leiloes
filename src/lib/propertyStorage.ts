/**
 * IndexedDB wrapper for storing imported Caixa properties and auction campaigns.
 * Replaces localStorage which is limited to ~5 MB.
 */

import { Property, AuctionCampaign } from '@/types/property';

const DB_NAME        = 'fundamenta-leiloes';
const DB_VERSION     = 3; // v3: keyPath changed from 'registrationNumber' to 'id'
const STORE_NAME     = 'caixa-properties';
const META_STORE     = 'meta';
const CAMPAIGNS_STORE = 'campaigns';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      // v3 migration: old store used keyPath 'registrationNumber' which broke
      // non-Caixa properties (ZUK, Mega, LJB). Drop and recreate with 'id'.
      if (db.objectStoreNames.contains(STORE_NAME)) {
        db.deleteObjectStore(STORE_NAME);
      }
      db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(META_STORE)) {
        db.createObjectStore(META_STORE);
      }
      if (!db.objectStoreNames.contains(CAMPAIGNS_STORE)) {
        db.createObjectStore(CAMPAIGNS_STORE, { keyPath: 'id' });
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

/** Save/merge properties — deduplicates by id, updates if modalidade changed */
export async function saveProperties(incoming: Property[]): Promise<{
  added: number;
  updated: number;
  skipped: number;
  total: number;
}> {
  const db = await openDB();

  // Load existing as a Map for O(1) lookup
  const existing = await getAllProperties(db);
  const map = new Map<string, Property>(existing.map((p) => [p.id, p]));

  let added = 0, updated = 0, skipped = 0;

  for (const p of incoming) {
    const current = map.get(p.id);

    if (!current) {
      map.set(p.id, p);
      added++;
    } else if (current.auction?.modalidade !== p.auction?.modalidade) {
      // Praça changed (e.g. 1ª → 2ª) — update price/date
      map.set(p.id, { ...current, ...p, updatedAt: new Date().toISOString() });
      updated++;
    } else {
      skipped++;
    }
  }

  const merged = Array.from(map.values());

  // Write all to IndexedDB in a single transaction
  await new Promise<void>((resolve, reject) => {
    const tx    = db.transaction([STORE_NAME, META_STORE], 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const meta  = tx.objectStore(META_STORE);

    store.clear();
    for (const p of merged) store.put(p);
    meta.put(new Date().toISOString(), 'importedAt');

    tx.oncomplete = () => resolve();
    tx.onerror    = () => reject(tx.error);
  });

  db.close();
  return { added, updated, skipped, total: merged.length };
}

/** Retrieve all stored properties */
export async function getProperties(): Promise<Property[]> {
  const db         = await openDB();
  const properties = await getAllProperties(db);
  db.close();
  return properties;
}

/** Get import metadata */
export async function getImportMeta(): Promise<{ importedAt: string | null; count: number }> {
  const db = await openDB();

  const [importedAt, count] = await Promise.all([
    new Promise<string | null>((res) => {
      const req = db
        .transaction(META_STORE, 'readonly')
        .objectStore(META_STORE)
        .get('importedAt');
      req.onsuccess = () => res((req.result as string) ?? null);
      req.onerror   = () => res(null);
    }),
    new Promise<number>((res) => {
      const req = db
        .transaction(STORE_NAME, 'readonly')
        .objectStore(STORE_NAME)
        .count();
      req.onsuccess = () => res(req.result);
      req.onerror   = () => res(0);
    }),
  ]);

  db.close();
  return { importedAt, count };
}

/** Get a single property by its app id (e.g. "caixa-8787717076923", "zuk-123", etc.) */
export async function getPropertyById(id: string): Promise<Property | null> {
  const db  = await openDB();
  const res = await new Promise<Property | null>((resolve, reject) => {
    const req = db
      .transaction(STORE_NAME, 'readonly')
      .objectStore(STORE_NAME)
      .get(id);
    req.onsuccess = () => resolve((req.result as Property) ?? null);
    req.onerror   = () => reject(req.error);
  });
  db.close();
  return res;
}

/** Update auction date/time and optionally areas/payment methods for a single property */
export async function updatePropertyDate(
  propertyId: string,
  auctionDate: string,
  auctionTime?: string,
  areaTotal?: number | null,
  areaPrivate?: number | null,
  paymentMethods?: string[] | null,
): Promise<void> {
  const db = await openDB();
  return new Promise<void>((resolve, reject) => {
    const tx    = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req   = store.get(propertyId);

    req.onsuccess = () => {
      const prop = req.result as Property | undefined;
      if (prop) {
        store.put({
          ...prop,
          auctionDate,
          ...(auctionTime                            ? { auctionTime }     : {}),
          ...(areaTotal   != null                    ? { areaTotal }       : {}),
          ...(areaPrivate != null                    ? { areaPrivate }     : {}),
          ...(paymentMethods && paymentMethods.length ? { paymentMethods } : {}),
        });
      }
    };

    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror    = () => { db.close(); reject(tx.error); };
  });
}

/** Delete all stored properties */
export async function clearProperties(): Promise<void> {
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction([STORE_NAME, META_STORE], 'readwrite');
    tx.objectStore(STORE_NAME).clear();
    tx.objectStore(META_STORE).clear();
    tx.oncomplete = () => resolve();
    tx.onerror    = () => reject(tx.error);
  });
  db.close();
}

// ── campaigns ───────────────────────────────────────────────────────────────

export async function saveCampaign(campaign: AuctionCampaign): Promise<void> {
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(CAMPAIGNS_STORE, 'readwrite');
    tx.objectStore(CAMPAIGNS_STORE).put(campaign);
    tx.oncomplete = () => resolve();
    tx.onerror    = () => reject(tx.error);
  });
  db.close();
}

export async function getCampaigns(): Promise<AuctionCampaign[]> {
  const db = await openDB();
  const result = await new Promise<AuctionCampaign[]>((resolve, reject) => {
    const req = db.transaction(CAMPAIGNS_STORE, 'readonly').objectStore(CAMPAIGNS_STORE).getAll();
    req.onsuccess = () => resolve(req.result as AuctionCampaign[]);
    req.onerror   = () => reject(req.error);
  });
  db.close();
  return result;
}

export async function deleteCampaign(id: string): Promise<void> {
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(CAMPAIGNS_STORE, 'readwrite');
    tx.objectStore(CAMPAIGNS_STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror    = () => reject(tx.error);
  });
  db.close();
}

// ── internal helper ────────────────────────────────────────────────────────
function getAllProperties(db: IDBDatabase): Promise<Property[]> {
  return new Promise((resolve, reject) => {
    const req = db
      .transaction(STORE_NAME, 'readonly')
      .objectStore(STORE_NAME)
      .getAll();
    req.onsuccess = () => resolve(req.result as Property[]);
    req.onerror   = () => reject(req.error);
  });
}
