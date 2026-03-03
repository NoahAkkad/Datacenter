'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Modal } from '../../components/ui/modal';
import { DataTable } from '../../components/ui/table';
import { AdminSidebar } from '../../components/AdminSidebar';
import { GroupedFieldsView } from '../../components/GroupedFieldsView';
import { formatDateOnly } from '../../lib/formatDate';

export default function AdminPage() {
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [active, setActive] = useState('home');
  const [data, setData] = useState([]);
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedCompany, setSelectedCompany] = useState('');
  const [selectedApp, setSelectedApp] = useState('');
  const [selectedFieldCompany, setSelectedFieldCompany] = useState('');
  const [selectedFieldApp, setSelectedFieldApp] = useState('');
  const [selectedCompanyApplication, setSelectedCompanyApplication] = useState('');
  const [companyApplications, setCompanyApplications] = useState([]);
  const [isFetchingCompanyApplications, setIsFetchingCompanyApplications] = useState(false);
  const [recordTextValues, setRecordTextValues] = useState({});
  const [recordFiles, setRecordFiles] = useState({});
  const [companyFieldPayload, setCompanyFieldPayload] = useState(null);
  const [isFetchingCompanyFields, setIsFetchingCompanyFields] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  const [companyModal, setCompanyModal] = useState(false);
  const [duplicateCompanyModal, setDuplicateCompanyModal] = useState({ open: false, sourceCompanyId: '', sourceCompanyName: '' });
  const [appModal, setAppModal] = useState(false);
  const [fieldModal, setFieldModal] = useState(false);
  const [userModal, setUserModal] = useState(false);
  const [tagModal, setTagModal] = useState(false);
  const [confirmModal, setConfirmModal] = useState({ open: false, type: '', id: '', label: '' });
  const [editing, setEditing] = useState({ open: false, type: '', id: '', payload: {}, title: '' });

  const [companyName, setCompanyName] = useState('');
  const [duplicateCompanyName, setDuplicateCompanyName] = useState('');
  const [appName, setAppName] = useState('');
  const [fieldForm, setFieldForm] = useState({ name: '', type: 'text', tagId: '' });
  const [userForm, setUserForm] = useState({ username: '', password: '' });
  const [tagForm, setTagForm] = useState({ scope: 'application', companyId: '', applicationId: '', name: '', description: '', presetKey: '' });
  const [tagPresetOptions, setTagPresetOptions] = useState([]);
  const [checkingSession, setCheckingSession] = useState(true);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [duplicatingCompany, setDuplicatingCompany] = useState(false);
  const [currentUserId, setCurrentUserId] = useState('');
  const [deletingUserId, setDeletingUserId] = useState('');
  const [globalTagConfirmOpen, setGlobalTagConfirmOpen] = useState(false);

  useEffect(() => {
    const validateSession = async () => {
      const response = await fetch('/api/auth/me');
      if (!response.ok) {
        router.replace('/login?portal=admin');
        return;
      }

      const user = await response.json();
      if (user.role !== 'admin') {
        router.replace('/dashboard');
        return;
      }
      setCurrentUserId(user.id || '');
      setCheckingSession(false);
    };

    validateSession();
  }, [router]);

  const applications = useMemo(
    () => data.flatMap((company) => company.applications.map((app) => ({ ...app, companyName: company.name }))),
    [data]
  );

  const companyById = useMemo(
    () => Object.fromEntries(data.map((company) => [company.id, company])),
    [data]
  );

  const tagRows = useMemo(() => {
    const byId = new Map();
    applications.forEach((application) => {
      (application.tags || []).forEach((tag) => {
        if (byId.has(tag.id)) return;
        const scope = tag.scope || (tag.allApplications ? 'company' : 'application');
        const scopeMeta = scope === 'global'
          ? { label: '🌍 Global', applicationName: 'All Applications', companyName: 'All Companies' }
          : scope === 'company'
            ? { label: '🏢 Company', applicationName: 'All Applications', companyName: companyById[tag.companyId]?.name || application.companyName || 'Unknown Company' }
            : { label: '🧩 Application', applicationName: application.name, companyName: companyById[tag.companyId]?.name || application.companyName || 'Unknown Company' };

        byId.set(tag.id, {
          ...tag,
          scope,
          scopeLabel: scopeMeta.label,
          applicationName: scopeMeta.applicationName,
          companyName: scopeMeta.companyName
        });
      });
    });
    return Array.from(byId.values());
  }, [applications, companyById]);

  const fields = useMemo(
    () => applications
      .flatMap((app) => app.fields || [])
      .map((field) => ({ ...field, appName: applications.find((app) => app.id === field.applicationId)?.name || '-' })),
    [applications]
  );

  const records = useMemo(
    () => applications.flatMap((app) => (app.records || []).map((record) => ({ ...record, appName: app.name }))),
    [applications]
  );

  const applicationRecords = useMemo(
    () => (selectedApp ? records.filter((record) => record.applicationId === selectedApp) : records),
    [records, selectedApp]
  );

  const selectedApplication = useMemo(
    () => applications.find((entry) => entry.id === selectedApp),
    [applications, selectedApp]
  );

  const selectedCompanyInfo = useMemo(
    () => data.find((company) => company.id === selectedCompany),
    [data, selectedCompany]
  );

  const fieldCompanyApplications = useMemo(
    () => applications.filter((application) => !selectedFieldCompany || application.companyId === selectedFieldCompany),
    [applications, selectedFieldCompany]
  );

  const selectedFieldApplication = useMemo(
    () => fieldCompanyApplications.find((application) => application.id === selectedFieldApp),
    [fieldCompanyApplications, selectedFieldApp]
  );

  const availableTags = useMemo(
    () => (selectedFieldApplication?.tags || [])
      .map((tag) => {
        const scope = tag.scope || (tag.allApplications ? 'company' : 'application');
        const scopeLabel = scope === 'company' ? 'Company Global' : scope === 'global' ? 'System Global' : 'Company';
        return {
          ...tag,
          scope,
          scopeLabel,
          labeledName: `${tag.name} (${scopeLabel})`
        };
      })
      .sort((a, b) => {
        const priority = { application: 0, company: 1, global: 2 };
        return (priority[a.scope] ?? 99) - (priority[b.scope] ?? 99) || a.name.localeCompare(b.name);
      }),
    [selectedFieldApplication]
  );

  const groupedAvailableTags = useMemo(() => ({
    application: availableTags.filter((tag) => tag.scope === 'application'),
    company: availableTags.filter((tag) => tag.scope === 'company'),
    global: availableTags.filter((tag) => tag.scope === 'global')
  }), [availableTags]);


  useEffect(() => {
    if (!selectedFieldCompany) return;
    const isAppInCompany = applications.some((application) => application.id === selectedFieldApp && application.companyId === selectedFieldCompany);
    if (!isAppInCompany) {
      setSelectedFieldApp('');
      setFieldForm((current) => ({ ...current, tagId: '' }));
    }
  }, [applications, selectedFieldApp, selectedFieldCompany]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get('tab');
    const applicationId = params.get('applicationId') || '';
    const allowedTabs = ['home', 'companies', 'applications', 'fields', 'users', 'upload'];
    setActive(allowedTabs.includes(tab) ? tab : 'home');
    setSelectedApp(applicationId);
  }, []);

  const refresh = async () => {
    const [companyResponse, userResponse] = await Promise.all([
      fetch('/api/companies'),
      fetch('/api/users')
    ]);

    if (companyResponse.ok) setData(await companyResponse.json());
    if (userResponse.ok) setUsers(await userResponse.json());
  };

  useEffect(() => {
    if (checkingSession) return;
    refresh();
  }, [checkingSession]);

  useEffect(() => {
    if (checkingSession) return;
    const loadTagPresets = async () => {
      try {
        const response = await fetch('/api/tag-presets');
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          setTagPresetOptions([]);
          return;
        }
        setTagPresetOptions(payload.presets || []);
      } catch {
        setTagPresetOptions([]);
      }
    };

    loadTagPresets();
  }, [checkingSession]);

  const onLogout = async () => {
    setIsLoggingOut(true);
    try {
      await fetch('/api/logout', { method: 'POST' });
    } finally {
      window.localStorage.removeItem('authToken');
      window.sessionStorage.removeItem('authToken');
      setIsLoggingOut(false);
      setLogoutConfirmOpen(false);
      setProfileMenuOpen(false);
      router.replace('/login?portal=admin');
      router.refresh();
    }
  };

  const createCompany = async () => {
    await fetch('/api/companies', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: companyName }) });
    setCompanyModal(false);
    setCompanyName('');
    refresh();
  };

  const openDuplicateCompanyModal = (company) => {
    setDuplicateCompanyModal({ open: true, sourceCompanyId: company.id, sourceCompanyName: company.name });
    setDuplicateCompanyName(`${company.name} Copy`);
    setStatusMessage('');
  };

  const duplicateCompany = async () => {
    if (!duplicateCompanyModal.sourceCompanyId || !duplicateCompanyName.trim()) {
      setStatusMessage('New company name is required.');
      return;
    }

    setDuplicatingCompany(true);
    try {
      const response = await fetch(`/api/companies/${duplicateCompanyModal.sourceCompanyId}/duplicate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: duplicateCompanyName.trim() })
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setStatusMessage(payload.error || 'Company duplication failed.');
        return;
      }

      setStatusMessage(`Company duplicated successfully as ${payload.name || duplicateCompanyName.trim()}.`);
      setDuplicateCompanyModal({ open: false, sourceCompanyId: '', sourceCompanyName: '' });
      setDuplicateCompanyName('');
      refresh();
    } catch {
      setStatusMessage('Company duplication failed. Please retry.');
    } finally {
      setDuplicatingCompany(false);
    }
  };

  const createApp = async () => {
    await fetch(`/api/companies/${selectedCompany}/applications`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: appName }) });
    setAppModal(false);
    setAppName('');
    refresh();
  };

  const createField = async () => {
    const isBulkCreate = selectedFieldApp === '__all__';
    const endpoint = isBulkCreate ? '/api/applications/all/fields' : `/api/applications/${selectedFieldApp}/fields`;

    if (!fieldForm.tagId) {
      setStatusMessage('Selecting a tag is required to create a field.');
      return;
    }
    const payload = isBulkCreate
      ? { ...fieldForm, applicationIds: applications.map((application) => application.id) }
      : fieldForm;

    setStatusMessage('');
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const responsePayload = await response.json();
      if (!response.ok) {
        setStatusMessage(responsePayload.error || 'Field creation failed.');
        return;
      }

      setFieldModal(false);
      setSelectedFieldApp('');
      setFieldForm({ name: '', type: 'text', tagId: '' });
      setStatusMessage(isBulkCreate ? 'Field successfully added to all applications' : 'Field successfully added');
      refresh();
    } catch {
      setStatusMessage('Field creation request failed. Please retry.');
    }
  };

  const createUser = async () => {
    await fetch('/api/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...userForm, role: 'user' }) });
    setUserModal(false);
    setUserForm({ username: '', password: '' });
    refresh();
  };

  const createTag = async (confirmGlobal = false) => {
    setStatusMessage('');
    const isGlobalScope = tagForm.scope === 'global';

    if (isGlobalScope && !confirmGlobal) {
      setGlobalTagConfirmOpen(true);
      return;
    }

    if (tagForm.scope === 'company' && !tagForm.companyId) {
      setStatusMessage('Please choose a company for company-scoped tags.');
      return;
    }

    if (tagForm.scope === 'application' && !tagForm.applicationId) {
      setStatusMessage('Please choose an application for application-scoped tags.');
      return;
    }

    const endpointId = tagForm.scope === 'application' ? tagForm.applicationId : 'all';
    const payloadBody = {
      name: tagForm.name,
      description: tagForm.description,
      scope: tagForm.scope,
      companyId: tagForm.scope === 'company' ? tagForm.companyId : undefined,
      presetKey: tagForm.presetKey || undefined,
      confirmGlobal: isGlobalScope ? confirmGlobal : undefined
    };

    try {
      const response = await fetch(`/api/applications/${endpointId}/tags`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payloadBody)
      });
      const payload = await response.json();
      if (!response.ok) {
        setStatusMessage(payload.error || 'Tag creation failed.');
        return;
      }
      setTagModal(false);
      setGlobalTagConfirmOpen(false);
      setTagForm({ scope: 'application', companyId: '', applicationId: '', name: '', description: '', presetKey: '' });

      if (payload?.preset?.skippedCount > 0) {
        setStatusMessage('Tag added. Some fields were skipped because they already exist.');
      } else if (payload?.preset?.createdCount > 0) {
        setStatusMessage(`Tag and ${payload.preset.createdCount} preset field(s) added successfully.`);
      } else {
        setStatusMessage('Tag successfully added.');
      }
      refresh();
    } catch {
      setStatusMessage('Tag creation request failed. Please retry.');
    }
  };

  const fetchCompanyApplications = async (companyId) => {
    if (!companyId) {
      setCompanyApplications([]);
      return;
    }

    setIsFetchingCompanyApplications(true);
    try {
      const response = await fetch(`/api/company/${companyId}/applications`);
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setCompanyApplications([]);
        setStatusMessage(payload.error || 'Unable to load company applications.');
        return;
      }
      setCompanyApplications(payload.applications || []);
    } catch {
      setCompanyApplications([]);
      setStatusMessage('Unable to load company applications. Please retry.');
    } finally {
      setIsFetchingCompanyApplications(false);
    }
  };

  const fetchCompanyFields = async (companyId, applicationId) => {
    if (!companyId || !applicationId) {
      setCompanyFieldPayload(null);
      setRecordTextValues({});
      setRecordFiles({});
      return;
    }

    setIsFetchingCompanyFields(true);
    setStatusMessage('');
    try {
      const response = await fetch(`/api/company/${companyId}/fields?applicationId=${applicationId}`);
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setCompanyFieldPayload(null);
        setRecordTextValues({});
        setRecordFiles({});
        setStatusMessage(payload.error || 'Unable to load company information.');
        return;
      }

      const initialValues = {};
      (payload.applications || []).forEach((application) => {
        (application.fields || []).forEach((field) => {
          if (field.type === 'text' || field.type === 'link' || field.type === 'number') {
            initialValues[field.id] = application.values?.[field.id] || '';
          }
        });
      });

      setCompanyFieldPayload(payload);
      setRecordTextValues(initialValues);
      setRecordFiles({});
      if (!payload.hasData) {
        setStatusMessage('No company information found yet. Add details and click Update Information.');
      }
    } catch {
      setCompanyFieldPayload(null);
      setRecordTextValues({});
      setRecordFiles({});
      setStatusMessage('Unable to load company information. Please retry.');
    } finally {
      setIsFetchingCompanyFields(false);
    }
  };

  const updateCompanyInformation = async () => {
    if (!selectedCompany || !selectedCompanyApplication || !companyFieldPayload?.applications?.length) {
      setStatusMessage('Please choose a company and application first.');
      return;
    }

    setStatusMessage('');

    try {
      const updates = companyFieldPayload.applications.map(async (application) => {
        const formData = new FormData();
        const textValues = (application.fields || []).reduce((accumulator, field) => {
          if (field.type === 'text' || field.type === 'link' || field.type === 'number') {
            accumulator[field.id] = recordTextValues[field.id] || '';
          }
          return accumulator;
        }, {});

        formData.append('values', JSON.stringify(textValues));
        (application.fields || [])
          .filter((field) => field.type === 'pdf' || field.type === 'image')
          .forEach((field) => {
            const file = recordFiles[field.id];
            if (file) {
              formData.append(field.id, file);
            }
          });

        const response = await fetch(`/api/applications/${application.applicationId}/records`, {
          method: 'POST',
          body: formData
        });

        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload.error || `Failed to update ${application.applicationName}`);
        }
      });

      await Promise.all(updates);
      setStatusMessage('Company information updated successfully.');
      await fetchCompanyFields(selectedCompany, selectedCompanyApplication);
      await refresh();
    } catch (error) {
      setStatusMessage(error?.message || 'Company information update failed.');
    }
  };

  const openDelete = (type, id, label) => setConfirmModal({ open: true, type, id, label });

  const openEdit = (type, row) => {
    if (type === 'company') setEditing({ open: true, type, id: row.id, payload: { name: row.name }, title: 'Edit Company' });
    if (type === 'application') setEditing({ open: true, type, id: row.id, payload: { name: row.name }, title: 'Edit Application' });
    if (type === 'field') setEditing({ open: true, type, id: row.id, payload: { name: row.name, type: row.type || 'text', tagId: row.tagId || '' }, title: 'Edit Field' });
    if (type === 'tag') setEditing({ open: true, type, id: row.id, payload: { name: row.name, description: row.description || '', scope: row.scope || (row.allApplications ? 'company' : 'application'), companyId: row.companyId || '', applicationId: row.applicationId || '' }, title: 'Edit Tag' });
    if (type === 'data') setEditing({ open: true, type, id: row.id, payload: { values: row.values || {} }, title: `Edit Record ${row.id}` });
    if (type === 'user') setEditing({ open: true, type, id: row.id, payload: { username: row.username, password: '' }, title: 'Edit User' });
  };

  const applyOptimisticEdit = (type, id, updatedEntity) => {
    if (type === 'company') {
      setData((current) => current.map((company) => (company.id === id ? { ...company, ...updatedEntity } : company)));
      return;
    }

    if (type === 'application') {
      setData((current) => current.map((company) => ({
        ...company,
        applications: company.applications.map((application) => (application.id === id ? { ...application, ...updatedEntity } : application))
      })));
      return;
    }

    if (type === 'field') {
      setData((current) => current.map((company) => ({
        ...company,
        applications: company.applications.map((application) => ({
          ...application,
          fields: (application.fields || []).map((field) => (field.id === id ? { ...field, ...updatedEntity } : field))
        }))
      })));
      return;
    }

    if (type === 'data') {
      setData((current) => current.map((company) => ({
        ...company,
        applications: company.applications.map((application) => ({
          ...application,
          records: (application.records || []).map((record) => (record.id === id ? { ...record, ...updatedEntity } : record))
        }))
      })));
      return;
    }

    if (type === 'user') {
      setUsers((current) => current.map((user) => (user.id === id ? { ...user, ...updatedEntity } : user)));
      return;
    }

    if (type === 'tag') {
      setData((current) => current.map((company) => ({
        ...company,
        applications: company.applications.map((application) => ({
          ...application,
          tags: (application.tags || []).map((tag) => (tag.id === id ? { ...tag, ...updatedEntity } : tag))
        }))
      })));
    }
  };

  const executeEdit = async () => {
    const { type, id, payload: draftPayload } = editing;

    const endpointMap = {
      company: `/api/companies/${id}`,
      application: `/api/applications/${id}`,
      field: `/api/fields/${id}`,
      data: `/api/records/${id}`,
      user: `/api/users/${id}`,
      tag: `/api/tags/${id}`
    };

    if (!endpointMap[type] || !id) {
      setStatusMessage('Unable to submit edit: missing entity type or ID.');
      return;
    }

    const payload = { ...draftPayload };
    if (type === 'user' && !payload.password) delete payload.password;
    if (type === 'field' && payload.order === '') delete payload.order;
    if (type === 'field' && !payload.tagId) payload.tagId = '';
    if (type === 'tag' && payload.scope === 'global') payload.confirmGlobal = true;

    if ((type === 'company' || type === 'application' || type === 'tag') && !String(payload.name || '').trim()) {
      setStatusMessage('Name is required.');
      return;
    }

    if (type === 'user' && !String(payload.username || '').trim()) {
      setStatusMessage('Username is required.');
      return;
    }

    setSavingEdit(true);
    setStatusMessage('');
    try {
      const response = await fetch(endpointMap[type], {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const responseText = await response.text();
      let responsePayload = {};
      if (responseText) {
        try {
          responsePayload = JSON.parse(responseText);
        } catch {
          responsePayload = { error: responseText };
        }
      }
      if (!response.ok) {
        setStatusMessage(`Update failed: ${responsePayload.error || 'unknown error'}`);
        return;
      }

      if (responsePayload.success !== undefined && !responsePayload.success) {
        setStatusMessage(`Update failed: ${responsePayload.error || 'unknown error'}`);
        return;
      }

      applyOptimisticEdit(type, id, responsePayload.data || {});
      setEditing({ open: false, type: '', id: '', payload: {}, title: '' });
      setStatusMessage(responsePayload.message || 'Update completed successfully.');
      await refresh();
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('[admin:update] request failed', {
        type,
        id,
        error: error?.message
      });
      setStatusMessage(`Update failed: ${error?.message || 'request error'}`);
    } finally {
      setSavingEdit(false);
    }
  };

  const optimisticDelete = (type, id) => {
    if (type === 'company') {
      setData((current) => current.filter((entry) => entry.id !== id));
      return;
    }

    if (type === 'application') {
      setData((current) => current.map((company) => ({ ...company, applications: company.applications.filter((app) => app.id !== id) })));
      return;
    }

    if (type === 'field') {
      setData((current) => current.map((company) => ({
        ...company,
        applications: company.applications.map((app) => ({ ...app, fields: (app.fields || []).filter((field) => field.id !== id) }))
      })));
      return;
    }

    if (type === 'data') {
      setData((current) => current.map((company) => ({
        ...company,
        applications: company.applications.map((app) => ({ ...app, records: (app.records || []).filter((record) => record.id !== id) }))
      })));
      return;
    }

    if (type === 'user') {
      setUsers((current) => current.filter((user) => user.id !== id));
    }
  };

  const executeDelete = async () => {
    const { type, id } = confirmModal;
    const endpointMap = {
      company: `/api/company/${id}`,
      application: `/api/application/${id}`,
      field: `/api/field/${id}`,
      data: `/api/data/${id}`,
      user: `/api/users/${id}`,
      tag: `/api/tags/${id}`
    };

    if (type === 'user') {
      setDeletingUserId(id);
    }

    setDeleting(true);
    setStatusMessage('');
    try {
      const response = await fetch(endpointMap[type], {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: true })
      });
      const payload = await response.json();
      if (!response.ok) {
        setStatusMessage(payload.error || 'Delete failed.');
        return;
      }
      optimisticDelete(type, id);
      setConfirmModal({ open: false, type: '', id: '', label: '' });
      setStatusMessage(payload.message || 'Deletion completed successfully.');
      refresh();
    } catch {
      setStatusMessage('Delete request failed. Please retry.');
    } finally {
      setDeleting(false);
      setDeletingUserId('');
    }
  };

  const filteredCompanies = data.filter((company) => company.name.toLowerCase().includes(search.toLowerCase()));

  const onSidebarNavigate = (tab, applicationId = '') => {
    setActive(tab);
    if (tab === 'applications') {
      setSelectedApp(applicationId);
    }
    if (tab === 'home') {
      setSearch('');
      setSelectedCompany('');
      setSelectedApp('');
      setRecordTextValues({});
      setRecordFiles({});
      setCompanyFieldPayload(null);
      setStatusMessage('');
    }
  };

  if (checkingSession) {
    return (
      <main className="page-center">
        <Card>Validating session...</Card>
      </main>
    );
  }

  return (
    <main className="admin-shell">
      <AdminSidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed((value) => !value)}
        activeTab={active}
        onNavigate={onSidebarNavigate}
        applications={applications}
        selectedApplicationId={selectedApp}
      />

      <section className="main">
        <header className="topbar">
          <div>
            <h1 className="login-title">Admin Dashboard</h1>
            <p className="subtitle">Structured management for all data center entities.</p>
          </div>
          <div className="profile">
            <button className="profile-trigger" onClick={() => setProfileMenuOpen((value) => !value)}>
              <strong>Administrator</strong>
              <p className="subtitle">admin@datacenter.io</p>
            </button>
            {profileMenuOpen ? <div className="profile-menu"><button className="menu-item danger" onClick={() => setLogoutConfirmOpen(true)}>Logout</button></div> : null}
          </div>
        </header>

        {statusMessage ? <p className="error">{statusMessage}</p> : null}

        <Card>
          <div className="row">
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search companies" />
            <Button onClick={() => setCompanyModal(true)}>New Company</Button>
            <Button variant="secondary" onClick={() => setAppModal(true)}>New Application</Button>
            <Button variant="secondary" onClick={() => setFieldModal(true)}>New Field</Button>
            <Button variant="secondary" onClick={() => setTagModal(true)}>New Tag</Button>
            <Button variant="secondary" onClick={() => setUserModal(true)}>New User</Button>
          </div>
        </Card>

        {active === 'home' || active === 'companies' ? <div className="grid-2 section-gap">
          <Card className="stack">
            <h2>Companies Management</h2>
            <DataTable
              columns={[
                { key: 'name', label: 'Company Name' },
                { key: 'apps', label: 'Applications', render: (row) => row.applications.length },
                {
                  key: 'actions',
                  label: 'Actions',
                  render: (row) => (
                    <div className="row">
                      <Button variant="secondary" onClick={() => openEdit('company', row)}>Edit</Button>
                      <Button
                        variant="secondary"
                        className="icon-button"
                        title="Duplicate company"
                        aria-label={`Duplicate ${row.name}`}
                        onClick={() => openDuplicateCompanyModal(row)}
                      >
                        📄
                      </Button>
                      <Button onClick={() => openDelete('company', row.id, row.name)}>Delete</Button>
                    </div>
                  )
                }
              ]}
              data={filteredCompanies}
            />
          </Card>
          {active === 'home' ? <Card className="stack">
            <h2>Applications per Company</h2>
            <DataTable
              columns={[
                { key: 'name', label: 'Application' },
                { key: 'companyName', label: 'Company' },
                { key: 'fields', label: 'Fields', render: (row) => row.fields?.length || 0 },
                {
                  key: 'actions',
                  label: 'Actions',
                  render: (row) => <div className="row"><Button variant="secondary" onClick={() => openEdit('application', row)}>Edit</Button><Button onClick={() => openDelete('application', row.id, row.name)}>Delete</Button></div>
                }
              ]}
              data={applications}
            />
          </Card> : null}
        </div> : null}

        {active === 'home' || active === 'applications' || active === 'fields' ? <div className="grid-2 section-gap">
          {active === 'home' || active === 'fields' ? <Card className="stack">
            <h2>Dynamic Fields Management</h2>
            {fields.map((field) => (
              <div className="row" key={field.id}>
                <Badge>{field.name} · {field.type} · {field.tagName || 'Uncategorized'} · {field.appName}</Badge>
                <div className="row"><Button variant="secondary" onClick={() => openEdit('field', field)}>Edit</Button><Button variant="secondary" onClick={() => openDelete('field', field.id, field.name)}>Delete</Button></div>
              </div>
            ))}
            <h3 className="section-mini-gap">Tag Management</h3>
            {tagRows.map((tag) => (
              <div className="row" key={tag.id}>
                <Badge>{tag.name} · {tag.scopeLabel} · {tag.applicationName} · {tag.companyName}</Badge>
                <div className="row"><Button variant="secondary" onClick={() => openEdit('tag', tag)}>Edit</Button><Button variant="secondary" onClick={() => openDelete('tag', tag.id, tag.name)}>Delete</Button></div>
              </div>
            ))}
          </Card> : null}
          {active === 'home' || active === 'applications' ? <Card className="stack">
            <h2>Applications Management</h2>
            <DataTable
              columns={[
                { key: 'name', label: 'Application' },
                { key: 'companyName', label: 'Company' },
                { key: 'fields', label: 'Fields', render: (row) => row.fields?.length || 0 },
                { key: 'records', label: 'Records', render: (row) => row.records?.length || 0 },
                {
                  key: 'actions',
                  label: 'Actions',
                  render: (row) => <div className="row"><Button variant="secondary" onClick={() => openEdit('application', row)}>Edit</Button><Button onClick={() => openDelete('application', row.id, row.name)}>Delete</Button></div>
                }
              ]}
              data={applications}
            />

            {active === 'applications' ? <>
              <h2 className="section-mini-gap">{selectedApplication?.name ? `${selectedApplication.name} Records` : 'Application Records'}</h2>
              <DataTable
                columns={[
                  { key: 'appName', label: 'Application' },
                  { key: 'id', label: 'Record ID' },
                  {
                    key: 'actions',
                    label: 'Actions',
                    render: (row) => <div className="row"><Button variant="secondary" onClick={() => openEdit('data', row)}>Edit</Button><Button variant="secondary" onClick={() => openDelete('data', row.id, `${row.appName} / ${row.id}`)}>Delete</Button></div>
                  }
                ]}
                data={applicationRecords}
              />
            </> : null}
          </Card> : null}
        </div> : null}

        {active === 'home' || active === 'upload' ? <div className="grid-2 section-gap"><Card className="stack">
          <h2>Company Information</h2>
          <div className="row">
            <select className="select" value={selectedCompany} onChange={(event) => {
              const companyId = event.target.value;
              setSelectedCompany(companyId);
              setSelectedCompanyApplication('');
              setCompanyFieldPayload(null);
              setRecordTextValues({});
              setRecordFiles({});
              setStatusMessage('');
              fetchCompanyApplications(companyId);
            }}>
              <option value="">Select company</option>
              {data.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}
            </select>
            <select className="select" value={selectedCompanyApplication} disabled={!selectedCompany || isFetchingCompanyApplications || !companyApplications.length} onChange={(event) => {
              const applicationId = event.target.value;
              setSelectedCompanyApplication(applicationId);
              fetchCompanyFields(selectedCompany, applicationId);
            }}>
              <option value="">Select application</option>
              {companyApplications.map((application) => <option key={application.id} value={application.id}>{application.name}</option>)}
            </select>
          </div>

          {isFetchingCompanyApplications ? <p className="subtitle">Loading applications...</p> : null}
          {selectedCompany && !isFetchingCompanyApplications && !companyApplications.length ? <p className="subtitle">No applications found for this company.</p> : null}
          {selectedCompany && companyApplications.length > 0 && !selectedCompanyApplication ? <p className="subtitle">Select an application to view company information.</p> : null}
          {isFetchingCompanyFields ? <p className="subtitle">Loading company information...</p> : null}
          {selectedCompanyInfo && selectedCompanyApplication && !isFetchingCompanyFields && companyFieldPayload && !companyFieldPayload.hasData ? <p className="subtitle">No saved information exists for {selectedCompanyInfo.name} yet.</p> : null}

          {companyFieldPayload?.applications?.map((application) => {
            const createdDate = formatDateOnly(application.recordCreatedAt);
            const updatedDate = formatDateOnly(application.recordUpdatedAt);
            const hasMetadata = Boolean(createdDate || updatedDate);

            return (
              <div key={application.applicationId} className="stack">
              <div>
                <Badge>{application.applicationName}</Badge>
                {hasMetadata ? (
                  <div>
                    {createdDate ? <p className="subtitle">Created: {createdDate}</p> : null}
                    {updatedDate ? <p className="subtitle">Updated: {updatedDate}</p> : null}
                  </div>
                ) : null}
              </div>
              <GroupedFieldsView groupedFields={application.groupedFields || []} />
              {(application.groupedFields || []).map((tagGroup) => {
                const fieldsForTag = (application.fields || []).filter((field) => field.tagId === tagGroup.id);
                if (!fieldsForTag.length) {
                  return null;
                }

                return (
                  <div key={`${application.applicationId}-${tagGroup.id}`} className="tag-section stack">
                    <div>
                      <div className="tag-title-wrap">
                        <h3 className="tag-title">{tagGroup.name}</h3>
                        <span className="tag-scope">{tagGroup.scopeLabel}</span>
                      </div>
                      <div className="company-edit-tag-divider" />
                    </div>

                    {fieldsForTag.map((field) => {
                      const existingValue = application.values?.[field.id];
                      if (field.type === 'text' || field.type === 'link' || field.type === 'number') {
                        return (
                          <div key={field.id}>
                            <strong>{field.name}</strong>
                            <Input
                              type={field.type === 'link' ? 'url' : field.type === 'number' ? 'number' : 'text'}
                              placeholder={field.type === 'link' ? 'https://example.com' : ''}
                              value={recordTextValues[field.id] || ''}
                              onChange={(event) => setRecordTextValues((current) => ({ ...current, [field.id]: event.target.value }))}
                            />
                          </div>
                        );
                      }

                      return (
                        <div key={field.id} className="stack">
                          <strong>{field.name}</strong>
                          {existingValue?.url ? <a href={existingValue.url} target="_blank" rel="noopener noreferrer">Current file: {existingValue.originalname || existingValue.filename || 'Open file'}</a> : <p className="subtitle">No file uploaded yet.</p>}
                          <Input type="file" accept={field.type === 'pdf' ? 'application/pdf' : 'image/*'} onChange={(event) => setRecordFiles((current) => ({ ...current, [field.id]: event.target.files?.[0] }))} />
                        </div>
                      );
                    })}
                  </div>
                );
              })}
              </div>
            );
          })}

          <Button onClick={updateCompanyInformation} disabled={!selectedCompany || !selectedCompanyApplication || isFetchingCompanyFields}>Update Information</Button>
        </Card></div> : null}

        {active === 'users' ? <div className="grid-2 section-gap">
          <Card className="stack">
            <h2>User Management</h2>
            <p className="subtitle">Create and manage normal users.</p>
            <Button onClick={() => setUserModal(true)}>New User</Button>
            <DataTable
              columns={[
                { key: 'username', label: 'Username' },
                { key: 'role', label: 'Role' },
                {
                  key: 'actions',
                  label: 'Actions',
                  render: (row) => (
                    <div className="row">
                      <Button variant="secondary" onClick={() => openEdit('user', row)}>Edit</Button>
                      {row.role === 'admin' || row.id === currentUserId
                        ? <Button disabled title="Protected account">🗑️ Delete</Button>
                        : <Button onClick={() => openDelete('user', row.id, row.username)} disabled={deletingUserId === row.id}>{deletingUserId === row.id ? 'Deleting...' : '🗑️ Delete'}</Button>}
                    </div>
                  )
                }
              ]}
              data={users}
            />
          </Card>
        </div> : null}
      </section>

      <Modal open={companyModal} onClose={() => setCompanyModal(false)} title="Create Company">
        <Input placeholder="Company name" value={companyName} onChange={(event) => setCompanyName(event.target.value)} />
        <Button onClick={createCompany} disabled={!companyName.trim()}>Create</Button>
      </Modal>

      <Modal
        open={duplicateCompanyModal.open}
        onClose={() => !duplicatingCompany && setDuplicateCompanyModal({ open: false, sourceCompanyId: '', sourceCompanyName: '' })}
        title="Duplicate company"
      >
        <p className="subtitle">Create a structural copy of {duplicateCompanyModal.sourceCompanyName || 'the selected company'}.</p>
        <Input
          placeholder="New company name"
          value={duplicateCompanyName}
          onChange={(event) => setDuplicateCompanyName(event.target.value)}
        />
        <div className="row">
          <Button variant="secondary" onClick={() => setDuplicateCompanyModal({ open: false, sourceCompanyId: '', sourceCompanyName: '' })} disabled={duplicatingCompany}>Cancel</Button>
          <Button onClick={duplicateCompany} disabled={duplicatingCompany || !duplicateCompanyName.trim()}>{duplicatingCompany ? 'Creating copy...' : 'Create Copy'}</Button>
        </div>
      </Modal>

      <Modal open={appModal} onClose={() => setAppModal(false)} title="Create Application">
        <select className="select" value={selectedCompany} onChange={(event) => setSelectedCompany(event.target.value)}>
          <option value="">Select company</option>
          {data.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}
        </select>
        <Input placeholder="Application name" value={appName} onChange={(event) => setAppName(event.target.value)} />
        <Button onClick={createApp} disabled={!selectedCompany || !appName.trim()}>Create</Button>
      </Modal>

      <Modal open={fieldModal} onClose={() => setFieldModal(false)} title="Create Dynamic Field">
        <select className="select" value={selectedFieldCompany} onChange={(event) => {
          setSelectedFieldCompany(event.target.value);
          setSelectedFieldApp('');
          setFieldForm((current) => ({ ...current, tagId: '' }));
        }}>
          <option value="">Select company</option>
          {data.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}
        </select>
        <select className="select" value={selectedFieldApp} onChange={(event) => {
          const nextApplicationId = event.target.value;
          setSelectedFieldApp(nextApplicationId);
          setFieldForm((current) => ({ ...current, tagId: '' }));
        }} disabled={!selectedFieldCompany}>
          <option value="">Select application</option>
          {fieldCompanyApplications.map((app) => <option key={app.id} value={app.id}>{app.name}</option>)}
        </select>
        <Input placeholder="Field name" value={fieldForm.name} onChange={(event) => setFieldForm({ ...fieldForm, name: event.target.value })} />
        <select className="select" value={fieldForm.type} onChange={(event) => setFieldForm({ ...fieldForm, type: event.target.value })}>
          <option value="text">Text</option>
          <option value="number">Number</option>
          <option value="image">Image</option>
          <option value="pdf">PDF</option>
          <option value="link">Link</option>
        </select>
        {selectedFieldApp ? <>
          <select className="select" value={fieldForm.tagId} onChange={(event) => setFieldForm({ ...fieldForm, tagId: event.target.value })} disabled={availableTags.length === 0}>
            <option value="">Select tag (required)</option>
            <optgroup label="Company-level tags">
              {groupedAvailableTags.application.map((tag) => <option key={tag.id} value={tag.id}>{tag.labeledName}</option>)}
            </optgroup>
            <optgroup label="Company-wide global tags (All Applications in this company)">
              {groupedAvailableTags.company.map((tag) => <option key={tag.id} value={tag.id}>{tag.labeledName}</option>)}
            </optgroup>
            <optgroup label="System-wide global tags (All Applications in all companies)">
              {groupedAvailableTags.global.map((tag) => <option key={tag.id} value={tag.id}>{tag.labeledName}</option>)}
            </optgroup>
          </select>
          {availableTags.length === 0 ? <p className="subtitle">No tags available. Please create a tag first.</p> : null}
        </> : null}
        <Button onClick={createField} disabled={!selectedFieldApp || !fieldForm.name.trim() || !fieldForm.tagId}>Create</Button>
      </Modal>

      <Modal open={tagModal} onClose={() => setTagModal(false)} title="Create Tag">
        <select className="select" value={tagForm.scope} onChange={(event) => setTagForm((current) => ({ ...current, scope: event.target.value, companyId: '', applicationId: '' }))}>
          <option value="application">Specific Application</option>
          <option value="company">All Applications (within selected company)</option>
          <option value="global">All Applications in All Companies</option>
        </select>

        <select className="select" value={tagForm.companyId} disabled={tagForm.scope !== 'company'} onChange={(event) => setTagForm((current) => ({ ...current, companyId: event.target.value }))}>
          <option value="">Select company</option>
          {data.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}
        </select>

        <select className="select" value={tagForm.applicationId} disabled={tagForm.scope !== 'application'} onChange={(event) => setTagForm((current) => ({ ...current, applicationId: event.target.value }))}>
          <option value="">Select application</option>
          {data.map((company) => company.applications.map((app) => <option key={app.id} value={app.id}>{app.name} ({company.name})</option>))}
        </select>

        {tagForm.scope === 'global' ? <p className="error">This tag will be visible across the entire system.</p> : null}

        <Input placeholder="Tag name" value={tagForm.name} onChange={(event) => setTagForm((current) => ({ ...current, name: event.target.value }))} />
        <Input placeholder="Description (optional)" value={tagForm.description} onChange={(event) => setTagForm((current) => ({ ...current, description: event.target.value }))} />
        <select className="select" value={tagForm.presetKey || ''} onChange={(event) => setTagForm((current) => ({ ...current, presetKey: event.target.value }))}>
          <option value="">Use Preset Template (Optional)</option>
          {tagPresetOptions.map((preset) => <option key={preset.key} value={preset.key}>{preset.name}</option>)}
        </select>
        <Button onClick={() => createTag()} disabled={!tagForm.name.trim()}>Create Tag</Button>
      </Modal>


      <Modal open={globalTagConfirmOpen} onClose={() => setGlobalTagConfirmOpen(false)} title="Confirm Global Tag">
        <p className="subtitle">This action will make the tag available in every current and future application across all companies.</p>
        <p className="error">This tag will be visible across the entire system.</p>
        <div className="row">
          <Button variant="secondary" onClick={() => setGlobalTagConfirmOpen(false)}>Cancel</Button>
          <Button onClick={() => createTag(true)}>Confirm Global Tag</Button>
        </div>
      </Modal>

      <Modal open={userModal} onClose={() => setUserModal(false)} title="Create Read-only User">
        <Input placeholder="Username" value={userForm.username} onChange={(event) => setUserForm({ ...userForm, username: event.target.value })} />
        <Input type="password" placeholder="Password" value={userForm.password} onChange={(event) => setUserForm({ ...userForm, password: event.target.value })} />
        <Button onClick={createUser} disabled={!userForm.username || !userForm.password}>Create User</Button>
      </Modal>

      <Modal open={editing.open} onClose={() => !savingEdit && setEditing({ open: false, type: '', id: '', payload: {}, title: '' })} title={editing.title}>
        {editing.type === 'company' || editing.type === 'application' ? <Input value={editing.payload.name || ''} onChange={(event) => setEditing((current) => ({ ...current, payload: { ...current.payload, name: event.target.value } }))} /> : null}
        {editing.type === 'field' ? (
          <>
            <Input placeholder="Field name" value={editing.payload.name || ''} onChange={(event) => setEditing((current) => ({ ...current, payload: { ...current.payload, name: event.target.value } }))} />
            <select className="select" value={editing.payload.type || 'text'} onChange={(event) => setEditing((current) => ({ ...current, payload: { ...current.payload, type: event.target.value } }))}>
              <option value="text">Text</option>
              <option value="number">Number</option>
              <option value="image">Image</option>
              <option value="pdf">PDF</option>
              <option value="link">Link</option>
            </select>
            <select className="select" value={editing.payload.tagId || ''} onChange={(event) => setEditing((current) => ({ ...current, payload: { ...current.payload, tagId: event.target.value } }))}>
              <option value="">Select tag (required)</option>
              {(applications.find((app) => (app.fields || []).some((field) => field.id === editing.id))?.tags || []).map((tag) => <option key={tag.id} value={tag.id}>{tag.name}</option>)}
            </select>
          </>
        ) : null}
        {editing.type === 'tag' ? <>
          <Input placeholder="Tag name" value={editing.payload.name || ''} onChange={(event) => setEditing((current) => ({ ...current, payload: { ...current.payload, name: event.target.value } }))} />
          <Input placeholder="Description (optional)" value={editing.payload.description || ''} onChange={(event) => setEditing((current) => ({ ...current, payload: { ...current.payload, description: event.target.value } }))} />
          <select className="select" value={editing.payload.scope || 'application'} onChange={(event) => setEditing((current) => ({ ...current, payload: { ...current.payload, scope: event.target.value } }))}>
            <option value="application">🧩 Application</option>
            <option value="company">🏢 Company</option>
            <option value="global">🌍 Global</option>
          </select>
          {editing.payload.scope === 'global' ? <p className="error">This tag will be visible across the entire system.</p> : null}
        </> : null}
        {editing.type === 'user' ? <>
          <Input placeholder="Username" value={editing.payload.username || ''} onChange={(event) => setEditing((current) => ({ ...current, payload: { ...current.payload, username: event.target.value } }))} />
          <Input placeholder="New password (optional)" type="password" value={editing.payload.password || ''} onChange={(event) => setEditing((current) => ({ ...current, payload: { ...current.payload, password: event.target.value } }))} />
        </> : null}
        {editing.type === 'data' ? fields.filter((field) => records.find((record) => record.id === editing.id)?.applicationId === field.applicationId).map((field) => {
          const currentValue = editing.payload.values?.[field.id];
          if (field.type === 'text' || field.type === 'link' || field.type === 'number') {
            const inputType = field.type === 'link' ? 'url' : field.type === 'number' ? 'number' : 'text';
            const placeholder = field.type === 'link' ? `${field.name} (https://...)` : field.name;
            return <Input key={field.id} type={inputType} placeholder={placeholder} value={currentValue || ''} onChange={(event) => setEditing((current) => ({ ...current, payload: { ...current.payload, values: { ...current.payload.values, [field.id]: event.target.value } } }))} />;
          }
          return (
            <div key={field.id} className="stack">
              <strong>{field.name} metadata</strong>
              <Input placeholder="File display name" value={currentValue?.originalname || ''} onChange={(event) => setEditing((current) => ({ ...current, payload: { ...current.payload, values: { ...current.payload.values, [field.id]: { ...current.payload.values[field.id], originalname: event.target.value } } } }))} />
              <Input placeholder="Description" value={currentValue?.description || ''} onChange={(event) => setEditing((current) => ({ ...current, payload: { ...current.payload, values: { ...current.payload.values, [field.id]: { ...current.payload.values[field.id], description: event.target.value } } } }))} />
            </div>
          );
        }) : null}
        <div className="row">
          <Button variant="secondary" onClick={() => setEditing({ open: false, type: '', id: '', payload: {}, title: '' })} disabled={savingEdit}>Cancel</Button>
          <Button onClick={executeEdit} disabled={savingEdit}>{savingEdit ? 'Saving...' : 'Save changes'}</Button>
        </div>
      </Modal>

      <Modal open={confirmModal.open} onClose={() => !deleting && setConfirmModal({ open: false, type: '', id: '', label: '' })} title="Confirm Deletion">
        <p className="subtitle">{confirmModal.type === 'user' ? 'Are you sure you want to delete this user? This action cannot be undone.' : 'This action is destructive and cannot be undone.'}</p>
        <p><strong>Target:</strong> {confirmModal.label}</p>
        <div className="row">
          <Button variant="secondary" onClick={() => setConfirmModal({ open: false, type: '', id: '', label: '' })} disabled={deleting}>Cancel</Button>
          <Button onClick={executeDelete} disabled={deleting}>{deleting ? 'Deleting...' : 'Delete now'}</Button>
        </div>
      </Modal>

      <Modal open={logoutConfirmOpen} onClose={() => !isLoggingOut && setLogoutConfirmOpen(false)} title="Confirm Logout">
        <p className="subtitle">Are you sure you want to logout from the admin dashboard?</p>
        <div className="row">
          <Button variant="secondary" onClick={() => setLogoutConfirmOpen(false)} disabled={isLoggingOut}>Cancel</Button>
          <Button onClick={onLogout} disabled={isLoggingOut}>{isLoggingOut ? 'Logging out...' : 'Logout'}</Button>
        </div>
      </Modal>
    </main>
  );
}
