import React from 'react';
import { Loader } from 'lucide-react';

export const Button = ({
  variant = 'primary',
  size = 'md',
  icon,
  badge,
  loading,
  children,
  className = '',
  fullWidth = false,
  glow = false,
  ...props
}) => {
  const baseClasses = "rounded-xl font-semibold transition-all duration-200 flex items-center justify-center gap-3 disabled:cursor-not-allowed";

  const variants = {
    primary: "bg-primary-500 hover:bg-primary-600 active:bg-primary-700 text-white shadow-lg hover:shadow-xl disabled:bg-surface-400 disabled:text-text-disabled disabled:shadow-none",
    secondary: "bg-white hover:bg-surface-100 border-2 border-surface-400 text-text-primary disabled:opacity-50 shadow-sm",
    ghost: "bg-transparent hover:bg-surface-200 text-text-primary disabled:opacity-50",
  };

  const sizes = {
    sm: "px-4 py-2 text-sm",
    md: "px-6 py-4 text-base",
    lg: "px-8 py-5 text-lg",
  };

  return (
    <button
      className={`
        ${baseClasses}
        ${variants[variant]}
        ${sizes[size]}
        ${fullWidth ? 'w-full' : ''}
        ${glow ? 'shadow-glow-cyan' : ''}
        ${className}
      `}
      {...props}
    >
      {loading ? (
        <>
          <Loader className="w-5 h-5 animate-spin" />
          <span>Chargement...</span>
        </>
      ) : (
        <>
          {icon && <span className="flex-shrink-0">{icon}</span>}
          <span>{children}</span>
          {badge && (
            <span className="px-2 py-1 rounded-full bg-white/20 text-xs font-bold">
              {badge}
            </span>
          )}
        </>
      )}
    </button>
  );
};
