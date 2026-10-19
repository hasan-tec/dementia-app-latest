/**
 * Face Enrollment State Machine
 * Coordinates image selection, bounding, decoding, face extraction, and generation tracking.
 */

import { processEnrollmentImage, releaseProcessedImage, type ProcessedImage } from './image-processing';
import { extractEnrollmentFaceDescriptor, type EnrollmentExtractionResult } from '../../services/faceDetection';

export type EnrollmentStep =
  | 'idle'
  | 'processing_image'
  | 'extracting_face'
  | 'ready'
  | 'error_zero_faces'
  | 'error_multiple_faces'
  | 'error_model_failed'
  | 'error_decode_failed';

export interface EnrollmentState {
  step: EnrollmentStep;
  generation: number;
  imageBlob: Blob | null;
  previewUrl: string | null;
  descriptor: number[] | null;
  descriptorModel: string | null;
  errorMessage: string | null;
  allowManualSaveWithoutFace: boolean;
}

export class EnrollmentController {
  private currentGeneration = 0;
  private currentProcessed: ProcessedImage | null = null;
  private onStateChangeCallback: (state: EnrollmentState) => void;

  private state: EnrollmentState = {
    step: 'idle',
    generation: 0,
    imageBlob: null,
    previewUrl: null,
    descriptor: null,
    descriptorModel: null,
    errorMessage: null,
    allowManualSaveWithoutFace: false,
  };

  constructor(onStateChange: (state: EnrollmentState) => void) {
    this.onStateChangeCallback = onStateChange;
  }

  private updateState(partial: Partial<EnrollmentState>): void {
    this.state = { ...this.state, ...partial };
    this.onStateChangeCallback(this.state);
  }

  /**
   * Called when user picks a photo file.
   * Increments generation to invalidate any in-flight background tasks.
   */
  public async handleFileSelected(file: File): Promise<void> {
    const thisGeneration = ++this.currentGeneration;

    // Cleanup previous image
    this.cleanupCurrent();

    this.updateState({
      step: 'processing_image',
      generation: thisGeneration,
      imageBlob: null,
      previewUrl: null,
      descriptor: null,
      descriptorModel: null,
      errorMessage: null,
      allowManualSaveWithoutFace: false,
    });

    let processed: ProcessedImage;
    try {
      processed = await processEnrollmentImage(file);
    } catch (err) {
      if (this.currentGeneration !== thisGeneration) return; // Stale task
      this.updateState({
        step: 'error_decode_failed',
        errorMessage: err instanceof Error ? err.message : 'Failed to decode image file.',
        allowManualSaveWithoutFace: false,
      });
      return;
    }

    if (this.currentGeneration !== thisGeneration) {
      releaseProcessedImage(processed);
      return;
    }

    this.currentProcessed = processed;
    this.updateState({
      step: 'extracting_face',
      imageBlob: processed.blob,
      previewUrl: processed.previewUrl,
    });

    // Face descriptor extraction
    let extractionResult: EnrollmentExtractionResult;
    try {
      extractionResult = await extractEnrollmentFaceDescriptor(processed.canvas);
    } catch (err) {
      if (this.currentGeneration !== thisGeneration) return;
      this.updateState({
        step: 'error_model_failed',
        errorMessage: err instanceof Error ? err.message : 'Model failure during extraction.',
        allowManualSaveWithoutFace: true,
      });
      return;
    }

    if (this.currentGeneration !== thisGeneration) {
      return; // Discard late completion
    }

    switch (extractionResult.status) {
      case 'ready':
        this.updateState({
          step: 'ready',
          descriptor: extractionResult.descriptor,
          descriptorModel: extractionResult.descriptorModel,
          errorMessage: null,
          allowManualSaveWithoutFace: false,
        });
        break;

      case 'no_face':
        this.updateState({
          step: 'error_zero_faces',
          errorMessage: extractionResult.error,
          allowManualSaveWithoutFace: true, // Allow user to proceed with photo only if they choose
        });
        break;

      case 'multiple_faces':
        this.updateState({
          step: 'error_multiple_faces',
          errorMessage: extractionResult.error,
          allowManualSaveWithoutFace: false,
        });
        break;

      case 'failed':
        this.updateState({
          step: 'error_model_failed',
          errorMessage: extractionResult.error,
          allowManualSaveWithoutFace: true,
        });
        break;
    }
  }

  /**
   * Resets the enrollment state and releases buffers
   */
  public reset(): void {
    this.currentGeneration++;
    this.cleanupCurrent();
    this.updateState({
      step: 'idle',
      generation: this.currentGeneration,
      imageBlob: null,
      previewUrl: null,
      descriptor: null,
      descriptorModel: null,
      errorMessage: null,
      allowManualSaveWithoutFace: false,
    });
  }

  private cleanupCurrent(): void {
    if (this.currentProcessed) {
      releaseProcessedImage(this.currentProcessed);
      this.currentProcessed = null;
    }
  }

  public destroy(): void {
    this.reset();
  }
}
