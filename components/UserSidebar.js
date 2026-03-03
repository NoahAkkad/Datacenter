'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from './ui/button';

const userMenu = [
  { key: 'home', label: 'Home', href: '/dashboard' }
];

export function UserSidebar({ collapsed, onToggle, activeTab, onNavigate }) {
  const pathname = usePathname();

  return (
    <aside className={`sidebar ${collapsed ? 'compact' : ''}`}>
      <div className="sidebar-brand">{collapsed ? 'DC' : 'Datacenter'}</div>
      <Button variant="secondary" className="sidebar-toggle" onClick={onToggle}>{collapsed ? '→' : '←'}</Button>
      <div className="stack sidebar-nav">
        {userMenu.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith('/dashboard/application/');

          return (
            <Link
              key={item.key}
              href={item.href}
              className={`nav-btn ${isActive ? 'active' : ''}`}
              onClick={() => onNavigate(item.key)}
            >
              {collapsed ? item.label.split(' ')[0] : item.label}
            </Link>
          );
        })}
      </div>
    </aside>
  );
}
