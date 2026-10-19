/**
 * AR Overlay Positioning & Coordinate Transform
 * Accurately maps video intrinsic coordinates to container rendered coordinates
 * accounting for object-fit: cover cropping, aspect ratios, and mirrored video.
 */

export interface RenderedPosition {
  x: number; // percentage (0-100)
  y: number; // percentage (0-100)
}

/**
 * Calculates rendered coordinates inside a container with `object-fit: cover` and optional mirror transform.
 */
export function calculateRenderedOverlayPosition(
  box: { x: number; y: number; width: number; height: number },
  videoElement: HTMLVideoElement,
  isMirrored = true
): RenderedPosition {
  const videoWidth = videoElement.videoWidth || 1280;
  const videoHeight = videoElement.videoHeight || 720;
  const containerWidth = videoElement.clientWidth || window.innerWidth;
  const containerHeight = videoElement.clientHeight || window.innerHeight;

  const videoAspect = videoWidth / videoHeight;
  const containerAspect = containerWidth / containerHeight;

  let scale = 1;
  let offsetX = 0;
  let offsetY = 0;

  if (containerAspect > videoAspect) {
    // Container is wider than video: cropped top & bottom
    scale = containerWidth / videoWidth;
    offsetY = (containerHeight - videoHeight * scale) / 2;
  } else {
    // Container is taller than video: cropped left & right
    scale = containerHeight / videoHeight;
    offsetX = (containerWidth - videoWidth * scale) / 2;
  }

  // Calculate face center point in intrinsic pixels
  const faceCenterX = box.x + box.width / 2;
  const faceTopY = box.y;

  // Scale and offset
  let screenX = faceCenterX * scale + offsetX;
  const screenY = faceTopY * scale + offsetY;

  // If front camera is mirrored via CSS scaleX(-1)
  if (isMirrored) {
    screenX = containerWidth - screenX;
  }

  // Convert to percentages and offset slightly to place badge neatly next to the face
  let pctX = ((screenX + 30) / containerWidth) * 100;
  let pctY = ((screenY - 10) / containerHeight) * 100;

  // Clamp within visible view bounds so card never gets clipped offscreen
  pctX = Math.max(8, Math.min(78, pctX));
  pctY = Math.max(10, Math.min(80, pctY));

  return { x: pctX, y: pctY };
}
