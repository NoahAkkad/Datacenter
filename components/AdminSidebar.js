'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from './ui/button';

const adminMenu = [
  { key: 'home', label: '🏠 Home', href: '/admin' },
  { key: 'companies', label: '🏢 Companies', href: '/admin?tab=companies' },
  { key: 'applications', label: '🧩 Applications', href: '/admin?tab=applications' },
  { key: 'fields', label: '🏷️ Dynamic Fields', href: '/admin?tab=fields' },
  { key: 'users', label: '👥 Users', href: '/admin?tab=users' },
  { key: 'upload', label: '📁 File Upload', href: '/admin?tab=upload' }
];

export function AdminSidebar({ collapsed, onToggle, activeTab, onNavigate, applications = [], selectedApplicationId = '' }) {
  const pathname = usePathname();

  return (
    <aside className={`sidebar ${collapsed ? 'compact' : ''}`}>
      <Button variant="secondary" onClick={onToggle}>{collapsed ? '➡️' : '⬅️'}</Button>
      <div className="stack sidebar-nav">
        {adminMenu.map((item) => {
          const isActive = pathname === '/admin' && activeTab === item.key;

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

        {!collapsed && activeTab === 'applications' ? (
          <div className="stack app-sidebar-list">
            {applications.map((application) => (
              <Link
                key={application.id}
                href={`/admin?tab=applications&applicationId=${application.id}`}
                className={`nav-sub-btn ${selectedApplicationId === application.id ? 'active' : ''}`}
                onClick={() => onNavigate('applications', application.id)}
              >
                {application.name}
              </Link>
            ))}
          </div>
        ) : null}
      </div>
    </aside>
  );
}
