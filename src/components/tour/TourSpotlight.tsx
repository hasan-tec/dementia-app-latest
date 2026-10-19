import React from 'react';
import './Tour.css';

interface TourSpotlightProps {
  rect: DOMRect | null;
}

export const TourSpotlight: React.FC<TourSpotlightProps> = ({ rect }) => {
  if (!rect) return null;

  const PADDING = 6;

  return (
    <div className="tour-spotlight-overlay" aria-hidden="true">
      <div
        className="tour-spotlight-cutout"
        style={{
          top: Math.max(0, rect.top - PADDING),
          left: Math.max(0, rect.left - PADDING),
          width: rect.width + PADDING * 2,
          height: rect.height + PADDING * 2,
        }}
      />
    </div>
  );
};
