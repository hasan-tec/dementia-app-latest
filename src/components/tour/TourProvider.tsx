/**
 * Tour Provider & Context
 * Manages active step targeting, DOM measurements, event-driven step progression,
 * and user progress persistence.
 */

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { MAIN_TOUR_STEPS, type TourStep } from '../../features/onboarding/steps';
import { tourEvents } from '../../features/onboarding/events';
import { loadUserTourProgress, saveUserTourProgress, type TourStatus } from '../../features/onboarding/progress';
import { useAuth } from '../../context/AuthContext';
import { TourCallout } from './TourCallout';
import { TourSpotlight } from './TourSpotlight';

export interface TourContextType {
  status: TourStatus;
  currentStepIndex: number;
  currentStep: TourStep | null;
  startTour: () => void;
  pauseTour: () => void;
  resumeTour: () => void;
  skipTour: () => void;
  nextStep: () => void;
  prevStep: () => void;
}

const TourContext = createContext<TourContextType | undefined>(undefined);

export function TourProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [status, setStatus] = useState<TourStatus>('idle');
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);

  const currentStep = status === 'active' ? MAIN_TOUR_STEPS[currentStepIndex] ?? null : null;
  const targetElementRef = useRef<Element | null>(null);

  // 1. Restore tour progress when user signs in
  useEffect(() => {
    if (!user) {
      setStatus('idle');
      return;
    }

    loadUserTourProgress(user.id).then((progress) => {
      if (progress.status === 'idle') {
        // Automatically offer or start tour for new accounts
        setStatus('active');
        setCurrentStepIndex(0);
      } else {
        setStatus(progress.status);
        const idx = MAIN_TOUR_STEPS.findIndex((s) => s.id === progress.stepId);
        if (idx >= 0) setCurrentStepIndex(idx);
      }
    });
  }, [user]);

  // 2. Measure & update target bounding box
  const updateTargetMeasurements = useCallback(() => {
    if (!currentStep) {
      setTargetRect(null);
      return;
    }

    const element = document.querySelector(currentStep.targetSelector);
    targetElementRef.current = element;

    if (element) {
      const rect = element.getBoundingClientRect();
      setTargetRect(rect);
    } else {
      setTargetRect(null);
    }
  }, [currentStep]);

  // Check measurements on route change, scroll, resize, or DOM mutations
  useEffect(() => {
    if (status !== 'active') return;

    updateTargetMeasurements();

    const handleResizeOrScroll = () => {
      updateTargetMeasurements();
    };

    window.addEventListener('resize', handleResizeOrScroll, { passive: true });
    window.addEventListener('scroll', handleResizeOrScroll, { passive: true, capture: true });

    // Polling interval in case target takes time to mount (e.g. modals, async lists)
    const interval = setInterval(updateTargetMeasurements, 250);

    return () => {
      window.removeEventListener('resize', handleResizeOrScroll);
      window.removeEventListener('scroll', handleResizeOrScroll, { capture: true });
      clearInterval(interval);
    };
  }, [status, updateTargetMeasurements]);

  // 3. Scroll target into view if outside viewport
  useEffect(() => {
    if (targetElementRef.current && status === 'active') {
      targetElementRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'nearest',
      });
    }
  }, [currentStepIndex, status]);

  // 4. Progress handlers
  const saveState = useCallback(
    (newStatus: TourStatus, stepIdx: number) => {
      setStatus(newStatus);
      setCurrentStepIndex(stepIdx);
      if (user) {
        const step = MAIN_TOUR_STEPS[stepIdx];
        saveUserTourProgress(user.id, {
          status: newStatus,
          stepId: step ? step.id : 'completed',
        });
      }
    },
    [user]
  );

  const startTour = useCallback(() => {
    saveState('active', 0);
    navigate('/');
  }, [navigate, saveState]);

  const pauseTour = useCallback(() => {
    saveState('paused', currentStepIndex);
  }, [currentStepIndex, saveState]);

  const resumeTour = useCallback(() => {
    saveState('active', currentStepIndex);
  }, [currentStepIndex, saveState]);

  const skipTour = useCallback(() => {
    saveState('skipped', currentStepIndex);
  }, [currentStepIndex, saveState]);

  const nextStep = useCallback(() => {
    if (currentStepIndex < MAIN_TOUR_STEPS.length - 1) {
      saveState('active', currentStepIndex + 1);
    } else {
      saveState('completed', currentStepIndex);
    }
  }, [currentStepIndex, saveState]);

  const prevStep = useCallback(() => {
    if (currentStepIndex > 0) {
      saveState('active', currentStepIndex - 1);
    }
  }, [currentStepIndex, saveState]);

  // 5. Escape key to pause tour
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && status === 'active') {
        pauseTour();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pauseTour, status]);

  // 6. Listen for real application events to auto-advance
  useEffect(() => {
    if (status !== 'active' || !currentStep) return;

    if (currentStep.autoAdvanceEvent === 'person:save-success') {
      const unsub = tourEvents.on('person:save-success', () => {
        nextStep();
      });
      return unsub;
    }

    if (currentStep.autoAdvanceEvent === 'conversation:save-success') {
      const unsub = tourEvents.on('conversation:save-success', () => {
        nextStep();
      });
      return unsub;
    }
  }, [currentStep, nextStep, status]);

  // Auto-advance if navigating to the expected target route for step 1 or 11
  useEffect(() => {
    if (status !== 'active') return;

    if (currentStep?.id === 'step-nav-people' && location.pathname === '/people') {
      // User clicked nav-people and reached /people!
      setTimeout(nextStep, 150);
    } else if (currentStep?.id === 'step-nav-ar' && location.pathname === '/ar') {
      setTimeout(nextStep, 150);
    }
  }, [currentStep, location.pathname, nextStep, status]);

  return (
    <TourContext.Provider
      value={{
        status,
        currentStepIndex,
        currentStep,
        startTour,
        pauseTour,
        resumeTour,
        skipTour,
        nextStep,
        prevStep,
      }}
    >
      {children}

      {status === 'active' && currentStep && (
        <>
          <TourSpotlight rect={targetRect} />
          <TourCallout
            step={currentStep}
            targetRect={targetRect}
            totalSteps={MAIN_TOUR_STEPS.length}
            onNext={nextStep}
            onPrev={prevStep}
            onSkip={skipTour}
            onPause={pauseTour}
          />
        </>
      )}
    </TourContext.Provider>
  );
}

export function useTour(): TourContextType {
  const context = useContext(TourContext);
  if (!context) {
    throw new Error('useTour must be used within a TourProvider');
  }
  return context;
}
