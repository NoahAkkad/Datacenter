'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const userMenu = [
  { key: 'home', label: 'Home', href: '/dashboard' }
];

export function UserSidebar({ onNavigate }) {
  const pathname = usePathname();

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">Datacenter</div>
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
              {item.label}
            </Link>
          );
        })}
      </div>
    </aside>
  );
}
