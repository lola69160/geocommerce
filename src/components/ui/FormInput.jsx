import React from 'react';

export const FormInput = ({
  label,
  icon,
  type = "text",
  placeholder,
  helpText,
  error,
  prefix,
  className = '',
  ...props
}) => (
  <div className="space-y-3">
    {label && (
      <label className="flex items-center gap-2 text-sm font-medium text-text-primary">
        {icon && (
          <span className="flex items-center justify-center w-6 h-6 rounded-full bg-accent-cyan-200 text-text-primary text-xs font-bold">
            {icon}
          </span>
        )}
        {label}
      </label>
    )}
    <div className="relative">
      <input
        type={type}
        className={`
          w-full px-5 py-4 border-2 rounded-xl
          focus:ring-4 focus:outline-none transition-all duration-200
          placeholder:text-text-disabled
          ${prefix ? 'pl-12' : ''}
          ${error
            ? 'border-danger-500 focus:border-danger-600 focus:ring-danger-100'
            : 'border-surface-400 focus:border-primary-500 focus:ring-primary-100'
          }
          ${className}
        `}
        placeholder={placeholder}
        {...props}
      />
      {prefix && (
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-text-tertiary font-medium">
          {prefix}
        </span>
      )}
    </div>
    {(helpText || error) && (
      <p className={`text-xs leading-relaxed ${error ? 'text-danger-600' : 'text-text-tertiary'}`}>
        {error || helpText}
      </p>
    )}
  </div>
);
