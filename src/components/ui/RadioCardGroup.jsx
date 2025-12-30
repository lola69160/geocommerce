import React from 'react';
import { CheckCircle } from 'lucide-react';

export const RadioCardGroup = ({
  label,
  icon,
  options,
  value,
  onChange,
  helpText,
  columns = 2,
  className = ''
}) => (
  <div className={`space-y-3 ${className}`}>
    {label && (
      <label className="flex items-center gap-2 text-sm font-medium text-text-primary">
        {icon && (
          <span className="flex items-center justify-center w-6 h-6 rounded-full bg-accent-yellow-200 text-text-primary text-xs">
            {icon}
          </span>
        )}
        {label}
      </label>
    )}

    <div className={`grid gap-3`} style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
      {options.map(option => (
        <label
          key={option.value}
          className={`
            relative flex flex-col items-center justify-center p-5 rounded-xl border-2 cursor-pointer
            transition-all duration-200
            ${String(value) === String(option.value)
              ? 'border-primary-500 bg-primary-50 shadow-md'
              : 'border-surface-400 bg-white hover:border-surface-500'
            }
          `}
        >
          <input
            type="radio"
            className="sr-only"
            value={option.value}
            checked={String(value) === String(option.value)}
            onChange={() => onChange(option.value)}
          />
          {option.emoji && <span className="text-2xl mb-2">{option.emoji}</span>}
          <span className="font-semibold text-text-primary text-center">{option.label}</span>
          {option.description && (
            <span className="text-xs text-text-tertiary text-center mt-1">{option.description}</span>
          )}
          {String(value) === String(option.value) && (
            <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-primary-500 flex items-center justify-center">
              <CheckCircle className="w-3 h-3 text-white" />
            </div>
          )}
        </label>
      ))}
    </div>

    {helpText && (
      <p className="text-xs text-text-tertiary leading-relaxed">
        {helpText}
      </p>
    )}
  </div>
);
