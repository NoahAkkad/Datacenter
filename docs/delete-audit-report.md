# Delete Operations Architecture & Logic Audit

## Scope

- Delete Tag
- Delete Field
- Delete Application
- Delete Company
- Delete User
- Delete All / bulk deletion behavior

## Executive conclusion

**System is not 100% deletion-safe.**

The implementation has reasonable in-memory cascade logic for a file-backed JSON store, but it lacks database-enforced relational guarantees, transactionality, scope-aware authorization, and robust concurrency controls.

## Current implementation overview

- Storage is JSON-file based (`data/db.json`) with synchronous read/write helpers (`readDb`, `writeDb`, `withDb`).
- Deletion logic for `record`, `field`, `application`, `company`, and `user` is centralized in `lib/deletionService.js`.
- Deletion HTTP endpoints are in `server.js` and require:
  - authenticated user (`authRequired`)
  - admin role (`requireRole('admin')`)
  - explicit request body confirmation (`requireDeleteConfirmation` with `{ "confirm": true }`).
- Tag deletion is implemented directly in `server.js` rather than in `deletionService`.

## Findings by requested validation area

### 1) Referential Integrity Validation

#### Tags

- ✅ Tag deletion is blocked when fields still reference the tag (`linkedFields.length > 0` returns `409`).
- ⚠️ No cascade option exists for tag deletion (despite requirement mentioning optional cascade behavior).
- ⚠️ Because there is no enforced FK layer, orphan references can still be introduced through malformed writes or future code changes.

**Risk: Medium**

#### Fields

- ✅ Field deletion removes matching field values from records by deleting `record.values[field.id]`.
- ✅ File values tied to the deleted field are unlinked from `public/uploads`.
- ✅ Field record is removed from `db.fields`.
- ⚠️ No strict relational constraint exists for `tagId` / `tag_id` consistency.
- ⚠️ UI references are indirectly removed after refresh, but there is no formal referential view-layer contract.

**Risk: Medium**

#### Applications

- ✅ Deletion cascades in code to records, fields, and application-scoped tags.
- ✅ Company-level and system-global tags are preserved by filtering only tags with `tag.applicationId === applicationId`.
- ⚠️ This is application-level cascade only; no transaction or FK guarantees.

**Risk: Medium**

#### Company

- ✅ Deletion cascades through all company applications via `deleteApplicationById`, thereby removing records/fields/app tags under those applications.
- ⚠️ Company-scoped tags (`scope: company`) are **not** deleted in `deleteCompanyById` because only application-scoped tags are removed by application deletion.
- ⚠️ Users are **not company-bound** in the data model, so company-user cascade behavior is undefined and unenforced.

**Risk: Critical**

#### Users

- ✅ Admin users cannot be deleted (`403`).
- ✅ Self-delete of active account is blocked.
- ⚠️ There is no company assignment model, role mapping table, token store, permission store, or session store to clean up.
- ⚠️ JWTs are stateless; deleting a user does not explicitly revoke already-issued tokens.

**Risk: Medium**

### 2) Database-Level Enforcement

- ❌ No relational database is used; therefore no true FKs or ON DELETE semantics exist.
- ❌ No explicit CASCADE / RESTRICT / SET NULL at persistence layer.
- ⚠️ Behavior depends entirely on route/service logic.
- ❌ No soft-delete model (`deletedAt` flags, restore flow, filtered queries) is present; behavior is hard-delete.

**Risk: Critical**

### 3) Bulk Delete ("Delete All")

- ❌ No dedicated bulk-delete endpoint exists.
- ❌ No transaction wrapper exists for multi-entity destructive operations.
- ❌ No all-or-nothing rollback mechanism exists if a multi-step deletion fails midway.
- ⚠️ Existing company/application cascades are in-memory sequential operations and can leave partial state if process crashes before `writeDb`.

**Risk: Critical**

### 4) Security Review

- ✅ Delete endpoints require admin role.
- ⚠️ No tenant/company scoping is enforced in delete handlers; admin can delete any ID globally.
- ❌ No explicit CSRF token validation on delete endpoints (reliance is primarily on `sameSite: 'strict'` cookie setting and JSON fetch patterns).
- ⚠️ Ownership validation is ID-based only and role-gated; no server-side ownership checks by company.
- ⚠️ Global destructive actions are not separated by stronger privilege than `admin` (no super-admin role).

**Risk: High**

### 5) UI Confirmation & Safety

