import React from 'react';

/**
 * Layout Component - Tech Premium Design System
 *
 * Main application layout with sidebar and map container.
 * Features:
 * - Dark gradient mesh background
 * - Responsive sidebar (collapsible on mobile)
 * - Smooth slide-in animation
 * - Glass effect on sidebar
 */
const Layout = ({ sidebar, main }) => {
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-surface-900">
      {/* Gradient Mesh Background */}
      <div
        className="fixed inset-0 pointer-events-none z-0"
        style={{
          background: `
            radial-gradient(at 40% 20%, rgba(0, 212, 255, 0.08) 0px, transparent 50%),
            radial-gradient(at 80% 0%, rgba(168, 85, 247, 0.06) 0px, transparent 50%),
            radial-gradient(at 0% 50%, rgba(0, 212, 255, 0.05) 0px, transparent 50%),
            radial-gradient(at 100% 80%, rgba(168, 85, 247, 0.04) 0px, transparent 50%)
          `,
        }}
      />

      {/* Sidebar */}
      <aside
        className={`
          relative z-fixed
          w-full
          md:w-[420px]
          h-full
          flex-shrink-0
          bg-[rgba(10,10,15,0.95)]
          backdrop-blur-xl
          border-r border-[rgba(255,255,255,0.06)]
          shadow-dark-xl
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
                rgba(0, 212, 255, 0.03) 0%,
                transparent 30%,
                transparent 70%,
                rgba(168, 85, 247, 0.02) 100%
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
      <main className="flex-1 h-full relative z-base">
        {main}
      </main>
    </div>
  );
};

export default Layout;
