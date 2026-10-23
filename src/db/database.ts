import Dexie, { type EntityTable } from 'dexie';
import { supabase } from '../lib/supabase';

// Types
export interface Person {
  id?: string | number;
  name: string;
  relation: string;
  photoBlob?: Blob;
  photoUrl?: string; // For displaying in UI
  faceDescriptor?: number[]; // For face recognition
  createdAt: Date;
  updatedAt: Date;
}

export interface Conversation {
  id?: string | number;
  personId: string | number;
  rawText: string;
  summary: string; // AI-generated summary
  date: Date;
  createdAt: Date;
}

// Local Dexie Database (Fallback for offline/unauthenticated mode)
class DementiaDatabase extends Dexie {
  people!: EntityTable<Person, 'id'>;
  conversations!: EntityTable<Conversation, 'id'>;

  constructor() {
    super('DementiaARDatabase');

    this.version(1).stores({
      people: '++id, name, relation, createdAt',
      conversations: '++id, personId, date, createdAt',
    });
  }
}

export const db = new DementiaDatabase();

/**
 * Checks for an active authenticated Supabase user session.
 */
async function getAuthenticatedUser() {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.user ?? null;
  } catch {
    return null;
  }
}

/**
 * Converts a Blob to a base64 Data URL for resilient storage.
 */
function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Saves photo: tries Supabase Storage first; falls back to compressed base64 data URL.
 */
async function savePersonPhoto(userId: string, personId: string, photoBlob: Blob): Promise<string> {
  try {
    const fileExt = photoBlob.type === 'image/png' ? 'png' : 'jpg';
    const filePath = `${userId}/${personId}/${Date.now()}.${fileExt}`;
    const { data, error } = await supabase.storage
      .from('person-photos')
      .upload(filePath, photoBlob, {
        contentType: photoBlob.type || 'image/jpeg',
        upsert: true,
      });

    if (!error && data) {
      return filePath;
    }
  } catch (err) {
    console.warn('[Storage] person-photos bucket upload failed, using Data URL fallback:', err);
  }

  // Fallback to storing the image directly in photo_path as Data URL
  return await blobToDataUrl(photoBlob);
}

/**
 * Resolves a stored photo path into a renderable URL.
 */
async function resolvePhotoUrl(photoPath: string | null | undefined): Promise<string | undefined> {
  if (!photoPath) return undefined;
  if (photoPath.startsWith('http://') || photoPath.startsWith('https://') || photoPath.startsWith('data:')) {
    return photoPath;
  }

  try {
    const { data, error } = await supabase.storage
      .from('person-photos')
      .createSignedUrl(photoPath, 60 * 60 * 24 * 7); // 7-day signed URL

    if (!error && data?.signedUrl) {
      return data.signedUrl;
    }
  } catch (err) {
    console.warn('[Storage] Could not create signed URL for photo:', err);
  }

  return undefined;
}

// ---------------------------------------------------------------------------
// Unified Data Access API (Direct Supabase with Dexie fallback)
// ---------------------------------------------------------------------------

export async function addPerson(
  name: string,
  relation: string,
  photoBlob: Blob,
  faceDescriptor?: number[]
): Promise<string | number> {
  const user = await getAuthenticatedUser();

  if (user) {
    const personId = crypto.randomUUID();
    const photoPath = await savePersonPhoto(user.id, personId, photoBlob);

    const hasDescriptor = Array.isArray(faceDescriptor) && faceDescriptor.length === 128;

    const { error } = await supabase.from('people').insert({
      id: personId,
      owner_id: user.id,
      name: name.trim(),
      relation: relation.trim(),
      photo_path: photoPath,
      face_descriptor: hasDescriptor ? faceDescriptor : null,
      descriptor_model: hasDescriptor ? 'face-api-v1-tiny-landmark' : null,
      recognition_status: hasDescriptor ? 'ready' : 'no_face',
    });

    if (error) {
      console.error('[Supabase] Failed to insert person:', error);
      throw new Error(`Failed to save person to Supabase: ${error.message}`);
    }

    return personId;
  }

  // Local Dexie fallback
  const now = new Date();
  const id = await db.people.add({
    name,
    relation,
    photoBlob,
    faceDescriptor,
    createdAt: now,
    updatedAt: now,
  });
  return id as number;
}

