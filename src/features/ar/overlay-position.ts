/**
 * AR Overlay Positioning & Coordinate Transform
 * Accurately maps video intrinsic coordinates to container rendered coordinates
 * accounting for object-fit: cover cropping, aspect ratios, and mirrored video.
 */

export interface RenderedPosition {
  x: number; // percentage (0-100) or px
  y: number; // percentage (0-100) or px
}

export interface ScreenFacePosition {
  faceCenterX: number; // px on screen
  faceBottomY: number; // px on screen
  faceTopY: number; // px on screen
  faceWidth: number; // px on screen
  faceHeight: number; // px on screen
  containerWidth: number;
  containerHeight: number;
}

/**
 * Calculates rendered screen coordinates for a detected face box inside a container
 * with `object-fit: cover`, properly handling mirror transforms and aspect ratios.
 */
export function calculateFaceScreenPosition(
  box: { x: number; y: number; width: number; height: number },
  videoElement: HTMLVideoElement
): ScreenFacePosition {
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
    offsetX = 0;
  } else {
    // Container is taller than video: cropped left & right
    scale = containerHeight / videoHeight;
    offsetX = (containerWidth - videoWidth * scale) / 2;
    offsetY = 0;
  }

  // Check if video is mirrored via CSS scaleX(-1) or matrix transform
  const computedTransform = window.getComputedStyle(videoElement).transform;
  const isMirrored =
    computedTransform.includes('matrix(-1') ||
    videoElement.style.transform.includes('scaleX(-1)');

  let screenBoxX = box.x * scale + offsetX;
  const screenBoxY = box.y * scale + offsetY;
  const screenBoxWidth = box.width * scale;
  const screenBoxHeight = box.height * scale;

  if (isMirrored) {
    screenBoxX = containerWidth - (screenBoxX + screenBoxWidth);
  }

  const faceCenterX = screenBoxX + screenBoxWidth / 2;
  const faceBottomY = screenBoxY + screenBoxHeight;
  const faceTopY = screenBoxY;

  return {
    faceCenterX,
    faceBottomY,
    faceTopY,
    faceWidth: screenBoxWidth,
    faceHeight: screenBoxHeight,
    containerWidth,
    containerHeight,
  };
}

/**
 * Calculates overlay tag target position (X, Y in pixels) near the face with a minimal suitable gap.
 * Centers horizontally under the face, placed directly beneath the chin, or flips above if near bottom edge.
 */
export function calculateOverlayTargetPosition(
  facePos: ScreenFacePosition,
  overlayWidth: number,
  overlayHeight: number,
  gap = 12
): { x: number; y: number } {
  const { faceCenterX, faceBottomY, faceTopY, containerWidth, containerHeight } = facePos;

  // Center horizontally with the face
  let x = faceCenterX - overlayWidth / 2;

  // Position directly below chin with minimal suitable gap
  let y = faceBottomY + gap;

  // If too close to bottom toolbar (bottom toolbar area is ~85px), flip directly above the face
  if (y + overlayHeight > containerHeight - 85) {
    y = faceTopY - overlayHeight - gap;
  }

  // Clamp within visible screen bounds so badges are never cut off
  const minX = 12;
  const maxX = Math.max(minX, containerWidth - overlayWidth - 12);
  const minY = 72; // clear top back button & status pill
  const maxY = Math.max(minY, containerHeight - overlayHeight - 80);

  x = Math.max(minX, Math.min(maxX, x));
  y = Math.max(minY, Math.min(maxY, y));

  return { x, y };
}

/**
 * Legacy compatibility function for calculateRenderedOverlayPosition
 */
export function calculateRenderedOverlayPosition(
  box: { x: number; y: number; width: number; height: number },
  videoElement: HTMLVideoElement,
  _isMirrored = false
): RenderedPosition {
  const facePos = calculateFaceScreenPosition(box, videoElement);
  return {
    x: (facePos.faceCenterX / facePos.containerWidth) * 100,
    y: (facePos.faceBottomY / facePos.containerHeight) * 100,
  };
}
