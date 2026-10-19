import * as faceapi from '@vladmandic/face-api';

export const DESCRIPTOR_MODEL_ID = 'face-api-v1-tiny-landmark';
export const DESCRIPTOR_DIMENSION = 128;

// Shared promise preventing concurrent duplicate downloads
let modelLoadPromise: Promise<boolean> | null = null;
let modelsLoaded = false;

/**
 * Loads face detection, landmark, and recognition models.
 * Reuses a single shared pending promise across all callers.
 * Clears promise on error so explicit user retry works cleanly.
 */
export async function loadFaceDetectionModels(): Promise<boolean> {
  if (modelsLoaded) return true;

  if (modelLoadPromise) {
    return modelLoadPromise;
  }

  modelLoadPromise = (async () => {
    try {
      const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model';

      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
      ]);

      modelsLoaded = true;
      console.log('Face detection, landmark, & recognition models loaded successfully');
      return true;
    } catch (error) {
      console.error('Failed to load face detection models:', error);
      modelsLoaded = false;
      modelLoadPromise = null; // Reset so caller can retry
      return false;
    }
  })();

  return modelLoadPromise;
}

export function areModelsLoaded(): boolean {
  return modelsLoaded;
}

export interface FacePosition {
  x: number; // percentage 0-100
  y: number; // percentage 0-100
  width: number;
  height: number;
}

export interface FaceDetectionResult {
  position: FacePosition;
  descriptor: Float32Array | null;
}

export type EnrollmentExtractionResult = 
  | { status: 'ready'; descriptor: number[]; descriptorModel: string }
  | { status: 'no_face'; descriptor: null; descriptorModel: null; error: string }
  | { status: 'multiple_faces'; descriptor: null; descriptorModel: null; error: string; count: number }
  | { status: 'failed'; descriptor: null; descriptorModel: null; error: string };

/**
 * Extracts a face descriptor for enrollment from a canvas or image.
 * Explicitly distinguishes between zero faces, multiple faces, and model failure.
 */
export async function extractEnrollmentFaceDescriptor(
  source: HTMLCanvasElement | HTMLImageElement
): Promise<EnrollmentExtractionResult> {
  const loaded = await loadFaceDetectionModels();
  if (!loaded) {
    return {
      status: 'failed',
      descriptor: null,
      descriptorModel: null,
      error: 'Face recognition models could not be downloaded. Please check connection and retry.',
    };
  }

  try {
    // Detect all faces first to verify exactly one face is present
    const detections = await faceapi
      .detectAllFaces(source, new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.3 }))
      .withFaceLandmarks(true)
      .withFaceDescriptors();

    if (detections.length === 0) {
      return {
        status: 'no_face',
        descriptor: null,
        descriptorModel: null,
        error: 'No face detected in photo. Please choose a well-lit photo looking directly at the camera.',
      };
    }

    if (detections.length > 1) {
      return {
        status: 'multiple_faces',
        descriptor: null,
        descriptorModel: null,
        count: detections.length,
        error: `Detected ${detections.length} faces. Please select a photo containing only one person.`,
      };
    }

    const singleDetection = detections[0];
    const descriptorArray = Array.from(singleDetection.descriptor);

    if (descriptorArray.length !== DESCRIPTOR_DIMENSION) {
      return {
        status: 'failed',
        descriptor: null,
        descriptorModel: null,
        error: `Unexpected descriptor dimension ${descriptorArray.length} (expected ${DESCRIPTOR_DIMENSION}).`,
      };
    }

    return {
      status: 'ready',
      descriptor: descriptorArray,
      descriptorModel: DESCRIPTOR_MODEL_ID,
    };
  } catch (error) {
    console.error('Error during face extraction:', error);
    return {
      status: 'failed',
      descriptor: null,
      descriptorModel: null,
      error: error instanceof Error ? error.message : 'Unknown face detection failure.',
    };
  }
}

/**
 * Fast single face detection for video stream in AR mode
 */
