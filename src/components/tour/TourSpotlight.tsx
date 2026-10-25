import React, { useEffect, useState } from 'react';
import './Tour.css';

interface TourSpotlightProps {
  rect: DOMRect | null;
}

export const TourSpotlight: React.FC<TourSpotlightProps> = ({ rect }) => {
  const [viewport, setViewport] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });

  useEffect(() => {
    const handleResize = () => {
      setViewport({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };
    window.addEventListener('resize', handleResize, { passive: true });
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  if (!rect) {
    return <div className="tour-spotlight-backdrop-fallback" aria-hidden="true" />;
  }

  const PADDING = 8;
  const x = Math.max(0, rect.left - PADDING);
  const y = Math.max(0, rect.top - PADDING);
  const w = rect.width + PADDING * 2;
  const h = rect.height + PADDING * 2;
  const r = 12; // corner radius

  const vw = viewport.width;
  const vh = viewport.height;

  // SVG path with evenodd rule: Outer viewport minus the rounded rectangle hole
  const path = `
    M 0 0
    H ${vw}
    V ${vh}
    H 0
    Z
    M ${x + r} ${y}
    H ${x + w - r}
    A ${r} ${r} 0 0 1 ${x + w} ${y + r}
    V ${y + h - r}
    A ${r} ${r} 0 0 1 ${x + w - r} ${y + h}
    H ${x + r}
    A ${r} ${r} 0 0 1 ${x} ${y + h - r}
    V ${y + r}
    A ${r} ${r} 0 0 1 ${x + r} ${y}
    Z
  `;

  return (
    <div className="tour-spotlight-container" aria-hidden="true">
      <svg
        className="tour-spotlight-svg"
        viewBox={`0 0 ${vw} ${vh}`}
        preserveAspectRatio="none"
      >
        <path
          d={path}
          fillRule="evenodd"
          className="tour-spotlight-path"
        />
      </svg>

      {/* Glowing neon-blue focus ring around the target */}
      <div
        className="tour-spotlight-ring"
        style={{
          top: y,
          left: x,
          width: w,
          height: h,
          borderRadius: r,
        }}
      />
    </div>
  );
};
