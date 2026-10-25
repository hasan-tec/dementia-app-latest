/**
 * Tour Provider & Context
 * Manages active step targeting, DOM measurements, interactive step progression,
 * cross-route navigation, modal coordination, and user progress persistence.
 */

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { MAIN_TOUR_STEPS, type TourStep } from '../../features/onboarding/steps';
import { tourEvents } from '../../features/onboarding/events';
import { loadUserTourProgress, saveUserTourProgress, type TourStatus } from '../../features/onboarding/progress';
import { getAllPeople, addPerson } from '../../db/database';
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
  goToStep: (stepIdx: number) => void;
}

const TourContext = createContext<TourContextType | undefined>(undefined);

/**
 * Ensures a valid registered person exists so steps 7-10 never stall.
 */
async function getOrCreateTourPersonId(): Promise<string | number> {
  try {
    const people = await getAllPeople();
    if (people && people.length > 0 && people[0].id) {
      return people[0].id;
    }

    // Generate a default demo person
    const canvas = document.createElement('canvas');
    canvas.width = 100;
    canvas.height = 100;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#0071e3';
      ctx.beginPath();
      ctx.arc(50, 50, 50, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 44px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('S', 50, 52);
    }
    const blob = await new Promise<Blob>((resolve) =>
      canvas.toBlob((b) => resolve(b || new Blob()), 'image/png')
    );
    return await addPerson('Sarah', 'Daughter', blob);
  } catch (err) {
    console.error('Error ensuring tour person exists:', err);
    return '1';
  }
}

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
      if (rect.width > 0 && rect.height > 0) {
        setTargetRect(rect);
        return;
      }
    }
    setTargetRect(null);
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

    // Periodic check in case target takes time to mount (modals, list rendering)
    const interval = setInterval(updateTargetMeasurements, 250);

    return () => {
      window.removeEventListener('resize', handleResizeOrScroll);
      window.removeEventListener('scroll', handleResizeOrScroll, { capture: true });
      clearInterval(interval);
    };
  }, [status, updateTargetMeasurements]);

  // Rapid measurement retries on step change or route transition
  useEffect(() => {
    if (status !== 'active') return;

    updateTargetMeasurements();
    const t1 = setTimeout(updateTargetMeasurements, 60);
    const t2 = setTimeout(updateTargetMeasurements, 180);
    const t3 = setTimeout(updateTargetMeasurements, 450);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [currentStepIndex, location.pathname, status, updateTargetMeasurements]);

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

  const goToStep = useCallback(
    async (stepIdx: number) => {
      const targetStep = MAIN_TOUR_STEPS[stepIdx];
      if (!targetStep) return;

      // Handle precise routing requirements
      if (targetStep.id === 'step-nav-people') {
        if (location.pathname !== '/') navigate('/');
      } else if (
        targetStep.id === 'step-people-add' ||
        targetStep.id === 'step-person-photo' ||
        targetStep.id === 'step-person-name' ||
        targetStep.id === 'step-person-relation' ||
        targetStep.id === 'step-person-save' ||
        targetStep.id === 'step-person-view'
      ) {
        if (location.pathname !== '/people') {
          navigate('/people');
        }
      } else if (
        targetStep.id === 'step-conversation-add' ||
        targetStep.id === 'step-conversation-text' ||
        targetStep.id === 'step-conversation-save'
      ) {
        if (!location.pathname.startsWith('/people/') && !location.pathname.startsWith('/person/')) {
          const personId = await getOrCreateTourPersonId();
          navigate(`/people/${personId}`);
        }
      } else if (
        targetStep.id === 'step-ar-status' ||
        targetStep.id === 'step-ar-camera-toggle' ||
        targetStep.id === 'step-ar-home'
      ) {
        if (location.pathname !== '/ar') {
          navigate('/ar');
        }
      } else if (targetStep.id === 'step-help-replay') {
        if (location.pathname === '/ar') {
          navigate('/');
        }
      }

      saveState('active', stepIdx);
    },
    [location.pathname, navigate, saveState]
  );

  const nextStep = useCallback(() => {
    if (currentStepIndex < MAIN_TOUR_STEPS.length - 1) {
      goToStep(currentStepIndex + 1);
    } else {
      saveState('completed', currentStepIndex);
    }
  }, [currentStepIndex, goToStep, saveState]);

  const prevStep = useCallback(() => {
    if (currentStepIndex > 0) {
      goToStep(currentStepIndex - 1);
    }
  }, [currentStepIndex, goToStep]);

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

    // Modal open event auto-advance (when user clicks + Add Person or + Add Conversation)
    const unsubModalOpen = tourEvents.on('modal:open', (data) => {
      if (currentStep.id === 'step-people-add' && data.modalId === 'add-person') {
        nextStep();
      } else if (currentStep.id === 'step-conversation-add' && data.modalId === 'add-conversation') {
        nextStep();
      }
    });

    // Modal close event sync (when user cancels modal, step back gracefully)
    const unsubModalClose = tourEvents.on('modal:close', (data) => {
      if (
        ['step-person-photo', 'step-person-name', 'step-person-relation', 'step-person-save'].includes(currentStep.id) &&
        data.modalId === 'add-person'
      ) {
        const step2Idx = MAIN_TOUR_STEPS.findIndex((s) => s.id === 'step-people-add');
        if (step2Idx >= 0) goToStep(step2Idx);
      } else if (
        ['step-conversation-text', 'step-conversation-save'].includes(currentStep.id) &&
        data.modalId === 'add-conversation'
      ) {
        const step8Idx = MAIN_TOUR_STEPS.findIndex((s) => s.id === 'step-conversation-add');
        if (step8Idx >= 0) goToStep(step8Idx);
      }
    });

    return () => {
      unsubModalOpen();
      unsubModalClose();
    };
  }, [currentStep, goToStep, nextStep, status]);

  // 7. Auto-advance when user performs navigation directly
  useEffect(() => {
    if (status !== 'active') return;

    if (currentStep?.id === 'step-nav-people' && location.pathname === '/people') {
      setTimeout(nextStep, 150);
    } else if (currentStep?.id === 'step-nav-ar' && location.pathname === '/ar') {
      setTimeout(nextStep, 150);
    } else if (
      currentStep?.id === 'step-person-view' &&
      (location.pathname.startsWith('/people/') || location.pathname.startsWith('/person/'))
    ) {
      setTimeout(nextStep, 150);
    } else if (currentStep?.id === 'step-ar-home' && location.pathname === '/') {
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
        goToStep,
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
            onNavigate={(path) => navigate(path)}
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