export async function updatePerson(
  id: string | number,
  updates: Partial<Omit<Person, 'id' | 'createdAt'>>
): Promise<void> {
  const user = await getAuthenticatedUser();

  if (user && typeof id === 'string') {
    const payload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (updates.name) payload.name = updates.name.trim();
    if (updates.relation) payload.relation = updates.relation.trim();

    const { error } = await supabase
      .from('people')
      .update(payload)
      .eq('id', id)
      .eq('owner_id', user.id);

    if (error) throw new Error(error.message);
    return;
  }

  await db.people.update(id as number, {
    ...updates,
    updatedAt: new Date(),
  });
}

export async function deletePerson(id: string | number): Promise<void> {
  const user = await getAuthenticatedUser();

  if (user && typeof id === 'string') {
    // Delete photo if stored in storage bucket
    const { data: person } = await supabase
      .from('people')
      .select('photo_path')
      .eq('id', id)
      .eq('owner_id', user.id)
      .maybeSingle();

    if (person?.photo_path && !person.photo_path.startsWith('data:')) {
      await supabase.storage.from('person-photos').remove([person.photo_path]).catch(() => {});
    }

    // ON DELETE CASCADE automatically removes child conversations in PostgreSQL
    const { error } = await supabase
      .from('people')
      .delete()
      .eq('id', id)
      .eq('owner_id', user.id);

    if (error) {
      console.error('[Supabase] Failed to delete person:', error);
      throw new Error(error.message);
    }
    return;
  }

  const numId = typeof id === 'number' ? id : parseInt(id, 10);
  await db.conversations.where('personId').equals(numId).delete();
  await db.people.delete(numId);
}

export async function getAllPeople(): Promise<Person[]> {
  const user = await getAuthenticatedUser();

  if (user) {
    // Strictly filter by authenticated user's ID
    const { data, error } = await supabase
      .from('people')
      .select('*')
      .eq('owner_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[Supabase] Failed to load people:', error);
      throw new Error(error.message);
    }

    return Promise.all(
      (data || []).map(async (row) => ({
        id: row.id,
        name: row.name,
        relation: row.relation,
        photoUrl: await resolvePhotoUrl(row.photo_path),
        faceDescriptor: row.face_descriptor || undefined,
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at),
      }))
    );
  }

  const people = await db.people.toArray();
  return Promise.all(
    people.map(async (person) => ({
      ...person,
      photoUrl: person.photoBlob ? URL.createObjectURL(person.photoBlob) : undefined,
    }))
  );
}

export async function getPersonById(id: string | number): Promise<Person | undefined> {
  const user = await getAuthenticatedUser();

  if (user && typeof id === 'string') {
    const { data, error } = await supabase
      .from('people')
      .select('*')
      .eq('id', id)
      .eq('owner_id', user.id)
      .maybeSingle();

    if (error || !data) return undefined;

    return {
      id: data.id,
      name: data.name,
      relation: data.relation,
      photoUrl: await resolvePhotoUrl(data.photo_path),
      faceDescriptor: data.face_descriptor || undefined,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    };
  }

  const numId = typeof id === 'number' ? id : parseInt(id, 10);
  const person = await db.people.get(numId);
  if (person) {
    return {
      ...person,
      photoUrl: person.photoBlob ? URL.createObjectURL(person.photoBlob) : undefined,
    };
  }
  return undefined;
}

export async function addConversation(
  personId: string | number,
  rawText: string,
  summary: string
): Promise<string | number> {
  const user = await getAuthenticatedUser();

  if (user && typeof personId === 'string') {
    const convoId = crypto.randomUUID();
    const { error } = await supabase.from('conversations').insert({
      id: convoId,
      owner_id: user.id,
      person_id: personId,
      raw_text: rawText.trim(),
      summary: summary.trim(),
      summary_source: 'ai',
      date: new Date().toISOString(),
    });

    if (error) {
      console.error('[Supabase] Failed to add conversation:', error);
      throw new Error(error.message);
    }
    return convoId;
  }

  const numPersonId = typeof personId === 'number' ? personId : parseInt(personId, 10);
  const id = await db.conversations.add({
    personId: numPersonId,
    rawText,
    summary,
    date: new Date(),
    createdAt: new Date(),
  });
  return id as number;
}

