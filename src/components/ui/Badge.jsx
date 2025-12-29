import React from 'react';

/**
 * Badge Component - Tech Premium Design System
 *
 * @param {string} variant - 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'outline'
 * @param {string} size - 'sm' | 'md' | 'lg'
 * @param {boolean} dot - Show status dot
 * @param {boolean} pulse - Animate with pulse effect
 * @param {React.ReactNode} icon - Icon to display before text
 */
const Badge = ({
  children,
  variant = 'default',
  size = 'md',
  dot = false,
  pulse = false,
  icon,
  className = '',
  ...props
}) => {

  // Size styles
  const sizeStyles = {
    sm: 'px-2 py-0.5 text-xs gap-1',
    md: 'px-2.5 py-1 text-xs gap-1.5',
    lg: 'px-3 py-1.5 text-sm gap-2',
  };

  // Dot sizes
  const dotSizes = {
    sm: 'w-1.5 h-1.5',
    md: 'w-2 h-2',
    lg: 'w-2.5 h-2.5',
  };

  // Variant styles
  const variantStyles = {
    default: `
      bg-surface-700
      text-text-secondary
      border-transparent
    `,
    primary: `
      bg-cyan-500/15
      text-cyan-400
      border-cyan-500/30
    `,
    success: `
      bg-emerald-500/15
      text-emerald-400
      border-emerald-500/30
    `,
    warning: `
      bg-amber-500/15
      text-amber-400
      border-amber-500/30
    `,
    danger: `
      bg-red-500/15
      text-red-400
      border-red-500/30
    `,
    info: `
      bg-blue-500/15
      text-blue-400
      border-blue-500/30
    `,
    outline: `
      bg-transparent
      text-text-secondary
      border-[rgba(255,255,255,0.2)]
    `,
  };

  // Dot colors
  const dotColors = {
    default: 'bg-text-muted',
    primary: 'bg-cyan-400',
    success: 'bg-emerald-400',
    warning: 'bg-amber-400',
    danger: 'bg-red-400',
    info: 'bg-blue-400',
    outline: 'bg-text-muted',
  };

  return (
    <span
      className={`
        inline-flex items-center
        font-medium
        rounded-full
        border
        ${sizeStyles[size]}
        ${variantStyles[variant]}
        ${className}
      `.replace(/\s+/g, ' ').trim()}
      {...props}
    >
      {/* Status dot */}
      {dot && (
        <span
          className={`
            ${dotSizes[size]}
            rounded-full
            ${dotColors[variant]}
            ${pulse ? 'animate-pulse' : ''}
          `}
        />
      )}

      {/* Icon */}
      {icon && (
        <span className="shrink-0">
          {icon}
        </span>
      )}

      {/* Text */}
      {children}
    </span>
  );
};

/**
 * CountBadge - Numeric badge for counts
 */
export const CountBadge = ({
  count,
  max = 99,
  variant = 'primary',
  size = 'sm',
  className = '',
  ...props
}) => {
  const displayCount = count > max ? `${max}+` : count;

  // Hide if count is 0
  if (count <= 0) return null;

  const sizeStyles = {
    sm: 'min-w-[18px] h-[18px] text-xs px-1',
    md: 'min-w-[22px] h-[22px] text-xs px-1.5',
    lg: 'min-w-[26px] h-[26px] text-sm px-2',
  };

  const variantStyles = {
    primary: 'bg-cyan-500 text-white',
    danger: 'bg-red-500 text-white',
    success: 'bg-emerald-500 text-white',
    warning: 'bg-amber-500 text-white',
  };

  return (
    <span
      className={`
        inline-flex items-center justify-center
        font-bold
        rounded-full
        ${sizeStyles[size]}
        ${variantStyles[variant]}
        ${className}
      `.replace(/\s+/g, ' ').trim()}
      {...props}
    >
      {displayCount}
    </span>
  );
};

/**
 * StatusBadge - Pre-configured status indicators
 */
export const StatusBadge = ({
  status,
  size = 'md',
  showDot = true,
  className = '',
  ...props
}) => {
  const statusConfig = {
    active: { variant: 'success', label: 'Actif', pulse: true },
    inactive: { variant: 'default', label: 'Inactif', pulse: false },
    pending: { variant: 'warning', label: 'En attente', pulse: true },
    error: { variant: 'danger', label: 'Erreur', pulse: false },
    success: { variant: 'success', label: 'Succès', pulse: false },
    processing: { variant: 'info', label: 'En cours', pulse: true },
    // French specific
    ouvert: { variant: 'success', label: 'Ouvert', pulse: false },
    ferme: { variant: 'danger', label: 'Fermé', pulse: false },
    bodacc: { variant: 'warning', label: 'BODACC', pulse: false },
  };

  const config = statusConfig[status] || statusConfig.inactive;

  return (
    <Badge
      variant={config.variant}
      size={size}
      dot={showDot}
      pulse={config.pulse}
      className={className}
      {...props}
    >
      {config.label}
    </Badge>
  );
};

/**
 * TagBadge - Removable tag style badge
 */
export const TagBadge = ({
  children,
  onRemove,
  variant = 'default',
  size = 'md',
  className = '',
  ...props
}) => {
  const sizeStyles = {
    sm: 'px-2 py-0.5 text-xs gap-1',
    md: 'px-2.5 py-1 text-xs gap-1.5',
    lg: 'px-3 py-1.5 text-sm gap-2',
  };

  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-3.5 h-3.5',
    lg: 'w-4 h-4',
  };

  return (
    <span
      className={`
        inline-flex items-center
        font-medium
        rounded-lg
        bg-surface-700
        text-text-secondary
        border border-[rgba(255,255,255,0.1)]
        hover:border-[rgba(255,255,255,0.2)]
        transition-colors duration-fast
        ${sizeStyles[size]}
        ${className}
      `.replace(/\s+/g, ' ').trim()}
      {...props}
    >
      {children}

      {onRemove && (
        <button
          onClick={onRemove}
          className={`
            ${iconSizes[size]}
            rounded-full
            text-text-muted
            hover:text-red-400
            hover:bg-red-500/20
            transition-colors duration-fast
            flex items-center justify-center
          `}
          aria-label="Remove"
        >
          <svg viewBox="0 0 16 16" fill="none" className="w-full h-full p-0.5">
            <path
              d="M12 4L4 12M4 4L12 12"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </button>
      )}
    </span>
  );
};

export default Badge;
