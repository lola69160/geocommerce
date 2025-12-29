import React from 'react';
import { AGE_RANGES, getLegendColor } from '../utils/ageUtils';

/**
 * Legend Component - Tech Premium Design System
 *
 * Map legend showing business age color coding.
 * Features:
 * - Dark glassmorphism styling
 * - Compact layout
 * - Smooth transitions
 */
const Legend = () => {
  return (
    <div className={`
      absolute bottom-5 right-5
      z-fixed
      p-3
      min-w-[160px]
      bg-[rgba(18,18,26,0.9)]
      backdrop-blur-lg
      border border-[rgba(255,255,255,0.08)]
      rounded-xl
      shadow-dark-xl
      animate-fade-in-up
    `}>
      {/* Title */}
      <h4 className="font-display font-semibold text-sm text-text-primary mb-2.5">
        Age des commerces
      </h4>

      {/* Legend items */}
      <div className="flex flex-col gap-2">
        {AGE_RANGES.map((range, index) => (
          <div
            key={index}
            className="flex items-center gap-2.5 group"
          >
            {/* Color indicator */}
            <div
              className={`
                w-4 h-4
                rounded-full
                flex-shrink-0
                border-2 border-surface-700
                shadow-dark-sm
                transition-transform duration-fast
                group-hover:scale-110
              `}
              style={{
                backgroundColor: getLegendColor(range.min, range.max),
              }}
            />

            {/* Label */}
            <span className="text-xs text-text-muted group-hover:text-text-secondary transition-colors">
              {range.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Legend;
