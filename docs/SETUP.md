# Development Setup Guide

## Overview
Exact steps and prerequisites for running the SilidSmart B2B2C frontend and SQLite backend locally.

## Prerequisites
- **Node.js `v22+`** (required for built-in `node:sqlite` `DatabaseSync` and `node --test`)
- **npm** (bundled with Node.js)

## Getting Started

1. **Install frontend dependencies**:
   ```bash
   cd frontend
   npm install
   ```
   *(The backend uses Node.js built-in modules only and requires no external npm install.)*

2. **Start the SQLite Backend API (`http://localhost:4000`)**:
   ```bash
   cd backend
   npm start
   # Or for auto-reload during development:
   npm run dev
   ```
   On first boot, `backend/src/service.mjs` initializes `backend/data/silidsmart.sqlite` using the versioned migrations in `backend/migrations/` and seeds initial BMC sample records if the `owners` table is empty.

3. **Start the Frontend Vite Server (`http://localhost:5173`)**:
   ```bash
   cd frontend
   npm run dev
   ```
   Vite's development server ([frontend/vite.config.ts](../frontend/vite.config.ts)) proxies `/api/*` requests directly to `http://localhost:4000`.

## Resetting Demo Data & Troubleshooting
- **Reset to canonical seed state**: Sign in to the example administrator account and choose **Reset example data** from the account menu. The reset API requires that administrator session.
- **Backend Unavailable Panel**: If the frontend displays *"Backend Service Unavailable"*, verify port `4000` is running (`cd backend && npm start`) and click **Retry Connection**.
- **Environment Overrides**:
  - `PORT`: Backend listen port (defaults to `4000`).
  - `CORS_ORIGIN`: Allowed CORS origin header (defaults to `*`).
