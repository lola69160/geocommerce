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
    <div
      className="legend-map-overlay"
      style={{
        position: 'absolute',
        bottom: '1.25rem',
        right: '1.25rem',
        zIndex: 1000,
        padding: '0.875rem',
        minWidth: '180px',
        backgroundColor: '#fefefe',
        border: '1px solid #e8e4df',
        borderRadius: '1rem',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08), 0 2px 4px rgba(0, 0, 0, 0.04)',
        opacity: 1,
        pointerEvents: 'auto',
      }}
    >
      {/* Title */}
      <h4 style={{
        fontFamily: 'Sora, sans-serif',
        fontWeight: 600,
        fontSize: '0.875rem',
        color: '#1f2937',
        marginBottom: '0.75rem',
        borderBottom: '2px solid #FF6B4A',
        paddingBottom: '0.5rem',
      }}>
        Âge des commerces
      </h4>

      {/* Legend items */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {AGE_RANGES.map((range, index) => (
          <div
            key={index}
            style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}
          >
            {/* Color indicator */}
            <div
              style={{
                width: '1.125rem',
                height: '1.125rem',
                borderRadius: '9999px',
                flexShrink: 0,
                border: '2px solid #ffffff',
                boxShadow: '0 0 0 1px rgba(0, 0, 0, 0.1), 0 1px 3px rgba(0, 0, 0, 0.15)',
                backgroundColor: getLegendColor(range.min, range.max),
              }}
            />

            {/* Label */}
            <span style={{
              fontSize: '0.8125rem',
              color: '#374151',
              fontWeight: 500,
              fontFamily: 'DM Sans, sans-serif',
            }}>
              {range.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Legend;
