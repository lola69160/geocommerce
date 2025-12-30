import React from 'react';

export const FormTextarea = ({
  label,
  icon,
  placeholder,
  helpText,
  error,
  rows = 4,
  className = '',
  ...props
}) => (
  <div className="space-y-3">
    {label && (
      <label className="flex items-center gap-2 text-sm font-medium text-text-primary">
        {icon && (
          <span className="flex items-center justify-center w-6 h-6 rounded-full bg-accent-violet-200 text-text-primary text-xs">
            {icon}
          </span>
        )}
        {label}
      </label>
    )}
    <textarea
      rows={rows}
      className={`
        w-full px-5 py-4 border-2 rounded-xl
        focus:ring-4 focus:outline-none transition-all duration-200 resize-none
        placeholder:text-text-disabled
        ${error
          ? 'border-danger-500 focus:border-danger-600 focus:ring-danger-100'
          : 'border-surface-400 focus:border-primary-500 focus:ring-primary-100'
        }
        ${className}
      `}
      placeholder={placeholder}
      {...props}
    />
    {(helpText || error) && (
      <p className={`text-xs leading-relaxed ${error ? 'text-danger-600' : 'text-text-tertiary'}`}>
        {error || helpText}
      </p>
    )}
  </div>
);
