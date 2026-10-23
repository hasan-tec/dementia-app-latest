import React, { useMemo } from 'react';
import type { TourStep } from '../../features/onboarding/steps';
import './Tour.css';

interface TourCalloutProps {
  step: TourStep;
  targetRect: DOMRect | null;
  totalSteps: number;
  onNext: () => void;
  onPrev: () => void;
  onSkip: () => void;
  onPause: () => void;
  onNavigate?: (path: string) => void;
}

export const TourCallout: React.FC<TourCalloutProps> = ({
  step,
  targetRect,
  totalSteps,
  onNext,
  onPrev,
  onSkip,
  onPause,
  onNavigate,
}) => {
  const coords = useMemo(() => {
    const calloutWidth = 320;
    const calloutHeight = 180;
    const offset = 14;

    if (!targetRect) {
      return {
        top: window.innerHeight / 2 - calloutHeight / 2,
        left: window.innerWidth / 2 - calloutWidth / 2,
        placement: 'bottom' as const,
      };
    }

    let top = 0;
    let left = 0;
    let placement = step.placement;

    switch (placement) {
      case 'bottom':
        top = targetRect.bottom + offset;
        left = targetRect.left;
        break;
      case 'top':
        top = targetRect.top - calloutHeight - offset;
        left = targetRect.left;
        break;
      case 'right':
        top = targetRect.top;
        left = targetRect.right + offset;
        break;
      case 'left':
        top = targetRect.top;
        left = targetRect.left - calloutWidth - offset;
        break;
    }

    // Viewport clamping
    left = Math.max(16, Math.min(window.innerWidth - calloutWidth - 16, left));
    top = Math.max(16, Math.min(window.innerHeight - calloutHeight - 16, top));

    return { top, left, placement };
  }, [step.placement, targetRect]);

  return (
    <div
      className={`tour-callout ${!targetRect ? 'tour-callout-centered' : ''}`}
      data-placement={coords.placement}
      style={{
        top: coords.top,
        left: coords.left,
      }}
      role="dialog"
      aria-labelledby="tour-step-title"
      aria-describedby="tour-step-desc"
    >
      {targetRect && <div className="tour-arrow" />}

      <div className="tour-callout-header">
        <span className="tour-step-badge">
          Step {step.stepNumber} of {totalSteps}
        </span>
        <button
          className="tour-close-btn"
          onClick={onPause}
          title="Pause guide (Resume anytime from Help)"
          aria-label="Pause guide"
        >
          ✕
        </button>
      </div>

      <h3 id="tour-step-title" className="tour-callout-title">
        {step.title}
      </h3>
      <p id="tour-step-desc" className="tour-callout-instruction">
        {step.instruction}
      </p>

      {!targetRect && step.targetPath && onNavigate && (
        <button
          className="tour-btn tour-btn-primary"
          style={{ width: '100%', padding: '8px 12px', fontSize: '0.85rem' }}
          onClick={() => onNavigate(step.targetPath!)}
        >
          Go to {step.targetPath === '/people' ? 'People' : step.targetPath === '/ar' ? 'AR Viewer' : 'Destination'} →
        </button>
      )}

      <div className="tour-callout-footer">
        <button className="tour-btn tour-btn-ghost" onClick={onSkip}>
          Skip Guide
        </button>
        <div style={{ display: 'flex', gap: '6px' }}>
          {step.stepNumber > 1 && (
            <button className="tour-btn tour-btn-ghost" onClick={onPrev}>
              Back
            </button>
          )}
          <button className="tour-btn tour-btn-primary" onClick={onNext}>
            {step.stepNumber === totalSteps ? 'Finish' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
};
