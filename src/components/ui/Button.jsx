import React from 'react';

/**
 * Button Component - Tech Premium Design System
 *
 * @param {string} variant - 'primary' | 'secondary' | 'ghost' | 'danger' | 'success'
 * @param {string} size - 'sm' | 'md' | 'lg'
 * @param {boolean} fullWidth - Whether button takes full width
 * @param {boolean} loading - Show loading spinner
 * @param {boolean} glow - Enable glow effect on hover
 * @param {React.ReactNode} icon - Icon to display before text
 * @param {React.ReactNode} iconRight - Icon to display after text
 */
const Button = React.forwardRef(({
  children,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  loading = false,
  disabled = false,
  glow = false,
  icon,
  iconRight,
  className = '',
  ...props
}, ref) => {

  // Base styles
  const baseStyles = `
    inline-flex items-center justify-center gap-2
    font-body font-medium
    rounded-xl
    border border-transparent
    transition-all duration-fast ease-out
    focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-900
    disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none
    active:scale-[0.98]
  `;

  // Size variants
  const sizeStyles = {
    sm: 'px-3 py-1.5 text-sm gap-1.5',
    md: 'px-4 py-2.5 text-base gap-2',
    lg: 'px-6 py-3 text-lg gap-2.5',
  };

  // Color variants
  const variantStyles = {
    primary: `
      bg-gradient-to-r from-cyan-500 to-cyan-600
      text-white
      hover:from-cyan-400 hover:to-cyan-500
      hover:shadow-glow-cyan
      active:from-cyan-600 active:to-cyan-700
    `,
    secondary: `
      bg-surface-700
      text-text-primary
      border-border-default
      hover:bg-surface-600
      hover:border-cyan-500/30
      active:bg-surface-800
    `,
    ghost: `
      bg-transparent
      text-text-secondary
      hover:bg-surface-700
      hover:text-text-primary
      active:bg-surface-800
    `,
    danger: `
      bg-gradient-to-r from-red-500 to-red-600
      text-white
      hover:from-red-400 hover:to-red-500
      hover:shadow-glow-danger
      active:from-red-600 active:to-red-700
    `,
    success: `
      bg-gradient-to-r from-emerald-500 to-emerald-600
      text-white
      hover:from-emerald-400 hover:to-emerald-500
      hover:shadow-glow-success
      active:from-emerald-600 active:to-emerald-700
    `,
  };

  // Glow effect
  const glowStyles = glow && !disabled ? 'animate-glow-pulse' : '';

  // Full width
  const widthStyles = fullWidth ? 'w-full' : '';

  // Loading spinner
  const Spinner = () => (
    <svg
      className="animate-spin h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );

  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={`
        ${baseStyles}
        ${sizeStyles[size]}
        ${variantStyles[variant]}
        ${glowStyles}
        ${widthStyles}
        ${className}
      `.replace(/\s+/g, ' ').trim()}
      {...props}
    >
      {loading ? <Spinner /> : icon}
      {children}
      {!loading && iconRight}
    </button>
  );
});

Button.displayName = 'Button';

/**
 * IconButton - Square button for icon-only actions
 */
export const IconButton = React.forwardRef(({
  children,
  variant = 'ghost',
  size = 'md',
  className = '',
  ...props
}, ref) => {
  const sizeStyles = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-12 h-12',
  };

  return (
    <Button
      ref={ref}
      variant={variant}
      className={`!p-0 ${sizeStyles[size]} ${className}`}
      {...props}
    >
      {children}
    </Button>
  );
});

IconButton.displayName = 'IconButton';

export default Button;
