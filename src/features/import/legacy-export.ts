/**
 * Legacy Dexie Exporter
 * Extracts local unauthenticated records from Dexie 'DementiaARDatabase' (v1)
 * into a structured manifest and binaries ready for account-scoped server migration.
 */

import { db, type Person as LegacyPerson, type Conversation as LegacyConversation } from '../../db/database';
import type { LegacyImportManifest } from '../../lib/contracts';

const STORAGE_KEY_SOURCE_ID = 'dementia_legacy_source_id';
const STORAGE_KEY_CLAIMED_ACCOUNT = 'dementia_legacy_claimed_account';

/**
 * Gets or creates a stable UUID representing this browser origin's database instance.
 */
export function getOrCreateLocalSourceId(): string {
  let sourceId = localStorage.getItem(STORAGE_KEY_SOURCE_ID);
  if (!sourceId) {
    sourceId = crypto.randomUUID();
    localStorage.setItem(STORAGE_KEY_SOURCE_ID, sourceId);
  }
  return sourceId;
}

/**
 * Checks which account has already claimed this local database.
 */
export function getClaimedAccount(): string | null {
  return localStorage.getItem(STORAGE_KEY_CLAIMED_ACCOUNT);
}

/**
 * Marks this local database as claimed by an account.
 */
export function setClaimedAccount(userId: string): void {
  localStorage.setItem(STORAGE_KEY_CLAIMED_ACCOUNT, userId);
}

/**
 * Checks if the legacy Dexie database has records to import.
 */
export async function detectLegacyData(): Promise<{
  hasData: boolean;
  peopleCount: number;
  conversationsCount: number;
}> {
  try {
    const peopleCount = await db.people.count();
    const conversationsCount = await db.conversations.count();
    return {
      hasData: peopleCount > 0,
      peopleCount,
      conversationsCount,
    };
  } catch (err) {
    console.warn('Could not read legacy IndexedDB:', err);
    return { hasData: false, peopleCount: 0, conversationsCount: 0 };
  }
}

export interface LegacyExportPackage {
  manifest: LegacyImportManifest;
  photos: Map<string, Blob>; // filename -> Blob
}

/**
 * Exports all legacy records into an in-memory export package.
 */
export async function exportLegacyData(): Promise<LegacyExportPackage> {
  const sourceId = getOrCreateLocalSourceId();
  const rawPeople = await db.people.toArray();
  const rawConversations = await db.conversations.toArray();

  const photos = new Map<string, Blob>();

  const peopleManifest = rawPeople.map((p: LegacyPerson) => {
    const legacyId = String(p.id);
    let photoFile: string | undefined = undefined;

    if (p.photoBlob) {
      photoFile = `person_${legacyId}.jpg`;
      photos.set(photoFile, p.photoBlob);
    }

    return {
      legacyId,
      name: p.name,
      relation: p.relation,
      photoFile,
      descriptor: p.faceDescriptor,
      descriptorModel: p.faceDescriptor ? 'face-api-v1-legacy' : undefined,
    };
  });

  const conversationsManifest = rawConversations.map((c: LegacyConversation) => ({
    legacyId: String(c.id),
    personLegacyId: String(c.personId),
    rawText: c.rawText,
    summary: c.summary,
    date: (c.date instanceof Date ? c.date : new Date(c.date)).toISOString(),
    createdAt: (c.createdAt instanceof Date ? c.createdAt : new Date(c.createdAt)).toISOString(),
  }));

  const manifest: LegacyImportManifest = {
    sourceId,
    schemaVersion: 1,
    people: peopleManifest,
    conversations: conversationsManifest,
  };

  return { manifest, photos };
}
