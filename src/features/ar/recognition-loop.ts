/**
 * AR Recognition Loop Controller
 * Manages recognition scheduling, stability thresholds, and timeouts without page-wide rerenders.
 */

import { detectFaceWithDescriptor, findBestMatch, type StoredCandidate } from '../../services/faceDetection';
import { calculateRenderedOverlayPosition, type RenderedPosition } from './overlay-position';

export interface ActiveMatch {
  person: StoredCandidate;
  similarity: number;
}

export interface RecognitionLoopCallbacks {
  onMatch: (match: ActiveMatch) => void;
  onUnknownFace: () => void;
  onNoFace: () => void;
  onStatusChange: (status: string) => void;
  onPositionUpdate: (pos: RenderedPosition) => void;
}

export class RecognitionLoop {
  private isRunning = false;
  private isInferenceBusy = false;
  private videoElement: HTMLVideoElement | null = null;
  private candidates: StoredCandidate[] = [];
  private callbacks: RecognitionLoopCallbacks;

  private noFaceTimer: number | null = null;
  private consecutiveMatches = 0;
  private pendingCandidateId: string | number | null = null;
  private activeCandidateId: string | number | null = null;
  private loopTimeoutId: number | null = null;

  private readonly REQUIRED_CONSECUTIVE_OBSERVATIONS = 2; // Require 2 consecutive frames for stability
  private readonly NO_FACE_TIMEOUT_MS = 1000; // Clear badge 1s after face disappears

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
    this.consecutiveMatches = 0;
    this.pendingCandidateId = null;
    this.activeCandidateId = null;
  }

  private scheduleNextIteration(delayMs: number): void {
    if (!this.isRunning) return;
    this.loopTimeoutId = window.setTimeout(() => this.runIteration(), delayMs);
  }

  private async runIteration(): Promise<void> {
    if (!this.isRunning || !this.videoElement) return;

    // Pause if document is hidden or video not playing
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
      const result = await detectFaceWithDescriptor(this.videoElement);

      if (result) {
        // Clear no-face timeout since a face is visible
        if (this.noFaceTimer) {
          clearTimeout(this.noFaceTimer);
          this.noFaceTimer = null;
        }

        // Calculate smooth position
        const renderedPos = calculateRenderedOverlayPosition(
          result.position,
          this.videoElement,
          true // Assume mirrored front camera
        );
        this.callbacks.onPositionUpdate(renderedPos);

        // Perform face recognition if candidates exist
        if (result.descriptor && this.candidates.length > 0) {
          const matchResult = findBestMatch(result.descriptor, this.candidates);

          if (matchResult) {
            const candidate = matchResult.candidate;

            if (candidate.id === this.pendingCandidateId) {
              this.consecutiveMatches++;
            } else {
              this.pendingCandidateId = candidate.id;
              this.consecutiveMatches = 1;
            }

            // Commit match once observation count is reached
            if (this.consecutiveMatches >= this.REQUIRED_CONSECUTIVE_OBSERVATIONS) {
              if (this.activeCandidateId !== candidate.id) {
                this.activeCandidateId = candidate.id;
                this.callbacks.onMatch({
                  person: candidate,
                  similarity: matchResult.similarity,
                });
                this.callbacks.onStatusChange(`Recognized (${Math.round(matchResult.similarity * 100)}%)`);
              }
            }
          } else {
            // Unrecognized face detected
            this.pendingCandidateId = null;
            this.consecutiveMatches = 0;
            this.callbacks.onUnknownFace();
            this.callbacks.onStatusChange('Unknown face');
          }
        } else if (this.candidates.length === 0) {
          this.callbacks.onStatusChange('No faces registered');
        }
      } else {
        // No face in current frame: start cooldown timer before clearing card
        if (!this.noFaceTimer) {
          this.noFaceTimer = window.setTimeout(() => {
            this.activeCandidateId = null;
            this.pendingCandidateId = null;
            this.consecutiveMatches = 0;
            this.callbacks.onNoFace();
            this.callbacks.onStatusChange('Scanning...');
          }, this.NO_FACE_TIMEOUT_MS);
        }
      }
    } catch (err) {
      console.error('AR recognition iteration error:', err);
    } finally {
      this.isInferenceBusy = false;
      // Schedule next inference pass (approx ~5-8 Hz to balance CPU & responsiveness)
      this.scheduleNextIteration(160);
    }
  }
}
