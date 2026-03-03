'use client';

import Link from 'next/link';

export function Sidebar({ items = [], collapsed, mobileOpen, isMobile, activeTab, onNavigate, onToggle, children }) {
  return (
    <aside className={`sidebar ${collapsed ? 'compact' : ''} ${isMobile ? 'mobile-drawer' : ''} ${mobileOpen ? 'open' : ''}`}>
      <button type="button" className="sidebar-toggle" onClick={onToggle} aria-label="Toggle navigation">
        {collapsed ? '☰' : '←'}
      </button>
      <nav className="sidebar-nav stack">
        {items.map((item) => {
          const isActive = activeTab === item.key;
          return (
            <Link
              key={item.key}
              href={item.href}
              className={`nav-btn ${isActive ? 'active' : ''}`}
              onClick={() => onNavigate(item.key, item.applicationId)}
              title={collapsed ? item.label : ''}
            >
              <span className="nav-icon" aria-hidden="true">{item.icon}</span>
              <span className="nav-label">{item.label}</span>
            </Link>
          );
        })}
        {children}
      </nav>
    </aside>
  );
}
