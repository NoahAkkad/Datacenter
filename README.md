# Data Center Management System

A simple and secure web-based Data Center Management System built with **Next.js + Express.js**.

## Features

- Role-based authentication (Admin and Normal User).
- Separate Admin and User login workflows.
- Admin can:
  - Create companies and applications.
  - Create dynamic fields (`text`, `pdf`, `image`).
  - Insert records using dynamic fields.
  - Upload PDF contracts and images securely.
  - Create read-only users.
- Normal users can:
  - Search and filter by company and application name.
  - View records and open uploaded files.

## Architecture

- **Frontend**: Next.js App Router pages in `app/`
- **Backend API**: Express routes in `server.js`
- **Storage**:
  - JSON file database: `data/db.json`
  - Uploaded assets: `public/uploads/`
- **Auth**:
  - Password hashing with PBKDF2
  - JWT in HTTP-only cookie
  - RBAC middleware (`admin`, `user`)

## Data Model (simple structured design)

- `users`: id, username, passwordHash, role
- `companies`: id, name
- `applications`: id, companyId, name
- `fields`: id, applicationId, name, type
- `records`: id, applicationId, values(dynamic by field id)

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

Default Admin account:

- username: `admin`
- password: `admin123`

> Change admin credentials and `JWT_SECRET` in production.
