'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { IconButton } from './ui/icon-button';

const userMenu = [
  { key: 'home', label: 'Home', href: '/dashboard', icon: '🏠' },
  { key: 'applications', label: 'Applications', href: '/dashboard?tab=applications', icon: '🧩' }
];

export function UserSidebar({ collapsed, onToggle, activeTab, onNavigate }) {
  const pathname = usePathname();

  return (
    <aside className={`sidebar ${collapsed ? 'compact' : ''}`}>
      <IconButton icon={collapsed ? '☰' : '←'} label="Toggle sidebar" onClick={onToggle} />
      <div className="stack sidebar-nav">
        {userMenu.map((item) => {
          const isActive = pathname === '/dashboard' && activeTab === item.key;
          return (
            <Link key={item.key} href={item.href} className={`nav-btn ${isActive ? 'active' : ''}`} onClick={() => onNavigate(item.key)} title={collapsed ? item.label : ''}>
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-label">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </aside>
  );
}
