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
  const [tags, setTags] = useState([]);

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

  useEffect(() => {
    let isActive = true;

    const loadTags = async () => {
      try {
        const response = await fetch('/api/tags', { cache: 'no-store' });
        if (!response.ok) {
          throw new Error('Failed to load tags');
        }

        const payload = await response.json();
        if (!isActive) return;
        setTags(Array.isArray(payload.tags) ? payload.tags : []);
      } catch {
        if (!isActive) return;
        setTags([]);
      }
    };

    loadTags();

    return () => {
      isActive = false;
    };
  }, []);

  const toTagPath = (tagName) => `/tags/${encodeURIComponent(tagName.toLowerCase().replace(/\s+/g, '-'))}`;

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

        <div className="user-tag-nav stack">
          <Link
            href="/tags"
            className={`user-tag-link user-tag-root ${pathname === '/tags' ? 'active' : ''}`}
            onClick={() => onNavigate('tags')}
          >
            <span>Tags</span>
          </Link>
          {tags.map((tagName) => {
            const href = toTagPath(tagName);
            const isActive = pathname === href;

            return (
              <Link
                key={tagName}
                href={href}
                className={`user-tag-link ${isActive ? 'active' : ''}`}
                onClick={() => onNavigate('tag', tagName)}
              >
                <span>{tagName}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </aside>
  );
}
