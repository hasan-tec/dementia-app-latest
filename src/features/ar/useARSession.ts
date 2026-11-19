/**
 * AR Session Lifecycle Hook
 * Coordinates concurrent startup (camera + models + gallery data),
 * manages multi-face tracking and smooth 60fps RAF position interpolation
 * without full-page rerenders.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { loadFaceDetectionModels, type StoredCandidate } from '../../services/faceDetection';
import { RecognitionLoop, type ActiveMatch } from './recognition-loop';
import {
  calculateFaceScreenPosition,
  calculateOverlayTargetPosition,
} from './overlay-position';

export type ARSessionState =
  | 'idle'
  | 'preparing'
  | 'camera_denied'
  | 'loading_models'
  | 'ready'
  | 'paused'
  | 'stopped'
  | 'error';

export interface UseARSessionOptions {
  loadGallery: () => Promise<StoredCandidate[]>;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  overlayRef?: React.RefObject<HTMLDivElement | null>; // Kept for backwards compatibility
}

interface FacePositionState {
  targetX: number;
  targetY: number;
  currentX: number;
  currentY: number;
  lastSeen: number;
}

export function useARSession({
  loadGallery,
  videoRef,
}: UseARSessionOptions) {
  const [sessionState, setSessionState] = useState<ARSessionState>('idle');
  const [activeMatches, setActiveMatches] = useState<ActiveMatch[]>([]);
  const [statusMessage, setStatusMessage] = useState('Initializing...');
  const [isTracking, setIsTracking] = useState(false);

  // Lifecycle control refs
  const generationRef = useRef(0);
  const isMountedRef = useRef(true);
  const streamRef = useRef<MediaStream | null>(null);
  const recognitionLoopRef = useRef<RecognitionLoop | null>(null);

  // Multi-face positions and overlay DOM elements
  const facePositionsRef = useRef<Map<string, FacePositionState>>(new Map());
  const overlayElementsRef = useRef<Map<string, HTMLDivElement>>(new Map());
  const activeIdsRef = useRef<string>('');
  const animFrameRef = useRef<number | null>(null);

  /**
   * Registers a DOM ref for a specific person's floating overlay
   */
  const registerOverlayRef = useCallback((personId: string, el: HTMLDivElement | null) => {
    if (el) {
      overlayElementsRef.current.set(personId, el);
      const pos = facePositionsRef.current.get(personId);
      if (pos) {
        el.style.transform = `translate3d(${Math.round(pos.currentX)}px, ${Math.round(pos.currentY)}px, 0)`;
        el.style.opacity = '1';
      }
    } else {
      overlayElementsRef.current.delete(personId);
    }
  }, []);

  /**
   * Smoothly interpolates overlay positions at 60 FPS using requestAnimationFrame
   */
  const startPositionAnimation = useCallback(() => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);

    const step = () => {
      const now = Date.now();

      facePositionsRef.current.forEach((posState, personId) => {
        // Expire position if not observed in the last 1000ms
        if (now - posState.lastSeen > 1000) {
          return;
        }

        // Smooth exponential interpolation (0.22 factor provides fluid, responsive movement)
        posState.currentX += (posState.targetX - posState.currentX) * 0.22;
        posState.currentY += (posState.targetY - posState.currentY) * 0.22;

        const el = overlayElementsRef.current.get(personId);
        if (el) {
          el.style.transform = `translate3d(${Math.round(posState.currentX)}px, ${Math.round(posState.currentY)}px, 0)`;
          el.style.opacity = '1';
        }
      });

      animFrameRef.current = requestAnimationFrame(step);
    };

    animFrameRef.current = requestAnimationFrame(step);
  }, []);

  /**
   * Stop camera tracks and release resources
   */
  const stopSession = useCallback(() => {
    generationRef.current++; // Invalidate pending async results

    if (recognitionLoopRef.current) {
      recognitionLoopRef.current.stop();
    }

    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    facePositionsRef.current.clear();
    overlayElementsRef.current.clear();
    activeIdsRef.current = '';

    setActiveMatches([]);
    setIsTracking(false);
    setSessionState('stopped');
    setStatusMessage('Camera stopped');
  }, [videoRef]);

  /**
   * Start AR Session: concurrently boots camera, face models, and gallery dataset
   */
  const startSession = useCallback(async () => {
    const generation = ++generationRef.current;
    setSessionState('preparing');
    setStatusMessage('Starting preview...');

    // 1. Kick off concurrent preparation tasks
    const cameraPromise = (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'user',
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        });
        return { success: true as const, stream };
      } catch (err) {
        return { success: false as const, error: err };
      }
    })();

    const modelsPromise = loadFaceDetectionModels();
    const galleryPromise = loadGallery();

    // 2. Await camera preview first for fastest visual feedback
    const cameraResult = await cameraPromise;

    if (!isMountedRef.current || generationRef.current !== generation) {
      if (cameraResult.success && cameraResult.stream) {
        cameraResult.stream.getTracks().forEach((t) => t.stop());
      }
      return;
    }

    if (!cameraResult.success) {
      const err = cameraResult.error;
      const isDenied =
        err instanceof Error &&
        (err.name === 'NotAllowedError' || err.name === 'NotFoundError');
      setSessionState(isDenied ? 'camera_denied' : 'error');
      setStatusMessage(isDenied ? 'Camera access denied' : 'Camera initialization failed');
      return;
    }

    // Attach stream to video element
    const stream = cameraResult.stream;
    streamRef.current = stream;

    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      try {
        await videoRef.current.play();
      } catch (playErr) {
        if (playErr instanceof Error && playErr.name === 'AbortError') {
          return;
        }
      }
    }

    // 3. Await remaining models and gallery data
    setStatusMessage('Loading AI models...');
    const [modelsReady, candidates] = await Promise.all([modelsPromise, galleryPromise]);

    if (!isMountedRef.current || generationRef.current !== generation) {
      return;
    }

    if (!modelsReady) {
      setSessionState('error');
      setStatusMessage('Failed to load recognition models');
      return;
    }

    // 4. Initialize and start Recognition Loop
    if (!recognitionLoopRef.current) {
      recognitionLoopRef.current = new RecognitionLoop({
        onMatchesUpdate: (matches) => {
          if (generationRef.current !== generation) return;

          const videoEl = videoRef.current;
          if (videoEl) {
            // Update target positions for each detected face
            for (const match of matches) {
              const personId = String(match.person.id);
              const facePos = calculateFaceScreenPosition(match.box, videoEl);
              const el = overlayElementsRef.current.get(personId);
              const overlayWidth = el?.offsetWidth || 200;
              const overlayHeight = el?.offsetHeight || 50;

              // 12px minimal suitable gap directly below chin (or above if near bottom)
              const target = calculateOverlayTargetPosition(
                facePos,
                overlayWidth,
                overlayHeight,
                12
              );

              const existing = facePositionsRef.current.get(personId);
              if (existing) {
                existing.targetX = target.x;
                existing.targetY = target.y;
                existing.lastSeen = Date.now();
              } else {
                facePositionsRef.current.set(personId, {
                  targetX: target.x,
                  targetY: target.y,
                  currentX: target.x, // Start directly at the face to avoid flying in
                  currentY: target.y,
                  lastSeen: Date.now(),
                });
              }
            }
          }

          // Update React matches state only if the set of people changed
          const newIds = matches
            .map((m) => m.person.id)
            .sort()
            .join(',');

          if (newIds !== activeIdsRef.current) {
            activeIdsRef.current = newIds;
            setActiveMatches(matches);
            setIsTracking(matches.length > 0);
          }
        },
        onNoFaces: () => {
          if (generationRef.current === generation) {
            facePositionsRef.current.clear();
            activeIdsRef.current = '';
            setActiveMatches([]);
            setIsTracking(false);
          }
        },
        onStatusChange: (status) => {
          if (generationRef.current === generation) {
            setStatusMessage(status);
          }
        },
      });
    }

    recognitionLoopRef.current.setCandidates(candidates);

    if (videoRef.current) {
      recognitionLoopRef.current.start(videoRef.current);
    }

    startPositionAnimation();
    setSessionState('ready');
    setStatusMessage('Scanning...');
  }, [loadGallery, startPositionAnimation, videoRef]);

  // Handle visibility change (pause loop when tab is backgrounded)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        if (recognitionLoopRef.current) recognitionLoopRef.current.stop();
      } else {
        if (sessionState === 'ready' && videoRef.current && recognitionLoopRef.current) {
          recognitionLoopRef.current.start(videoRef.current);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [sessionState, videoRef]);

  // Mount/unmount lifecycle
  useEffect(() => {
    isMountedRef.current = true;
    startSession();

    return () => {
      isMountedRef.current = false;
      stopSession();
    };
  }, [startSession, stopSession]);

  return {
    sessionState,
    activeMatches,
    activeMatch: activeMatches[0] || null, // Backwards compatibility alias
    statusMessage,
    isTracking,
    registerOverlayRef,
    startSession,
    stopSession,
  };
}
