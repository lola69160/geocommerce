import React from 'react';

/**
 * Card Component - Tech Premium Design System
 *
 * @param {string} variant - 'default' | 'elevated' | 'outlined' | 'glass'
 * @param {boolean} hover - Enable hover lift effect
 * @param {boolean} glow - Enable glow border on hover
 * @param {boolean} interactive - Clickable card with cursor pointer
 * @param {string} padding - 'none' | 'sm' | 'md' | 'lg'
 */
const Card = React.forwardRef(({
  children,
  variant = 'default',
  hover = false,
  glow = false,
  interactive = false,
  padding = 'md',
  className = '',
  as: Component = 'div',
  ...props
}, ref) => {

  // Padding styles
  const paddingStyles = {
    none: '',
    sm: 'p-3',
    md: 'p-4',
    lg: 'p-6',
  };

  // Variant styles
  const variantStyles = {
    default: `
      bg-surface-800
      border border-[rgba(255,255,255,0.06)]
    `,
    elevated: `
      bg-gradient-to-br from-surface-800 to-surface-900
      border border-[rgba(255,255,255,0.08)]
      shadow-dark-lg
    `,
    outlined: `
      bg-transparent
      border border-[rgba(255,255,255,0.12)]
    `,
    glass: `
      bg-[rgba(18,18,26,0.8)]
      backdrop-blur-lg
      border border-[rgba(255,255,255,0.08)]
      shadow-dark-lg
    `,
  };

  // Hover effects
  const hoverStyles = hover ? `
    transition-all duration-normal ease-out
    hover:-translate-y-1
    hover:shadow-dark-xl
  ` : '';

  // Glow border on hover
  const glowStyles = glow ? `
    transition-all duration-normal ease-out
    hover:border-[rgba(0,212,255,0.3)]
    hover:shadow-glow-sm
  ` : '';

  // Interactive styles
  const interactiveStyles = interactive ? `
    cursor-pointer
    select-none
    active:scale-[0.99]
  ` : '';

  return (
    <Component
      ref={ref}
      className={`
        rounded-xl
        ${paddingStyles[padding]}
        ${variantStyles[variant]}
        ${hoverStyles}
        ${glowStyles}
        ${interactiveStyles}
        ${className}
      `.replace(/\s+/g, ' ').trim()}
      {...props}
    >
      {children}
    </Component>
  );
});

Card.displayName = 'Card';

/**
 * CardHeader - Top section with title and actions
 */
export const CardHeader = ({
  children,
  className = '',
  ...props
}) => (
  <div
    className={`
      flex items-center justify-between
      pb-4 mb-4
      border-b border-[rgba(255,255,255,0.06)]
      ${className}
    `.replace(/\s+/g, ' ').trim()}
    {...props}
  >
    {children}
  </div>
);

/**
 * CardTitle - Heading for card
 */
export const CardTitle = ({
  children,
  as: Component = 'h3',
  className = '',
  ...props
}) => (
  <Component
    className={`
      font-display font-semibold text-lg text-text-primary
      ${className}
    `.replace(/\s+/g, ' ').trim()}
    {...props}
  >
    {children}
  </Component>
);

/**
 * CardDescription - Subtext for card
 */
export const CardDescription = ({
  children,
  className = '',
  ...props
}) => (
  <p
    className={`
      text-sm text-text-secondary mt-1
      ${className}
    `.replace(/\s+/g, ' ').trim()}
    {...props}
  >
    {children}
  </p>
);

/**
 * CardContent - Main content area
 */
export const CardContent = ({
  children,
  className = '',
  ...props
}) => (
  <div
    className={`${className}`}
    {...props}
  >
    {children}
  </div>
);

/**
 * CardFooter - Bottom section with actions
 */
export const CardFooter = ({
  children,
  className = '',
  ...props
}) => (
  <div
    className={`
      flex items-center gap-3
      pt-4 mt-4
      border-t border-[rgba(255,255,255,0.06)]
      ${className}
    `.replace(/\s+/g, ' ').trim()}
    {...props}
  >
    {children}
  </div>
);

/**
 * CardImage - Image section for card
 */
export const CardImage = ({
  src,
  alt = '',
  aspectRatio = 'video',
  className = '',
  ...props
}) => {
  const aspectStyles = {
    square: 'aspect-square',
    video: 'aspect-video',
    portrait: 'aspect-[3/4]',
    auto: '',
  };

  return (
    <div
      className={`
        ${aspectStyles[aspectRatio]}
        overflow-hidden rounded-lg
        bg-surface-700
        -mx-4 -mt-4 mb-4
        ${className}
      `.replace(/\s+/g, ' ').trim()}
    >
      <img
        src={src}
        alt={alt}
        className="w-full h-full object-cover"
        {...props}
      />
    </div>
  );
};

export default Card;
