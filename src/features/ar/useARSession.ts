/**
 * AR Session Lifecycle Hook
 * Coordinates concurrent startup (camera + models + gallery data),
 * manages cancellable resources, stops media tracks safely (even on late resolution),
 * and handles React StrictMode mount/unmount cleanly.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { loadFaceDetectionModels, type StoredCandidate } from '../../services/faceDetection';
import { RecognitionLoop, type ActiveMatch } from './recognition-loop';
import type { RenderedPosition } from './overlay-position';

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
  overlayRef: React.RefObject<HTMLDivElement | null>;
}

export function useARSession({
  loadGallery,
  videoRef,
  overlayRef,
}: UseARSessionOptions) {
  const [sessionState, setSessionState] = useState<ARSessionState>('idle');
  const [activeMatch, setActiveMatch] = useState<ActiveMatch | null>(null);
  const [statusMessage, setStatusMessage] = useState('Initializing...');
  const [isTracking, setIsTracking] = useState(false);

  // Lifecycle control refs
  const generationRef = useRef(0);
  const isMountedRef = useRef(true);
  const streamRef = useRef<MediaStream | null>(null);
  const recognitionLoopRef = useRef<RecognitionLoop | null>(null);

  // Smooth position animation ref
  const targetPosRef = useRef<RenderedPosition>({ x: 50, y: 30 });
  const currentPosRef = useRef<RenderedPosition>({ x: 50, y: 30 });
  const animFrameRef = useRef<number | null>(null);

  /**
   * Smoothly interpolates overlay position without triggering component rerender
   */
  const startPositionAnimation = useCallback(() => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);

    const step = () => {
      currentPosRef.current.x += (targetPosRef.current.x - currentPosRef.current.x) * 0.18;
      currentPosRef.current.y += (targetPosRef.current.y - currentPosRef.current.y) * 0.18;

      if (overlayRef.current) {
        const viewportWidth = window.innerWidth;
        const isMobile = viewportWidth <= 768;

        if (isMobile) {
          // On mobile screens, center overlay horizontally in the middle of the screen
          const overlayWidth = overlayRef.current.offsetWidth || 0;
          const centeredXPx = Math.max(0, Math.round((viewportWidth - overlayWidth) / 2));
          const clampedY = Math.max(14, Math.min(60, currentPosRef.current.y));

          overlayRef.current.style.transform = `translate3d(${centeredXPx}px, ${clampedY}vh, 0)`;
        } else {
          // Desktop: follow face X position with right edge clamping
          const overlayWidth = overlayRef.current.offsetWidth || 0;
          const xPx = (currentPosRef.current.x / 100) * viewportWidth;
          const margin = 24; // right margin in px
          const maxXPx = viewportWidth - overlayWidth - margin;
          const clampedXPx = Math.min(xPx, Math.max(0, maxXPx));

          overlayRef.current.style.transform = `translate3d(${clampedXPx}px, ${currentPosRef.current.y}vh, 0)`;
        }
      }

      animFrameRef.current = requestAnimationFrame(step);
    };

    animFrameRef.current = requestAnimationFrame(step);
  }, [overlayRef]);

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
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setActiveMatch(null);
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

    // 2. Await camera preview first for fastest perceived visual feedback
    const cameraResult = await cameraPromise;

    // Check if session was stopped/invalidated while camera was loading
    if (!isMountedRef.current || generationRef.current !== generation) {
      if (cameraResult.success && cameraResult.stream) {
        cameraResult.stream.getTracks().forEach(t => t.stop());
      }
      return;
    }

    if (!cameraResult.success) {
      const err = cameraResult.error;
      const isDenied = err instanceof Error && (err.name === 'NotAllowedError' || err.name === 'NotFoundError');
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
          return; // Interrupted by remount
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
        onMatch: (match) => {
          if (generationRef.current === generation) {
            setActiveMatch(match);
            setIsTracking(true);
          }
        },
        onUnknownFace: () => {
          if (generationRef.current === generation) {
            setActiveMatch(null);
            setIsTracking(true);
          }
        },
        onNoFace: () => {
          if (generationRef.current === generation) {
            setActiveMatch(null);
            setIsTracking(false);
          }
        },
        onStatusChange: (status) => {
          if (generationRef.current === generation) {
            setStatusMessage(status);
          }
        },
        onPositionUpdate: (pos) => {
          targetPosRef.current = pos;
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
    activeMatch,
    statusMessage,
    isTracking,
    startSession,
    stopSession,
  };
}
