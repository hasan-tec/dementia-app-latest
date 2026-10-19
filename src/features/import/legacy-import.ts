/**
 * Legacy Import Orchestrator
 * Chunks legacy records, streams them to the server import endpoint,
 * maintains ID mappings, and guards against cross-account duplication.
 */

import { exportLegacyData, getClaimedAccount, setClaimedAccount } from './legacy-export';
import type { ImportResult } from '../../lib/contracts';

export interface ImportProgress {
  phase: 'idle' | 'exporting' | 'uploading' | 'completed' | 'error';
  totalPeople: number;
  importedPeople: number;
  totalConversations: number;
  importedConversations: number;
  currentEntity: string;
  errorMessage?: string;
}

export type ProgressCallback = (progress: ImportProgress) => void;

/**
 * Imports all local legacy records into the currently authenticated user's account.
 */
export async function runLegacyImport(
  currentUserId: string,
  onProgress?: ProgressCallback
): Promise<ImportResult> {
  // 1. Guard against importing into a second account
  const previouslyClaimedAccount = getClaimedAccount();
  if (previouslyClaimedAccount && previouslyClaimedAccount !== currentUserId) {
    throw new Error(
      'This browser database was previously imported into a different account. To protect data privacy, automatic import is blocked.'
    );
  }

  onProgress?.({
    phase: 'exporting',
    totalPeople: 0,
    importedPeople: 0,
    totalConversations: 0,
    importedConversations: 0,
    currentEntity: 'Reading local database...',
  });

  const { manifest, photos } = await exportLegacyData();
  const totalPeople = manifest.people.length;
  const totalConversations = manifest.conversations.length;

  const result: ImportResult = {
    sourceId: manifest.sourceId,
    idMap: {
      people: {},
      conversations: {},
    },
    perRecordStatus: [],
    expectedCount: totalPeople + totalConversations,
    actualCount: 0,
  };

  onProgress?.({
    phase: 'uploading',
    totalPeople,
    importedPeople: 0,
    totalConversations,
    importedConversations: 0,
    currentEntity: 'Starting upload...',
  });

  let importedPeopleCount = 0;
  let importedConvCount = 0;

  // 2. Import People sequentially (one chunk per person + photo)
  for (const person of manifest.people) {
    onProgress?.({
      phase: 'uploading',
      totalPeople,
      importedPeople: importedPeopleCount,
      totalConversations,
      importedConversations: importedConvCount,
      currentEntity: `Importing ${person.name}...`,
    });

    const formData = new FormData();
    formData.append('sourceId', manifest.sourceId);
    formData.append('entityType', 'person');
    formData.append('legacyId', person.legacyId);
    formData.append('name', person.name);
    formData.append('relation', person.relation);

    if (person.descriptor) {
      formData.append('descriptor', JSON.stringify(person.descriptor));
      formData.append('descriptorModel', person.descriptorModel || 'legacy');
    }

    if (person.photoFile && photos.has(person.photoFile)) {
      formData.append('photo', photos.get(person.photoFile)!, 'photo.jpg');
    }

    try {
      const response = await fetch('/api/import', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Server returned status ${response.status}`);
      }

      const data = await response.json();
      result.idMap.people[person.legacyId] = data.serverId;
      result.perRecordStatus.push({
        legacyId: person.legacyId,
        entityType: 'person',
        status: data.status || 'imported',
      });
      importedPeopleCount++;
      result.actualCount++;
    } catch (err) {
      result.perRecordStatus.push({
        legacyId: person.legacyId,
        entityType: 'person',
        status: 'error',
        message: err instanceof Error ? err.message : 'Upload failed',
      });
      throw err; // Stop on error to maintain sequential integrity
    }
  }

  // 3. Import Conversations linked to imported people
  for (const conv of manifest.conversations) {
    const personServerId = result.idMap.people[conv.personLegacyId];
    if (!personServerId) {
      console.warn(`Skipping conversation ${conv.legacyId}: parent person ${conv.personLegacyId} not found`);
      continue;
    }

    const formData = new FormData();
    formData.append('sourceId', manifest.sourceId);
    formData.append('entityType', 'conversation');
    formData.append('legacyId', conv.legacyId);
    formData.append('personServerId', personServerId);
    formData.append('rawText', conv.rawText);
    formData.append('summary', conv.summary);
    formData.append('date', conv.date);

    try {
      const response = await fetch('/api/import', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Server returned status ${response.status}`);
      }

      const data = await response.json();
      result.idMap.conversations[conv.legacyId] = data.serverId;
      result.perRecordStatus.push({
        legacyId: conv.legacyId,
        entityType: 'conversation',
        status: data.status || 'imported',
      });
      importedConvCount++;
      result.actualCount++;
    } catch (err) {
      result.perRecordStatus.push({
        legacyId: conv.legacyId,
        entityType: 'conversation',
        status: 'error',
        message: err instanceof Error ? err.message : 'Upload failed',
      });
      throw err;
    }
  }

  // 4. Mark account ownership in local storage
  setClaimedAccount(currentUserId);

  onProgress?.({
    phase: 'completed',
    totalPeople,
    importedPeople: importedPeopleCount,
    totalConversations,
    importedConversations: importedConvCount,
    currentEntity: 'Import complete!',
  });

  return result;
}
