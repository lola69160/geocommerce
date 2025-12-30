import React from 'react';

export const Badge = ({
  variant = 'default',
  children,
  className = ''
}) => {
  const variants = {
    default: "bg-surface-300 text-text-primary",
    primary: "bg-primary-500 text-white",
    success: "bg-success-500 text-white",
    warning: "bg-warning-500 text-white",
    danger: "bg-danger-500 text-white",
    cyan: "bg-accent-cyan-200 text-text-primary",
    yellow: "bg-accent-yellow-200 text-text-primary",
    violet: "bg-accent-violet-200 text-text-primary",
    pink: "bg-accent-pink-200 text-text-primary",
  };

  return (
    <span className={`px-3 py-1 rounded-full text-xs font-medium ${variants[variant]} ${className}`}>
      {children}
    </span>
  );
};