- ✅ UI requires confirmation modal before delete actions, and API requires `{ confirm: true }`.
- ⚠️ No second-step/typed confirmation for high-risk actions (company-wide deletion).
- ⚠️ Confirmation messaging is generic for most entity types and does not enumerate cascade impact.
- ✅ No silent background delete discovered; delete is explicit via user-triggered modal.

**Risk: Medium**

### 6) Performance & Edge Cases

#### Delete company with 10,000+ records

- A synthetic in-process service test showed completion in tens of milliseconds for 10k records / 1k fields on this environment.
- ⚠️ Complexity is O(n)-style scans/maps/filters across arrays and can grow significantly with large datasets.
- ⚠️ Full-file rewrite for every mutation does not scale and has race/lost-update risk.

#### Delete tag linked to 1,000+ fields

- Deletion correctly blocks with conflict if fields remain linked.
- ⚠️ No optional cascade path exists; operationally this can create admin friction and manual cleanup risk.

#### Simultaneous delete requests

- ❌ No locking/transaction/concurrency control around `readDb()` + mutate + `writeDb()` in route handlers.
- ❌ Lost updates are possible under concurrent requests.

#### Deleting while another user edits

- ❌ No optimistic concurrency (`version`, `etag`, timestamp compare) and no row-level lock semantics.
- ⚠️ Last-write-wins behavior may overwrite changes or reintroduce stale state.

**Risk: High**

## Weakness list with risk and fix recommendations

1. **No persistence-layer referential integrity (Critical)**
   - **Fix:** Move to relational DB (PostgreSQL/MySQL/SQLite with FK support) and define explicit FK + ON DELETE behavior.

2. **No transactional guarantees for cascades or bulk destructive flows (Critical)**
   - **Fix:** Wrap multi-entity deletions in DB transactions with rollback on failure.

3. **Company deletion leaves company-scoped tags orphaned (Critical)**
   - **Fix:** In company delete flow, explicitly remove tags where `scope=company` and `companyId=<target>`.

4. **No bulk-delete endpoint with safety guardrails (Critical)**
   - **Fix:** Add explicit `DELETE /api/system/purge` (or equivalent) behind super-admin checks, typed confirmation, allowlist protection for system-global assets/admin account, and transaction rollback.

5. **Insufficient scope-aware authorization (High)**
   - **Fix:** Introduce tenant scoping in auth payload and enforce `{ actor.companyId === target.companyId }` where applicable; separate super-admin for cross-tenant/global deletes.

6. **No robust CSRF strategy for destructive routes (High)**
   - **Fix:** Add CSRF token middleware (double-submit cookie or synchronizer token) for POST/PUT/PATCH/DELETE.

7. **Stateless JWT revocation gap on user deletion (Medium)**
   - **Fix:** Add token versioning or denylist (short TTL + refresh-token rotation) and invalidate on delete/password reset.

8. **No optimistic concurrency control (High)**
   - **Fix:** Add entity version columns and conditional updates/deletes (`WHERE version = ?`) to prevent stale writes.

9. **No high-risk secondary confirmation UX (Medium)**
   - **Fix:** Require typed confirmation for company/all deletes and show exact cascade counts before final confirmation.

10. **Inconsistent data shape (`tagId` vs `tag_id`, scope metadata duplicates) (Low/Medium)**
    - **Fix:** Normalize schema and enforce single canonical field names with migration scripts.

## Recommended target relational schema behaviors

- `companies(id)`
- `applications(company_id FK -> companies.id ON DELETE CASCADE)`
- `tags(application_id FK -> applications.id ON DELETE CASCADE, nullable for company/global scopes)`
- `tags(company_id FK -> companies.id ON DELETE CASCADE for company scope)`
- `fields(tag_id FK -> tags.id ON DELETE RESTRICT or CASCADE by policy)`
- `records(application_id FK -> applications.id ON DELETE CASCADE)`
- `record_values(record_id FK -> records.id ON DELETE CASCADE, field_id FK -> fields.id ON DELETE CASCADE)`
- `users(company_id FK -> companies.id ON DELETE CASCADE or RESTRICT per policy)`
- `sessions(user_id FK -> users.id ON DELETE CASCADE)`
- `role_mappings(user_id FK -> users.id ON DELETE CASCADE)`

## Final safety verdict

**The current system is not 100% deletion-safe.**

Main blockers are lack of persistence-level constraints, missing transactionality, incomplete company cascade (company-scoped tags), weak multi-tenant authorization guarantees, and lack of concurrency controls.
