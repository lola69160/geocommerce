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

      {/* Sidebar */}
      <aside
        className={`
          relative z-fixed
          w-[420px]
          h-full
          flex-shrink-0
          bg-white
          border-r border-surface-300
          shadow-lg
          overflow-y-auto
          overflow-x-hidden
          animate-slide-in-left
        `.replace(/\s+/g, ' ').trim()}
      >
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
