# Data Center Management System (Serverless-Ready)

This project now uses **Next.js API routes** for backend logic so it works in serverless platforms like **Vercel, Netlify, and Render free tier**.

## Backend Refactor Summary

- Express routes were migrated into Next.js API handlers in `pages/api/**`.
- File upload endpoint is implemented as a serverless route handler at `app/api/applications/[applicationId]/records/route.js` (uses `request.formData()` in a serverless-safe way).
- Frontend fetch calls use relative URLs like `/api/companies` (no hardcoded hosts).
- API responses are consistent JSON objects:

```json
{ "success": true, "data": { "...": "..." } }
```

## Deployment-ready folder layout

```txt
/pages
  /api
    /auth/login.js
    /auth/logout.js
    /auth/me.js
    /companies.js
    /applications.js
    /users.js
/components
  /Dashboard.js
  /ApplicationList.js
/utils (project uses /lib)
  /db.js
  /auth.js
```

## Environment Variables

Create `.env.local` for local development:

```bash
JWT_SECRET=replace-with-a-long-random-secret
DEFAULT_ADMIN_PASSWORD=change-me

# Cloud upload adapter
CLOUD_UPLOAD_ENDPOINT=https://your-upload-service.example.com/upload
CLOUD_DELETE_ENDPOINT=https://your-upload-service.example.com/delete
CLOUD_UPLOAD_TOKEN=secure-upload-service-token

# Optional external API proxy
EXTERNAL_API_URL=https://api.example.com/data
ALLOWED_ORIGIN=https://your-frontend-domain.com
```

> Do not hardcode credentials. Access them via `process.env` only.

### Setting env vars on hosting

- **Vercel**: Project → Settings → Environment Variables.
- **Netlify**: Site settings → Build & deploy → Environment.
- **Render**: Service → Environment tab.

After setting variables, redeploy the project.

## Cloud upload behavior

Serverless functions cannot persist local files in production. Uploads are sent to a cloud endpoint using `CLOUD_UPLOAD_ENDPOINT` + `CLOUD_UPLOAD_TOKEN`.

- In development only (non-production), uploads fall back to `public/uploads` for convenience.
- In production, upload config is required.

## Role-based security

- `auth` cookie contains JWT.
- API routes validate the token and enforce role checks (`admin`/`user`) before returning data.
- Sensitive endpoints (e.g., company/user management) are admin-only.

## CORS / external API example

`/api/external-proxy`:

- handles `OPTIONS`
- sets `Access-Control-Allow-Origin`
- fetches external API server-side
- returns normalized JSON

## Example frontend fetch usage (production-safe)

```js
const response = await fetch('/api/companies');
const payload = await response.json();
if (payload.success) {
  console.log(payload.data);
}
```

```js
await fetch('/api/companies', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: 'New Company' })
});
```

## Local run

```bash
npm install
npm run dev
```

Open: `http://localhost:3000`

Default admin user:

- username: `admin`
- password: `admin123` (or `DEFAULT_ADMIN_PASSWORD`)

## Production validation checklist

After deployment:

1. Open `/api/auth/me` (with session cookie) and verify JSON shape.
2. Test key endpoints in browser/Postman:
   - `/api/companies`
   - `/api/applications`
   - `/api/users`
3. Confirm frontend pages fetch data successfully from `/api/*` routes.
4. Upload a file and verify returned file URL is from cloud storage service.
5. Check hosting logs for `console.error` entries if troubleshooting.
