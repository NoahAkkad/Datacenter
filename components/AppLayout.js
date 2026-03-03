'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';

const MOBILE_BREAKPOINT = 768;
const DESKTOP_BREAKPOINT = 1200;

export function AppLayout({ title, subtitle, profile, navigationItems, activeTab, onNavigate, children, actions, sidebarChildren }) {
  const pathname = usePathname();
  const [isMobile, setIsMobile] = useState(false);
  const [isTablet, setIsTablet] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const applyBreakpoints = () => {
      const width = window.innerWidth;
      const mobile = width < MOBILE_BREAKPOINT;
      const tablet = width >= MOBILE_BREAKPOINT && width < DESKTOP_BREAKPOINT;
      setIsMobile(mobile);
      setIsTablet(tablet);
      setCollapsed(tablet);
      if (!mobile) setMobileOpen(false);
    };

    applyBreakpoints();
    window.addEventListener('resize', applyBreakpoints);
    return () => window.removeEventListener('resize', applyBreakpoints);
  }, []);

  useEffect(() => {
    if (isMobile) setMobileOpen(false);
  }, [pathname, isMobile]);

  const shellClass = useMemo(() => {
    if (isMobile) return 'app-shell mobile';
    return `app-shell ${collapsed ? 'sidebar-collapsed' : 'sidebar-expanded'}`;
  }, [collapsed, isMobile]);

  return (
    <main className={shellClass}>
      <Sidebar
        items={navigationItems}
        collapsed={!isMobile && collapsed}
        mobileOpen={mobileOpen}
        isMobile={isMobile}
        activeTab={activeTab}
        onNavigate={onNavigate}
        onToggle={() => (isMobile ? setMobileOpen((value) => !value) : setCollapsed((value) => !value))}
      >
        {sidebarChildren}
      </Sidebar>

      <section className="app-main fade-in">
        <Topbar
          title={title}
          subtitle={subtitle}
          profile={profile}
          onMenuToggle={() => setMobileOpen((value) => !value)}
          showMenuButton={isMobile}
          actions={actions}
        />
        <div className="content-wrap">{children}</div>
      </section>

      {isMobile && mobileOpen ? <button className="sidebar-backdrop" aria-label="Close navigation" onClick={() => setMobileOpen(false)} /> : null}
    </main>
  );
}
