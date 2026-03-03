'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from './ui/button';
import { Icon, icons } from './ui/icons';

const userMenu = [
  { key: 'home', label: 'Dashboard', href: '/dashboard', icon: icons.dashboard },
  { key: 'applications', label: 'Applications', href: '/dashboard?tab=applications', icon: icons.applications }
];

export function UserSidebar({ collapsed, onToggle, activeTab, onNavigate }) {
  const pathname = usePathname();

  return (
    <aside className={`border-r border-slate-200 bg-white p-3 transition-all duration-300 ${collapsed ? 'w-20' : 'w-64'}`}>
      <div className="flex items-center justify-between px-2 py-2">
        {!collapsed ? <p className="text-sm font-semibold text-slate-500">User Portal</p> : null}
        <Button variant="secondary" className="h-9 w-9 p-0" onClick={onToggle}>
          <Icon path={icons.chevron} className={`h-4 w-4 transition ${collapsed ? '' : 'rotate-180'}`} />
        </Button>
      </div>
      <nav className="mt-4 space-y-1">
        {userMenu.map((item) => {
          const isActive = pathname === '/dashboard' && activeTab === item.key;
          return (
            <Link key={item.key} href={item.href} onClick={() => onNavigate(item.key)} className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${isActive ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
              <Icon path={item.icon} className="h-4 w-4" />
              {!collapsed ? item.label : null}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
