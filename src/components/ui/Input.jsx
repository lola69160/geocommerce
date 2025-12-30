import React, { useState } from 'react';

/**
 * Input Component - Tech Premium Design System
 *
 * @param {string} size - 'sm' | 'md' | 'lg'
 * @param {string} variant - 'default' | 'filled'
 * @param {React.ReactNode} icon - Icon to display on the left
 * @param {React.ReactNode} iconRight - Icon to display on the right
 * @param {string} error - Error message
 * @param {string} hint - Hint text below input
 * @param {boolean} success - Success state
 */
const Input = React.forwardRef(({
  type = 'text',
  size = 'md',
  variant = 'default',
  icon,
  iconRight,
  error,
  hint,
  success,
  label,
  required,
  disabled,
  className = '',
  containerClassName = '',
  ...props
}, ref) => {
  const [isFocused, setIsFocused] = useState(false);

  // Size styles
  const sizeStyles = {
    sm: {
      input: 'py-2 text-sm',
      icon: 'w-4 h-4',
      paddingLeft: icon ? 'pl-9' : 'pl-3',
      paddingRight: iconRight ? 'pr-9' : 'pr-3',
    },
    md: {
      input: 'py-2.5 text-base',
      icon: 'w-5 h-5',
      paddingLeft: icon ? 'pl-11' : 'pl-4',
      paddingRight: iconRight ? 'pr-11' : 'pr-4',
    },
    lg: {
      input: 'py-3.5 text-lg',
      icon: 'w-6 h-6',
      paddingLeft: icon ? 'pl-12' : 'pl-5',
      paddingRight: iconRight ? 'pr-12' : 'pr-5',
    },
  };

  // State-based border colors
  const getBorderColor = () => {
    if (error) return 'border-red-500 focus:border-red-500';
    if (success) return 'border-emerald-500 focus:border-emerald-500';
    if (isFocused) return 'border-primary-500';
    return 'border-surface-400 hover:border-surface-500';
  };

  // State-based glow
  const getGlow = () => {
    if (error) return 'focus:shadow-glow-danger';
    if (success) return 'focus:shadow-glow-success';
    return 'focus:shadow-glow-sm';
  };

  // Variant styles
  const variantStyles = {
    default: 'bg-surface-300',
    filled: 'bg-surface-200',
  };

  return (
    <div className={`flex flex-col gap-1.5 ${containerClassName}`}>
      {/* Label */}
      {label && (
        <label className="text-sm font-medium text-text-secondary flex items-center gap-1">
          {label}
          {required && <span className="text-red-400">*</span>}
        </label>
      )}

      {/* Input wrapper */}
      <div className="relative">
        {/* Left icon */}
        {icon && (
          <div className={`
            absolute left-3 top-1/2 -translate-y-1/2
            ${sizeStyles[size].icon}
            ${isFocused ? 'text-cyan-500' : 'text-text-muted'}
            ${error ? 'text-red-500' : ''}
            ${success ? 'text-emerald-500' : ''}
            transition-colors duration-fast
            pointer-events-none
          `}>
            {icon}
          </div>
        )}

        {/* Input field */}
        <input
          ref={ref}
          type={type}
          disabled={disabled}
          onFocus={(e) => {
            setIsFocused(true);
            props.onFocus?.(e);
          }}
          onBlur={(e) => {
            setIsFocused(false);
            props.onBlur?.(e);
          }}
          className={`
            w-full
            ${variantStyles[variant]}
            ${sizeStyles[size].input}
            ${sizeStyles[size].paddingLeft}
            ${sizeStyles[size].paddingRight}
            text-text-primary
            placeholder:text-text-muted
            border ${getBorderColor()}
            rounded-xl
            ${getGlow()}
            focus:bg-surface-200
            focus:outline-none
            disabled:opacity-50 disabled:cursor-not-allowed
            transition-all duration-fast
            ${className}
          `.replace(/\s+/g, ' ').trim()}
          {...props}
        />

        {/* Right icon */}
        {iconRight && (
          <div className={`
            absolute right-3 top-1/2 -translate-y-1/2
            ${sizeStyles[size].icon}
            ${isFocused ? 'text-cyan-500' : 'text-text-muted'}
            ${error ? 'text-red-500' : ''}
            ${success ? 'text-emerald-500' : ''}
            transition-colors duration-fast
          `}>
            {iconRight}
          </div>
        )}
      </div>

      {/* Error or hint message */}
      {(error || hint) && (
        <p className={`text-xs ${error ? 'text-red-400' : 'text-text-muted'}`}>
          {error || hint}
        </p>
      )}
    </div>
  );
});

Input.displayName = 'Input';

/**
 * Textarea Component
 */
export const Textarea = React.forwardRef(({
  size = 'md',
  variant = 'default',
  error,
  hint,
  success,
  label,
  required,
  disabled,
  rows = 4,
  className = '',
  containerClassName = '',
  ...props
}, ref) => {
  const [isFocused, setIsFocused] = useState(false);

  const sizeStyles = {
    sm: 'py-2 px-3 text-sm',
    md: 'py-2.5 px-4 text-base',
    lg: 'py-3.5 px-5 text-lg',
  };

  const getBorderColor = () => {
    if (error) return 'border-red-500 focus:border-red-500';
    if (success) return 'border-emerald-500 focus:border-emerald-500';
    if (isFocused) return 'border-primary-500';
    return 'border-surface-400 hover:border-surface-500';
  };

  const getGlow = () => {
    if (error) return 'focus:shadow-glow-danger';
    if (success) return 'focus:shadow-glow-success';
    return 'focus:shadow-glow-sm';
  };

  const variantStyles = {
    default: 'bg-surface-300',
    filled: 'bg-surface-200',
  };

  return (
    <div className={`flex flex-col gap-1.5 ${containerClassName}`}>
      {label && (
        <label className="text-sm font-medium text-text-secondary flex items-center gap-1">
          {label}
          {required && <span className="text-red-400">*</span>}
        </label>
      )}

      <textarea
        ref={ref}
        rows={rows}
        disabled={disabled}
        onFocus={(e) => {
          setIsFocused(true);
          props.onFocus?.(e);
        }}
        onBlur={(e) => {
          setIsFocused(false);
          props.onBlur?.(e);
        }}
        className={`
          w-full
          ${variantStyles[variant]}
          ${sizeStyles[size]}
          text-text-primary
          placeholder:text-text-muted
          border ${getBorderColor()}
          rounded-xl
          ${getGlow()}
          focus:bg-surface-200
          focus:outline-none
          disabled:opacity-50 disabled:cursor-not-allowed
          transition-all duration-fast
          resize-y min-h-[100px]
          ${className}
        `.replace(/\s+/g, ' ').trim()}
        {...props}
      />

      {(error || hint) && (
        <p className={`text-xs ${error ? 'text-red-400' : 'text-text-muted'}`}>
          {error || hint}
        </p>
      )}
    </div>
  );
});

Textarea.displayName = 'Textarea';

export default Input;
