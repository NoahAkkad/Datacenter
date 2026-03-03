'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { IconButton } from './ui/icon-button';

const adminMenu = [
  { key: 'home', label: 'Home', href: '/admin', icon: '🏠' },
  { key: 'companies', label: 'Companies', href: '/admin?tab=companies', icon: '🏢' },
  { key: 'applications', label: 'Applications', href: '/admin?tab=applications', icon: '🧩' },
  { key: 'fields', label: 'Dynamic Fields', href: '/admin?tab=fields', icon: '🏷️' },
  { key: 'users', label: 'Users', href: '/admin?tab=users', icon: '👥' },
  { key: 'upload', label: 'Company Information', href: '/admin?tab=upload', icon: '📁' }
];

export function AdminSidebar({ collapsed, onToggle, activeTab, onNavigate, applications = [], selectedApplicationId = '' }) {
  const pathname = usePathname();

  return (
    <aside className={`sidebar ${collapsed ? 'compact' : ''}`}>
      <IconButton icon={collapsed ? '☰' : '←'} label="Toggle sidebar" onClick={onToggle} />
      <div className="stack sidebar-nav">
        {adminMenu.map((item) => {
          const isActive = pathname === '/admin' && activeTab === item.key;
          return (
            <Link key={item.key} href={item.href} className={`nav-btn ${isActive ? 'active' : ''}`} onClick={() => onNavigate(item.key)} title={collapsed ? item.label : ''}>
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-label">{item.label}</span>
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