export async function detectFaceWithDescriptor(video: HTMLVideoElement): Promise<FaceDetectionResult | null> {
  if (!modelsLoaded) return null;

  try {
    const detection = await faceapi
      .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 }))
      .withFaceLandmarks(true)
      .withFaceDescriptor();

    if (detection) {
      const { x, y, width, height } = detection.detection.box;
      const videoWidth = video.videoWidth || video.clientWidth;
      const videoHeight = video.videoHeight || video.clientHeight;

      return {
        position: {
          x: ((x + width) / videoWidth) * 100,
          y: (y / videoHeight) * 100,
          width: (width / videoWidth) * 100,
          height: (height / videoHeight) * 100,
        },
        descriptor: detection.descriptor,
      };
    }

    return null;
  } catch (error) {
    console.error('AR face detection error:', error);
    return null;
  }
}

/**
 * Fast face position detection without descriptor
 */
export async function detectFace(video: HTMLVideoElement): Promise<FacePosition | null> {
  if (!modelsLoaded) return null;

  try {
    const detection = await faceapi.detectSingleFace(
      video,
      new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 })
    );

    if (detection) {
      const { x, y, width, height } = detection.box;
      const videoWidth = video.videoWidth || video.clientWidth;
      const videoHeight = video.videoHeight || video.clientHeight;

      return {
        x: ((x + width) / videoWidth) * 100,
        y: (y / videoHeight) * 100,
        width: (width / videoWidth) * 100,
        height: (height / videoHeight) * 100,
      };
    }

    return null;
  } catch (error) {
    console.error('Face detection error:', error);
    return null;
  }
}

/**
 * Compares two face descriptors and returns similarity score (0-1, higher = more similar)
 */
export function compareFaces(
  descriptor1: number[] | Float32Array,
  descriptor2: number[] | Float32Array
): number {
  const d1 = descriptor1 instanceof Float32Array ? descriptor1 : new Float32Array(descriptor1);
  const d2 = descriptor2 instanceof Float32Array ? descriptor2 : new Float32Array(descriptor2);

  const distance = faceapi.euclideanDistance(d1, d2);
  return Math.max(0, 1 - distance);
}

export interface StoredCandidate {
  id: string | number;
  name?: string;
  relation?: string;
  descriptor: number[];
  descriptorModel?: string;
  latestSummary?: string | null;
}

/**
 * Legacy compatibility alias for extractEnrollmentFaceDescriptor
 */
export async function extractFaceDescriptor(
  imageElement: HTMLImageElement | HTMLCanvasElement
): Promise<number[] | null> {
  const result = await extractEnrollmentFaceDescriptor(imageElement);
  return result.status === 'ready' ? result.descriptor : null;
}

/**
 * Find the best matching person from a list of stored gallery candidates.
 * Enforces confidence threshold and gap between top-1 and top-2 candidates to avoid ambiguity.
 */
export function findBestMatch(
  detectedDescriptor: Float32Array,
  storedPeople: StoredCandidate[]
): { personId: any; candidate: StoredCandidate; similarity: number } | null {
  if (storedPeople.length === 0) return null;

  const MATCH_THRESHOLD = 0.42; // Euclidean distance cutoff ~0.58
  const MIN_AMBIGUITY_GAP = 0.05; // Gap between 1st and 2nd best candidate

  let bestCandidate: StoredCandidate | null = null;
  let bestSimilarity = -1;
  let secondSimilarity = -1;

  for (const candidate of storedPeople) {
    if (!candidate.descriptor || candidate.descriptor.length !== DESCRIPTOR_DIMENSION) {
      continue;
    }

    const similarity = compareFaces(detectedDescriptor, candidate.descriptor);

    if (similarity > bestSimilarity) {
      secondSimilarity = bestSimilarity;
      bestSimilarity = similarity;
      bestCandidate = candidate;
    } else if (similarity > secondSimilarity) {
      secondSimilarity = similarity;
    }
  }

  // Check if best meets threshold
  if (bestCandidate && bestSimilarity >= MATCH_THRESHOLD) {
    // If there is another candidate close to the best match, treat as ambiguous
    if (secondSimilarity > 0 && bestSimilarity - secondSimilarity < MIN_AMBIGUITY_GAP) {
      console.warn('Ambiguous face match detected; rejecting ambiguous candidate');
      return null;
    }
    return { personId: bestCandidate.id, candidate: bestCandidate, similarity: bestSimilarity };
  }

  return null;
}