export async function getConversationsForPerson(
  personId: string | number
): Promise<Conversation[]> {
  const user = await getAuthenticatedUser();

  if (user && typeof personId === 'string') {
    const { data, error } = await supabase
      .from('conversations')
      .select('*')
      .eq('person_id', personId)
      .eq('owner_id', user.id)
      .order('date', { ascending: false });

    if (error) {
      console.error('[Supabase] Failed to load conversations:', error);
      return [];
    }

    return (data || []).map((row) => ({
      id: row.id,
      personId: row.person_id,
      rawText: row.raw_text,
      summary: row.summary,
      date: new Date(row.date),
      createdAt: new Date(row.created_at),
    }));
  }

  const numPersonId = typeof personId === 'number' ? personId : parseInt(personId, 10);
  return await db.conversations
    .where('personId')
    .equals(numPersonId)
    .reverse()
    .sortBy('date');
}

export async function getLatestConversation(
  personId: string | number
): Promise<Conversation | undefined> {
  const user = await getAuthenticatedUser();

  if (user && typeof personId === 'string') {
    const { data, error } = await supabase
      .from('conversations')
      .select('*')
      .eq('person_id', personId)
      .eq('owner_id', user.id)
      .order('date', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) return undefined;

    return {
      id: data.id,
      personId: data.person_id,
      rawText: data.raw_text,
      summary: data.summary,
      date: new Date(data.date),
      createdAt: new Date(data.created_at),
    };
  }

  const numPersonId = typeof personId === 'number' ? personId : parseInt(personId, 10);
  const conversations = await db.conversations
    .where('personId')
    .equals(numPersonId)
    .reverse()
    .sortBy('date');
  return conversations[0];
}

export async function deleteConversation(id: string | number): Promise<void> {
  const user = await getAuthenticatedUser();

  if (user && typeof id === 'string') {
    const { error } = await supabase
      .from('conversations')
      .delete()
      .eq('id', id)
      .eq('owner_id', user.id);

    if (error) throw new Error(error.message);
    return;
  }

  const numId = typeof id === 'number' ? id : parseInt(id, 10);
  await db.conversations.delete(numId);
}

export async function getStats(): Promise<{
  totalPeople: number;
  totalConversations: number;
  recentConversations: Conversation[];
}> {
  const user = await getAuthenticatedUser();

  if (user) {
    const [peopleRes, convosRes, recentRes] = await Promise.all([
      supabase.from('people').select('*', { count: 'exact', head: true }).eq('owner_id', user.id),
      supabase.from('conversations').select('*', { count: 'exact', head: true }).eq('owner_id', user.id),
      supabase.from('conversations').select('*').eq('owner_id', user.id).order('created_at', { ascending: false }).limit(5),
    ]);

    const totalPeople = peopleRes.count ?? 0;
    const totalConversations = convosRes.count ?? 0;
    const recentConversations = (recentRes.data || []).map((row) => ({
      id: row.id,
      personId: row.person_id,
      rawText: row.raw_text,
      summary: row.summary,
      date: new Date(row.date),
      createdAt: new Date(row.created_at),
    }));

    return {
      totalPeople,
      totalConversations,
      recentConversations,
    };
  }

  const totalPeople = await db.people.count();
  const totalConversations = await db.conversations.count();
  const recentConversations = await db.conversations
    .orderBy('createdAt')
    .reverse()
    .limit(5)
    .toArray();

  return {
    totalPeople,
    totalConversations,
    recentConversations,
  };
}

/**
 * Clears local unauthenticated browser Dexie storage so it never bleeds into another account.
 */
export async function clearLocalCache(): Promise<void> {
  try {
    await db.people.clear();
    await db.conversations.clear();
  } catch (err) {
    console.warn('[Cache] Could not clear local Dexie cache:', err);
  }
}

