import React from 'react';

/**
 * Layout Component - Gojiberry Light Mode Design System
 *
 * Main application layout with sidebar and map container.
 * Features:
 * - Light beige background
 * - Responsive sidebar (collapsible on mobile)
 * - Smooth slide-in animation
 * - Glass effect on sidebar
 */
const Layout = ({ sidebar, main }) => {
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-surface-100">
      {/* Subtle Light Background Pattern */}
      <div
        className="fixed inset-0 pointer-events-none z-0"
        style={{
          background: `
            radial-gradient(at 40% 20%, rgba(255, 107, 74, 0.02) 0px, transparent 50%),
            radial-gradient(at 80% 0%, rgba(255, 107, 74, 0.015) 0px, transparent 50%)
          `,
        }}
      />

      {/* Sidebar */}
      <aside
        className={`
          relative z-fixed
          w-[420px]
          h-full
          flex-shrink-0
          bg-white/70
          backdrop-blur-xl
          border-r border-surface-300
          shadow-lg
          overflow-y-auto
          overflow-x-hidden
          animate-slide-in-left
        `.replace(/\s+/g, ' ').trim()}
      >
        {/* Subtle gradient overlay on sidebar */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `
              linear-gradient(180deg,
                rgba(255, 107, 74, 0.01) 0%,
                transparent 50%
              )
            `,
          }}
        />

        {/* Sidebar content */}
        <div className="relative z-10">
          {sidebar}
        </div>
      </aside>

      {/* Main content (Map) */}
      <main className="flex-1 h-full w-full relative z-base overflow-hidden">
        {main}
      </main>
    </div>
  );
};

export default Layout;
