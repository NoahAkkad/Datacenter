'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

const userMenu = [
  { key: 'home', label: 'Home', href: '/dashboard' }
];

export function UserSidebar({ onNavigate, companies = [], applications = [] }) {
  const pathname = usePathname();
  const [expandedCompanies, setExpandedCompanies] = useState({});

  const companyNavigation = useMemo(() => {
    return companies
      .map((company) => ({
        ...company,
        applications: applications.filter((application) => application.companyId === company.id)
      }))
      .filter((company) => company.applications.length > 0);
  }, [applications, companies]);

  useEffect(() => {
    const activeApplication = companyNavigation.find((company) => company.applications.some((application) => pathname === `/dashboard/application/${application.id}`));
    if (!activeApplication) return;

    setExpandedCompanies((current) => ({
      ...current,
      [activeApplication.id]: true
    }));
  }, [companyNavigation, pathname]);

  const toggleCompany = (companyId) => {
    setExpandedCompanies((current) => ({
      ...current,
      [companyId]: !current[companyId]
    }));
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">Datacenter</div>
      <div className="stack sidebar-nav">
        {userMenu.map((item) => {
          const isActive = pathname === item.href;

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

        <div className="user-company-nav stack">
          <p className="user-company-nav-title">Companies</p>
          {companyNavigation.map((company) => {
            const isExpanded = Boolean(expandedCompanies[company.id]);

            return (
              <div key={company.id} className="stack user-company-group">
                <button
                  type="button"
                  className="user-company-btn"
                  onClick={() => toggleCompany(company.id)}
                >
                  <span className="user-company-chevron">{isExpanded ? '▼' : '▶'}</span>
                  <span aria-hidden="true">📁</span>
                  <span className="user-company-label">{company.name}</span>
                </button>

                {isExpanded ? (
                  <div className="stack user-company-app-list">
                    {company.applications.map((application) => {
                      const href = `/dashboard/application/${application.id}`;
                      const isActive = pathname === href;

                      return (
                        <Link
                          key={application.id}
                          href={href}
                          className={`user-company-app-link ${isActive ? 'active' : ''}`}
                          onClick={() => onNavigate('application', application.id)}
                        >
                          <span aria-hidden="true">🧩</span>
                          <span>{application.name}</span>
                        </Link>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </aside>
  );
}
