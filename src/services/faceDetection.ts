import * as faceapi from '@vladmandic/face-api';

let modelsLoaded = false;

export async function loadFaceDetectionModels(): Promise<boolean> {
    if (modelsLoaded) return true;

    try {
        // Load models from CDN (faster than local)
        const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model';

        await Promise.all([
            faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
            faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL),
            faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL), // For face recognition
        ]);

        modelsLoaded = true;
        console.log('Face detection & recognition models loaded');
        return true;
    } catch (error) {
        console.error('Failed to load face detection models:', error);
        return false;
    }
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

/**
 * Detect a face and get its descriptor (embedding) for recognition
 */
export async function detectFaceWithDescriptor(video: HTMLVideoElement): Promise<FaceDetectionResult | null> {
    if (!modelsLoaded) return null;

    try {
        const detection = await faceapi
            .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 }))
            .withFaceLandmarks(true) // Use tiny landmarks
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
        console.error('Face detection error:', error);
        return null;
    }
}

/**
 * Simple face detection without descriptor (faster)
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
 * Extract face descriptor from an image (for storing when adding a person)
 */
export async function extractFaceDescriptor(imageElement: HTMLImageElement): Promise<number[] | null> {
    if (!modelsLoaded) {
        await loadFaceDetectionModels();
    }

    try {
        const detection = await faceapi
            .detectSingleFace(imageElement, new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.3 }))
            .withFaceLandmarks(true)
            .withFaceDescriptor();

        if (detection) {
            // Convert Float32Array to regular array for storage
            return Array.from(detection.descriptor);
        }

        console.warn('No face detected in image');
        return null;
    } catch (error) {
        console.error('Error extracting face descriptor:', error);
        return null;
    }
}

/**
 * Compare two face descriptors and return similarity score (0-1, higher = more similar)
 */
export function compareFaces(descriptor1: number[] | Float32Array, descriptor2: number[] | Float32Array): number {
    const distance = faceapi.euclideanDistance(
        descriptor1 instanceof Float32Array ? descriptor1 : new Float32Array(descriptor1),
        descriptor2 instanceof Float32Array ? descriptor2 : new Float32Array(descriptor2)
    );

    // Convert distance to similarity (0.6 distance threshold is typical)
    // Lower distance = more similar
    // Distance of 0 = perfect match, distance > 0.6 = likely different person
    const similarity = Math.max(0, 1 - distance);
    return similarity;
}

/**
 * Find the best matching person from a list of stored descriptors
 */
export function findBestMatch(
    detectedDescriptor: Float32Array,
    storedPeople: Array<{ id: number; descriptor: number[] }>
): { personId: number; similarity: number } | null {
    if (storedPeople.length === 0) return null;

    let bestMatch = { personId: -1, similarity: 0 };
    const MATCH_THRESHOLD = 0.4; // 0.6 Euclidean distance

    for (const person of storedPeople) {
        const similarity = compareFaces(detectedDescriptor, person.descriptor);
        console.log(`Comparing with person ${person.id}: similarity ${similarity.toFixed(2)}`);


        if (similarity > bestMatch.similarity) {
            bestMatch = { personId: person.id, similarity };
        }
    }

    // Only return if best match meets threshold
    if (bestMatch.similarity >= MATCH_THRESHOLD) {
        return bestMatch;
    }

    return null;
}

