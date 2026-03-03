'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from './ui/button';
import { Icon, icons } from './ui/icons';

const adminMenu = [
  { key: 'home', label: 'Dashboard', href: '/admin', icon: icons.dashboard },
  { key: 'companies', label: 'Companies', href: '/admin?tab=companies', icon: icons.companies },
  { key: 'applications', label: 'Applications', href: '/admin?tab=applications', icon: icons.applications },
  { key: 'tags', label: 'Tags', href: '/admin?tab=tags', icon: icons.tags },
  { key: 'fields', label: 'Fields', href: '/admin?tab=fields', icon: icons.fields },
  { key: 'records', label: 'Records', href: '/admin?tab=records', icon: icons.records },
  { key: 'settings', label: 'Settings', href: '/admin?tab=settings', icon: icons.settings }
];

export function AdminSidebar({ collapsed, onToggle, activeTab, onNavigate }) {
  const pathname = usePathname();

  return (
    <aside className={`border-r border-slate-200 bg-white p-3 transition-all duration-300 ${collapsed ? 'w-20' : 'w-72'}`}>
      <div className="flex items-center justify-between px-2 py-2">
        {!collapsed ? <p className="text-sm font-semibold text-slate-500">Admin Console</p> : null}
        <Button variant="secondary" className="h-9 w-9 p-0" onClick={onToggle}>
          <Icon path={icons.chevron} className={`h-4 w-4 transition ${collapsed ? '' : 'rotate-180'}`} />
        </Button>
      </div>
      <nav className="mt-4 space-y-1">
        {adminMenu.map((item) => {
          const isActive = pathname === '/admin' && activeTab === item.key;
          return (
            <Link
              key={item.key}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${isActive ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}
              onClick={() => onNavigate(item.key)}
            >
              <Icon path={item.icon} className="h-4 w-4" />
              {!collapsed ? item.label : null}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
