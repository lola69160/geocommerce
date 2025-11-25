import React from 'react';
import { AGE_RANGES, getLegendColor } from '../utils/ageUtils';

const Legend = () => {
    return (
        <div
            className="glass-panel"
            style={{
                position: 'absolute',
                bottom: '20px',
                right: '20px',
                zIndex: 1000,
                padding: '12px 16px',
                minWidth: '180px',
                fontSize: '0.85rem'
            }}
        >
            <div style={{
                fontWeight: '600',
                marginBottom: '8px',
                color: 'var(--text-primary)',
                fontSize: '0.9rem'
            }}>
                Âge des commerces
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {AGE_RANGES.map((range, index) => (
                    <div
                        key={index}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                        }}
                    >
                        <div
                            style={{
                                width: '20px',
                                height: '20px',
                                borderRadius: '50%',
                                backgroundColor: getLegendColor(range.min, range.max),
                                border: '2px solid white',
                                boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                                flexShrink: 0
                            }}
                        />
                        <span style={{ color: 'var(--text-secondary)' }}>
                            {range.label}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default Legend;
