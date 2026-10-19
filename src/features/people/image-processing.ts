/**
 * Image Processing Utilities for Face Enrollment
 * - Bounded inference canvas (max edge 1024px)
 * - Orientation preservation
 * - Object URL / buffer cleanup
 */

export interface ProcessedImage {
  canvas: HTMLCanvasElement;
  blob: Blob;
  previewUrl: string;
  width: number;
  height: number;
}

const MAX_IMAGE_EDGE = 1024; // Benchmark recommendation from Implementation Playbook

/**
 * Loads an image File or Blob safely, scales it to a bounded maximum dimension,
 * and produces both a canvas ready for face-api inference and an optimized Blob for upload.
 */
export async function processEnrollmentImage(file: File | Blob): Promise<ProcessedImage> {
  return new Promise((resolve, reject) => {
    const previewUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      try {
        let { width, height } = img;

        // Calculate bounded aspect ratio preserving dimensions
        if (width > MAX_IMAGE_EDGE || height > MAX_IMAGE_EDGE) {
          if (width > height) {
            height = Math.round((height * MAX_IMAGE_EDGE) / width);
            width = MAX_IMAGE_EDGE;
          } else {
            width = Math.round((width * MAX_IMAGE_EDGE) / height);
            height = MAX_IMAGE_EDGE;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          URL.revokeObjectURL(previewUrl);
          reject(new Error('Failed to create 2D canvas context'));
          return;
        }

        // Draw image honoring dimensions
        ctx.drawImage(img, 0, 0, width, height);

        // Convert canvas to optimized JPEG blob for upload
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              URL.revokeObjectURL(previewUrl);
              reject(new Error('Canvas to Blob conversion failed'));
              return;
            }

            resolve({
              canvas,
              blob,
              previewUrl,
              width,
              height,
            });
          },
          'image/jpeg',
          0.88 // High quality compression
        );
      } catch (err) {
        URL.revokeObjectURL(previewUrl);
        reject(err);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(previewUrl);
      reject(new Error('Failed to load image file. File may be corrupt or an unsupported format.'));
    };

    img.src = previewUrl;
  });
}

/**
 * Releases canvas memory and revokes preview object URL.
 */
export function releaseProcessedImage(processed: ProcessedImage | null): void {
  if (!processed) return;
  try {
    if (processed.previewUrl) {
      URL.revokeObjectURL(processed.previewUrl);
    }
    // Clear canvas dimensions to trigger memory release
    processed.canvas.width = 0;
    processed.canvas.height = 0;
  } catch {
    // Ignore cleanup exceptions
  }
}
