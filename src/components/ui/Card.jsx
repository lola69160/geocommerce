import React from 'react';

export const Card = ({
  children,
  hover = false,
  padding = 'md',
  glow = false,
  className = ''
}) => {
  const paddings = {
    none: "",
    sm: "p-4",
    md: "p-6",
    lg: "p-8",
  };

  return (
    <div className={`
      bg-white rounded-xl border-2 border-surface-300 shadow-md
      ${hover ? 'hover:shadow-lg hover:-translate-y-1 transition-all duration-200 cursor-pointer' : ''}
      ${glow ? 'shadow-glow-cyan border-accent-cyan-400' : ''}
      ${paddings[padding]}
      ${className}
    `}>
      {children}
    </div>
  );
};
