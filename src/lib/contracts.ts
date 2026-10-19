/**
 * Shared Data Contracts
 * Defined according to Muzzamil Implementation Playbook (Section 5).
 * Shared boundary between client, server route handlers, and AR subsystem.
 */

export type RecognitionStatus = 
  | 'unprocessed' 
  | 'ready' 
  | 'failed' 
  | 'no_face' 
  | 'multiple_faces' 
  | 'unverified';

export type SummarySource = 'ai' | 'manual' | 'fallback';

export interface PersonListItem {
  id: string; // UUID
  name: string;
  relation: string;
  photoUrl: string | null; // Signed 5-minute URL
  recognitionStatus: RecognitionStatus;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}

export interface PersonDetail extends PersonListItem {
  hasDescriptor: boolean;
  descriptorModel: string | null;
}

export interface ConversationRecord {
  id: string; // UUID
  personId: string; // UUID
  rawText: string;
  summary: string;
  summarySource: SummarySource;
  date: string; // ISO 8601
  createdAt: string; // ISO 8601
}

export interface RecognitionPerson {
  id: string; // UUID
  name: string;
  relation: string;
  descriptor: number[]; // 128-element float array
  descriptorModel: string;
  latestSummary: string | null; // Latest conversation summary or null
}

export interface ARBootstrapResponse {
  people: RecognitionPerson[];
  datasetVersion: string; // Hash or timestamp derived from people & conversations
}

export interface CreateConversationInput {
  rawText: string;
  mode: 'ai' | 'manual';
  manualSummary?: string;
}

export interface CreateConversationResponse {
  conversation: ConversationRecord;
  summarySource: SummarySource;
}

export interface DashboardResponse {
  counts: {
    peopleCount: number;
    conversationsCount: number;
  };
  recentConversations: (ConversationRecord & { personName: string })[];
  peoplePreview: PersonListItem[];
}

export interface LegacyImportManifest {
  sourceId: string;
  schemaVersion: number;
  people: {
    legacyId: string;
    name: string;
    relation: string;
    photoFile?: string; // filename in archive
    descriptor?: number[];
    descriptorModel?: string;
  }[];
  conversations: {
    legacyId: string;
    personLegacyId: string;
    rawText: string;
    summary: string;
    date: string;
    createdAt: string;
  }[];
}

export interface ImportResult {
  sourceId: string;
  idMap: {
    people: Record<string, string>; // legacyId -> server UUID
    conversations: Record<string, string>; // legacyId -> server UUID
  };
  perRecordStatus: {
    legacyId: string;
    entityType: 'person' | 'conversation';
    status: 'imported' | 'skipped' | 'conflict' | 'error';
    message?: string;
  }[];
  expectedCount: number;
  actualCount: number;
}

export interface OnboardingProgress {
  tourId: string;
  version: number;
  stepId: string;
  status: 'in_progress' | 'completed' | 'skipped';
  updatedAt: string;
}

export interface ApiErrorResponse {
  error: {
    code: 
      | 'BAD_REQUEST'
      | 'UNAUTHORIZED'
      | 'NOT_FOUND'
      | 'CONFLICT'
      | 'PAYLOAD_TOO_LARGE'
      | 'UNPROCESSABLE_ENTITY'
      | 'RATE_LIMITED'
      | 'SERVICE_UNAVAILABLE'
      | 'INTERNAL_ERROR';
    message: string;
    fieldErrors?: Record<string, string>;
  };
}
