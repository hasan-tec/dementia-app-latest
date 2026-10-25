import React, { useMemo } from 'react';
import { X, ArrowRight } from 'lucide-react';
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
    const isMobile = window.innerWidth <= 768;
    const calloutWidth = isMobile ? Math.min(360, window.innerWidth - 24) : 340;
    const calloutHeight = 210; // realistic height estimate
    const offset = 14;

    if (!targetRect) {
      return {
        top: Math.max(16, (window.innerHeight - calloutHeight) / 2),
        left: Math.max(12, (window.innerWidth - calloutWidth) / 2),
        width: calloutWidth,
        placement: 'bottom' as const,
        isCentered: true,
        showArrow: false,
      };
    }

    let top = 0;
    let left = 0;
    let placement = step.placement;
    let showArrow = true;

    if (isMobile) {
      // On mobile screens, center horizontally with safe margin
      left = Math.max(12, (window.innerWidth - calloutWidth) / 2);
      showArrow = false; // Hide arrow on mobile to prevent alignment mismatches

      const spaceBelow = window.innerHeight - targetRect.bottom;
      const spaceAbove = targetRect.top;

      if (spaceBelow >= calloutHeight + 16) {
        top = targetRect.bottom + offset;
        placement = 'bottom';
      } else if (spaceAbove >= calloutHeight + 16) {
        top = targetRect.top - calloutHeight - offset;
        placement = 'top';
      } else {
        // Tight vertical space: dock near the bottom or top
        if (spaceBelow > spaceAbove) {
          top = Math.max(16, window.innerHeight - calloutHeight - 16);
          placement = 'bottom';
        } else {
          top = 16;
          placement = 'top';
        }
      }
    } else {
      // Desktop positioning
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
          top = Math.max(16, targetRect.top);
          left = targetRect.right + offset;
          break;
        case 'left':
          top = Math.max(16, targetRect.top);
          left = targetRect.left - calloutWidth - offset;
          break;
      }

      // Desktop viewport boundary clamping
      left = Math.max(16, Math.min(window.innerWidth - calloutWidth - 16, left));
      top = Math.max(16, Math.min(window.innerHeight - calloutHeight - 16, top));
    }

    return { top, left, width: calloutWidth, placement, isCentered: false, showArrow };
  }, [step.placement, targetRect]);

  const navPath = step.targetPath || (step.id === 'step-nav-ar' ? '/ar' : step.id === 'step-nav-people' ? '/people' : undefined);
  const navLabel =
    navPath === '/people'
      ? 'Go to People'
      : navPath === '/ar'
      ? 'Launch AR Viewer'
      : navPath === '/'
      ? 'Go to Dashboard'
      : undefined;

  return (
    <div
      className={`tour-callout ${coords.isCentered ? 'tour-callout-centered' : ''}`}
      data-placement={coords.placement}
      style={{
        top: coords.top,
        left: coords.left,
        width: coords.width,
      }}
      role="dialog"
      aria-labelledby="tour-step-title"
      aria-describedby="tour-step-desc"
    >
      {coords.showArrow && <div className="tour-arrow" />}

      {/* Header with step pill and pause button */}
      <div className="tour-callout-header">
        <div className="tour-step-badge-wrap">
          <span className="tour-step-badge">
            Step {step.stepNumber} of {totalSteps}
          </span>
          <div className="tour-step-dots" aria-hidden="true">
            {Array.from({ length: totalSteps }).map((_, i) => (
              <span
                key={i}
                className={`tour-step-dot ${i + 1 === step.stepNumber ? 'active' : i + 1 < step.stepNumber ? 'done' : ''}`}
              />
            ))}
          </div>
        </div>

        <button
          className="tour-close-btn"
          onClick={onPause}
          title="Pause guide (Resume anytime from Help or Sidebar)"
          aria-label="Pause guide"
        >
          <X size={15} />
        </button>
      </div>

      {/* Main Content */}
      <h3 id="tour-step-title" className="tour-callout-title">
        {step.title}
      </h3>
      <p id="tour-step-desc" className="tour-callout-instruction">
        {step.instruction}
      </p>

      {/* Quick Navigate Helper Button (if target is missing or across pages) */}
      {!targetRect && navPath && navLabel && onNavigate && (
        <button
          className="tour-btn tour-btn-action"
          onClick={() => onNavigate(navPath)}
        >
          <span>{navLabel}</span>
          <ArrowRight size={14} />
        </button>
      )}

      {/* Footer Controls */}
      <div className="tour-callout-footer">
        <button className="tour-btn tour-btn-ghost" onClick={onSkip}>
          Skip Guide
        </button>
        <div className="tour-callout-actions">
          {step.stepNumber > 1 && (
            <button className="tour-btn tour-btn-secondary" onClick={onPrev}>
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
