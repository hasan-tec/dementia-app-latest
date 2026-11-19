/**
 * AR Recognition Loop Controller
 * Schedules multi-face recognition, stability tracking, and timeouts without full page rerenders.
 */

import {
  detectAllFacesWithDescriptors,
  matchFacesToCandidates,
  type StoredCandidate,
  type FaceCandidateMatch,
} from '../../services/faceDetection';

export interface ActiveMatch {
  person: StoredCandidate;
  similarity: number;
  box: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface RecognitionLoopCallbacks {
  onMatchesUpdate: (matches: ActiveMatch[]) => void;
  onStatusChange: (status: string) => void;
  onNoFaces: () => void;
}

export class RecognitionLoop {
  private isRunning = false;
  private isInferenceBusy = false;
  private videoElement: HTMLVideoElement | null = null;
  private candidates: StoredCandidate[] = [];
  private callbacks: RecognitionLoopCallbacks;

  private noFaceTimer: number | null = null;
  private loopTimeoutId: number | null = null;

  // Track stability per candidate ID: require at least 2 observations before committing
  private candidateObservationCounts = new Map<string | number, number>();
  private readonly REQUIRED_CONSECUTIVE_OBSERVATIONS = 2;
  private readonly NO_FACE_TIMEOUT_MS = 1000; // Clear matches 1s after all faces disappear

  constructor(callbacks: RecognitionLoopCallbacks) {
    this.callbacks = callbacks;
  }

  public setCandidates(candidates: StoredCandidate[]): void {
    this.candidates = candidates;
  }

  public start(video: HTMLVideoElement): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.videoElement = video;
    this.scheduleNextIteration(50);
  }

  public stop(): void {
    this.isRunning = false;
    this.isInferenceBusy = false;
    if (this.loopTimeoutId) {
      clearTimeout(this.loopTimeoutId);
      this.loopTimeoutId = null;
    }
    if (this.noFaceTimer) {
      clearTimeout(this.noFaceTimer);
      this.noFaceTimer = null;
    }
    this.candidateObservationCounts.clear();
  }

  private scheduleNextIteration(delayMs: number): void {
    if (!this.isRunning) return;
    this.loopTimeoutId = window.setTimeout(() => this.runIteration(), delayMs);
  }

  private async runIteration(): Promise<void> {
    if (!this.isRunning || !this.videoElement) return;

    if (document.hidden || this.videoElement.paused || this.videoElement.ended) {
      this.scheduleNextIteration(300);
      return;
    }

    if (this.isInferenceBusy) {
      this.scheduleNextIteration(100);
      return;
    }

    this.isInferenceBusy = true;

    try {
      const detectedFaces = await detectAllFacesWithDescriptors(this.videoElement);

      if (detectedFaces.length > 0) {
        if (this.noFaceTimer) {
          clearTimeout(this.noFaceTimer);
          this.noFaceTimer = null;
        }

        if (this.candidates.length > 0) {
          const rawMatches: FaceCandidateMatch[] = matchFacesToCandidates(
            detectedFaces,
            this.candidates
          );

          // Update observation counts for stability
          const currentObservedIds = new Set<string | number>();
          const stableMatches: ActiveMatch[] = [];

          for (const m of rawMatches) {
            const id = m.candidate.id;
            currentObservedIds.add(id);
            const count = (this.candidateObservationCounts.get(id) || 0) + 1;
            this.candidateObservationCounts.set(id, count);

            if (count >= this.REQUIRED_CONSECUTIVE_OBSERVATIONS) {
              stableMatches.push({
                person: m.candidate,
                similarity: m.similarity,
                box: m.box,
              });
            }
          }

          // Decrement or clear counts for candidates not observed in this frame
          for (const id of Array.from(this.candidateObservationCounts.keys())) {
            if (!currentObservedIds.has(id)) {
              this.candidateObservationCounts.delete(id);
            }
          }

          if (stableMatches.length > 0) {
            this.callbacks.onMatchesUpdate(stableMatches);

            if (stableMatches.length === 1) {
              const m = stableMatches[0];
              this.callbacks.onStatusChange(
                `Recognized ${m.person.name} (${Math.round(m.similarity * 100)}%)`
              );
            } else {
              const names = stableMatches.map((m) => m.person.name).join(', ');
              this.callbacks.onStatusChange(`Recognized (${stableMatches.length} people: ${names})`);
            }
          } else if (rawMatches.length > 0) {
            // In process of stabilizing
            this.callbacks.onStatusChange('Verifying face...');
          } else {
            // Faces detected, but none match registered candidates
            this.callbacks.onMatchesUpdate([]);
            this.callbacks.onStatusChange(
              detectedFaces.length === 1 ? 'Unknown face' : `${detectedFaces.length} unknown faces`
            );
          }
        } else {
          this.callbacks.onMatchesUpdate([]);
          this.callbacks.onStatusChange('No faces registered');
        }
      } else {
        // No faces detected in this frame
        this.candidateObservationCounts.clear();

        if (!this.noFaceTimer) {
          this.noFaceTimer = window.setTimeout(() => {
            this.callbacks.onNoFaces();
            this.callbacks.onStatusChange('Scanning...');
          }, this.NO_FACE_TIMEOUT_MS);
        }
      }
    } catch (err) {
      console.error('AR recognition iteration error:', err);
    } finally {
      this.isInferenceBusy = false;
      this.scheduleNextIteration(130);
    }
  }
}
