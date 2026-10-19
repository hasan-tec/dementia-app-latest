/**
 * Validation utility functions enforcing boundary constraints across all endpoints.
 */

export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  errors?: Record<string, string>;
}

export function validateUUID(id: unknown): boolean {
  if (typeof id !== 'string') return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
}

export function validatePersonInput(input: {
  name?: unknown;
  relation?: unknown;
  descriptor?: unknown;
  descriptorModel?: unknown;
}): ValidationResult<{
  name: string;
  relation: string;
  descriptor?: number[];
  descriptorModel?: string;
}> {
  const errors: Record<string, string> = {};

  const name = typeof input.name === 'string' ? input.name.trim() : '';
  if (!name) {
    errors.name = 'Name is required.';
  } else if (name.length > 120) {
    errors.name = 'Name must not exceed 120 characters.';
  }

  const relation = typeof input.relation === 'string' ? input.relation.trim() : '';
  if (!relation) {
    errors.relation = 'Relation is required.';
  } else if (relation.length > 80) {
    errors.relation = 'Relation must not exceed 80 characters.';
  }

  let descriptor: number[] | undefined = undefined;
  let descriptorModel: string | undefined = undefined;

  if (input.descriptor !== undefined && input.descriptor !== null) {
    if (!Array.isArray(input.descriptor)) {
      errors.descriptor = 'Face descriptor must be an array.';
    } else if (input.descriptor.length !== 128) {
      errors.descriptor = `Face descriptor must have exactly 128 values (received ${input.descriptor.length}).`;
    } else {
      const allFinite = input.descriptor.every(v => typeof v === 'number' && Number.isFinite(v));
      if (!allFinite) {
        errors.descriptor = 'Face descriptor contains non-numeric or non-finite values.';
      } else {
        descriptor = input.descriptor as number[];
      }
    }

    if (!input.descriptorModel || typeof input.descriptorModel !== 'string' || !input.descriptorModel.trim()) {
      errors.descriptorModel = 'Descriptor model identifier is required when descriptor is provided.';
    } else {
      descriptorModel = input.descriptorModel.trim();
    }
  }

  if (Object.keys(errors).length > 0) {
    return { success: false, errors };
  }

  return {
    success: true,
    data: { name, relation, descriptor, descriptorModel }
  };
}

export function validateConversationInput(input: {
  rawText?: unknown;
  mode?: unknown;
  manualSummary?: unknown;
}): ValidationResult<{
  rawText: string;
  mode: 'ai' | 'manual';
  manualSummary?: string;
}> {
  const errors: Record<string, string> = {};

  const rawText = typeof input.rawText === 'string' ? input.rawText.trim() : '';
  if (!rawText) {
    errors.rawText = 'Conversation notes or transcript is required.';
  } else if (rawText.length > 10000) {
    errors.rawText = 'Conversation text must not exceed 10,000 characters.';
  }

  const mode = input.mode === 'manual' ? 'manual' : input.mode === 'ai' ? 'ai' : null;
  if (!mode) {
    errors.mode = "Mode must be either 'ai' or 'manual'.";
  }

  let manualSummary: string | undefined = undefined;
  if (mode === 'manual') {
    const summary = typeof input.manualSummary === 'string' ? input.manualSummary.trim() : '';
    if (!summary) {
      errors.manualSummary = 'Manual summary is required when mode is manual.';
    } else if (summary.length > 300) {
      errors.manualSummary = 'Summary must not exceed 300 characters.';
    } else {
      manualSummary = summary;
    }
  }

  if (Object.keys(errors).length > 0) {
    return { success: false, errors };
  }

  return {
    success: true,
    data: { rawText, mode: mode!, manualSummary }
  };
}

export const MAX_PHOTO_BYTES = 5 * 1024 * 1024; // 5 MiB
export const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export function validatePhotoFile(file: {
  size: number;
  type: string;
}): { valid: boolean; error?: string } {
  if (file.size > MAX_PHOTO_BYTES) {
    return { valid: false, error: 'Photo exceeds maximum allowed size of 5 MiB.' };
  }
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return { valid: false, error: 'Only JPEG, PNG, and WebP images are supported.' };
  }
  return { valid: true };
}
