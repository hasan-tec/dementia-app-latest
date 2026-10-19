/**
 * Onboarding Progress Persistence
 * Syncs user tour completion status with Supabase onboarding_progress table
 * with resilient local storage fallback per authenticated account.
 */

import { supabase } from '../../lib/supabase';

export type TourStatus = 'idle' | 'active' | 'paused' | 'skipped' | 'completed';

export interface OnboardingState {
  tourId: string;
  version: number;
  stepId: string;
  status: TourStatus;
  updatedAt: string;
}

const DEFAULT_TOUR_ID = 'main-onboarding-v1';
const TOUR_VERSION = 1;

function getLocalStorageKey(userId: string): string {
  return `dementia_tour_progress_${userId}`;
}

/**
 * Loads the current user's tour progress
 */
export async function loadUserTourProgress(userId: string): Promise<OnboardingState> {
  // 1. Try fetching from Supabase table
  try {
    const { data, error } = await supabase
      .from('onboarding_progress')
      .select('tour_id, version, step_id, status, updated_at')
      .eq('owner_id', userId)
      .eq('tour_id', DEFAULT_TOUR_ID)
      .maybeSingle();

    if (!error && data) {
      const state: OnboardingState = {
        tourId: data.tour_id,
        version: data.version,
        stepId: data.step_id,
        status: data.status as TourStatus,
        updatedAt: data.updated_at,
      };
      // Keep local backup in sync
      localStorage.setItem(getLocalStorageKey(userId), JSON.stringify(state));
      return state;
    }
  } catch (err) {
    console.warn('[TourProgress] Error querying Supabase onboarding table:', err);
  }

  // 2. Fallback to localStorage
  try {
    const cached = localStorage.getItem(getLocalStorageKey(userId));
    if (cached) {
      return JSON.parse(cached) as OnboardingState;
    }
  } catch {
    // Ignore parse errors
  }

  // Default initial state
  return {
    tourId: DEFAULT_TOUR_ID,
    version: TOUR_VERSION,
    stepId: 'step-nav-people',
    status: 'idle',
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Persists the user's tour progress to Supabase and localStorage
 */
export async function saveUserTourProgress(
  userId: string,
  progress: Partial<OnboardingState>
): Promise<void> {
  const current = await loadUserTourProgress(userId);
  const updated: OnboardingState = {
    ...current,
    ...progress,
    updatedAt: new Date().toISOString(),
  };

  // 1. Save locally immediately
  try {
    localStorage.setItem(getLocalStorageKey(userId), JSON.stringify(updated));
  } catch {
    // Ignore storage quota
  }

  // 2. Persist to Supabase
  try {
    await supabase.from('onboarding_progress').upsert(
      {
        owner_id: userId,
        tour_id: updated.tourId,
        version: updated.version,
        step_id: updated.stepId,
        status: updated.status,
        updated_at: updated.updatedAt,
      },
      { onConflict: 'owner_id,tour_id' }
    );
  } catch (err) {
    console.warn('[TourProgress] Failed to save progress to Supabase:', err);
  }
}
