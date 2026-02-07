import Dexie, { type EntityTable } from 'dexie';

// Types
export interface Person {
  id?: number;
  name: string;
  relation: string;
  photoBlob: Blob;
  photoUrl?: string; // For displaying in UI
  faceDescriptor?: number[]; // For face recognition
  createdAt: Date;
  updatedAt: Date;
}

export interface Conversation {
  id?: number;
  personId: number;
  rawText: string;
  summary: string; // AI-generated summary
  date: Date;
  createdAt: Date;
}

// Database class
class DementiaDatabase extends Dexie {
  people!: EntityTable<Person, 'id'>;
  conversations!: EntityTable<Conversation, 'id'>;

  constructor() {
    super('DementiaARDatabase');

    this.version(1).stores({
      people: '++id, name, relation, createdAt',
      conversations: '++id, personId, date, createdAt'
    });
  }
}

// Create and export database instance
export const db = new DementiaDatabase();

// Helper functions
export async function addPerson(
  name: string,
  relation: string,
  photoBlob: Blob,
  faceDescriptor?: number[]
): Promise<number> {
  const now = new Date();
  const id = await db.people.add({
    name,
    relation,
    photoBlob,
    faceDescriptor,
    createdAt: now,
    updatedAt: now
  });
  return id as number;
}

export async function updatePerson(
  id: number,
  updates: Partial<Omit<Person, 'id' | 'createdAt'>>
): Promise<void> {
  await db.people.update(id, {
    ...updates,
    updatedAt: new Date()
  });
}

export async function deletePerson(id: number): Promise<void> {
  // Delete all conversations for this person first
  await db.conversations.where('personId').equals(id).delete();
  // Then delete the person
  await db.people.delete(id);
}

export async function getAllPeople(): Promise<Person[]> {
  const people = await db.people.toArray();
  // Convert blobs to URLs for display
  return Promise.all(people.map(async (person) => ({
    ...person,
    photoUrl: URL.createObjectURL(person.photoBlob)
  })));
}

export async function getPersonById(id: number): Promise<Person | undefined> {
  const person = await db.people.get(id);
  if (person) {
    return {
      ...person,
      photoUrl: URL.createObjectURL(person.photoBlob)
    };
  }
  return undefined;
}

export async function addConversation(
  personId: number,
  rawText: string,
  summary: string
): Promise<number> {
  const id = await db.conversations.add({
    personId,
    rawText,
    summary,
    date: new Date(),
    createdAt: new Date()
  });
  return id as number;
}

export async function getConversationsForPerson(
  personId: number
): Promise<Conversation[]> {
  return await db.conversations
    .where('personId')
    .equals(personId)
    .reverse()
    .sortBy('date');
}

export async function getLatestConversation(
  personId: number
): Promise<Conversation | undefined> {
  const conversations = await db.conversations
    .where('personId')
    .equals(personId)
    .reverse()
    .sortBy('date');
  return conversations[0];
}

export async function deleteConversation(id: number): Promise<void> {
  await db.conversations.delete(id);
}

export async function getStats(): Promise<{
  totalPeople: number;
  totalConversations: number;
  recentConversations: Conversation[];
}> {
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
    recentConversations
  };
}
