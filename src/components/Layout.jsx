import React from 'react';

const Layout = ({ sidebar, main }) => {
    return (
        <div style={{ display: 'flex', width: '100vw', height: '100vh', overflow: 'hidden' }}>
            {/* Sidebar */}
            <div style={{
                width: '400px',
                height: '100%',
                overflowY: 'auto',
                position: 'relative',
                zIndex: 1000
            }}>
                {sidebar}
            </div>

            {/* Main content (Map) */}
            <div style={{
                flex: 1,
                height: '100%',
                position: 'relative'
            }}>
                {main}
            </div>
        </div>
    );
};

export default Layout;
