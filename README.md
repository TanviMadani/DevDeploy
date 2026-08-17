# 🚀 DevDeploy — Self-Hosted Developer Platform as a Service (PaaS)

[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18.3-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Express](https://img.shields.io/badge/Express-5.2-000000?logo=express&logoColor=white)](https://expressjs.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16.0-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Prisma](https://img.shields.io/badge/Prisma-7.9-2D3748?logo=prisma&logoColor=white)](https://www.prisma.io/)
[![Redis](https://img.shields.io/badge/Redis-BullMQ-DC382D?logo=redis&logoColor=white)](https://redis.io/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-v4-38B2AC?logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Vite](https://img.shields.io/badge/Vite-8.2-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)

> **DevDeploy** is a full-stack, self-hosted Developer Platform as a Service (PaaS) — inspired by modern platforms like **Vercel**, **Render**, and **Railway**. It automates repository cloning, intelligent project inspection, dependency installation, dynamic build execution, isolated runtime lifecycle management, real-time log streaming via SSE, and transparent reverse proxy routing.

---

## 📸 Platform Highlights & Architecture

```mermaid
flowchart TD
    subgraph Client ["Client Layer"]
        Developer(["👤 Developer / Browser"])
        GitHubHook(["🐙 GitHub Webhooks (push)"])
    end

    subgraph Gateway ["Edge & API Layer"]
        Tunnel["🚇 Cloudflare Tunnel (HTTPS)"]
        Express["⚡ Express 5 API Server (:5000)"]
        LiveProxy["🌐 Clean URL Reverse Proxy (/live/:projectName)"]
        AuthMiddleware["🔐 JWT & Token Auth Middleware"]
    end

    subgraph Data ["Data & Messaging Layer"]
        DB[("🐘 PostgreSQL + Prisma ORM")]
        RedisQueue[("🔴 Redis + BullMQ Queue ('deployment')")]
    end

    subgraph Execution ["Worker & Execution Engine"]
        Worker["⚙️ Deployment Worker (BullMQ Worker)"]
        GitService["📦 Git Cloning & Commit Resolver"]
        BuildService["🔨 Build Engine (npm ci, build, monorepo detector)"]
        RuntimeService["🚀 Process Manager (dynamic port :4000+, serve fallback)"]
        HealthChecker["🩺 TCP / HTTP Health Checker"]
        SSEStream["📡 Server-Sent Events (SSE) Log Broadcaster"]
    end

    Developer -->|Dashboard & REST API| Express
    Developer -->|Open Live App| LiveProxy
    GitHubHook -->|Push Webhook| Tunnel --> Express
    Express --> AuthMiddleware --> DB
    Express -->|Queue Job| RedisQueue
    RedisQueue -->|Pop Job| Worker
    Worker --> GitService --> BuildService --> RuntimeService
    RuntimeService --> HealthChecker
    Worker -->|Broadcast Live Logs| SSEStream -->|Stream to UI| Developer
    LiveProxy -.->|Transparent Proxy| RuntimeService
```

---

## ✨ Key Features

### 1. 🔍 Zero-Config Build & Monorepo Intelligence
* **Subdirectory Auto-Detection**: Automatically inspects multi-directory projects and monorepos (e.g., `cric-frontend/`, `client/`, `web/`, `frontend/`) and builds the designated app without manual path configuration.
* **Static SPA Fast Serving**: Automatically detects single-page applications (Vite, React, Vue, HTML/CSS) and serves production bundles with optimized static servers.
* **Framework Agnostic**: Supports standard Node.js scripts, custom build commands (`npm run build`, `tsc`, `vite build`), and custom start commands.

### 2. ⚡ Real-Time Log Streaming (Server-Sent Events)
* **Zero Polling Delay**: Low-latency terminal logs streamed directly to the browser via Server-Sent Events (`GET /api/deployments/:id/logs/stream`).
* **Interactive Terminal UI**: High-contrast, dark-mode terminal modal with live pulse indicators, colored log severity highlights, auto-scrolling, and one-click copy.

### 3. 🌐 Clean URL Built-in Reverse Proxy
* **Friendly URLs**: Access any active deployment using human-readable URLs instead of memorizing dynamic port numbers:
  ```
  http://localhost:5000/live/:projectName/
  ```
  *(e.g., `http://localhost:5000/live/portfolio/` or `http://localhost:5000/live/impactXI/`)*
* **Transparent Proxying**: Automatically locates the active deployment's internal runtime port (e.g. `4000`), proxying HTTP streaming requests, assets, and headers with graceful 502/503 error states.

### 4. 🔑 Project Environment Variables
* **Encrypted Key-Value Storage**: Manage project-specific environment secrets directly in the dashboard UI.
* **Build & Runtime Injection**: Variables (e.g., `VITE_API_URL`, `DATABASE_URL`) are injected into `npm ci`, build execution, and active application child processes.
* **Security First**: UI values are masked by default (`••••••••`) with reveal toggles and clipboard helpers.

### 5. ⏪ One-Click Rollbacks
* **Instant Version Restores**: Roll back to any historical deployment in one click (`POST /api/deployments/:id/rollback`).
* DevDeploy checks out the exact git commit hash and rebuilds the version in an isolated environment.

### 6. 🐙 Automated GitHub Webhook Auto-Deployments
* **Continuous Delivery**: Push code to GitHub (`main` or any branch), and DevDeploy automatically triggers an end-to-end build and hot-swaps the running application.
* **Security**: Verified using HMAC SHA-256 cryptographic signature matching (`X-Hub-Signature-256`).

---

## 🛠️ Tech Stack

| Layer | Technologies |
|---|---|
| **Frontend** | React 18, TypeScript, Tailwind CSS v4, Lucide-style SVGs, Vite |
| **Backend API** | Node.js, Express 5, TypeScript, JWT Authentication, CORS |
| **Database & ORM** | PostgreSQL 16+, Prisma ORM 7 (`prisma db push`, `@prisma/client`) |
| **Job Queue & Cache** | Redis 7+, BullMQ (distributed asynchronous queue) |
| **Execution Engine** | Node.js `child_process` (spawn/execFile), dynamic port allocator, HTTP reverse proxy |
| **Tunneling & Ingress**| Cloudflare Tunnel (`cloudflared`) |

---

## 📁 Repository Structure

```
DevDeploy/
├── backend/                  # Express 5 REST API & Deployment Engine
│   ├── prisma/
│   │   └── schema.prisma     # PostgreSQL models (User, Project, Deployment, EnvVar, Log)
│   ├── src/
│   │   ├── config/           # Database & Redis client configurations
│   │   ├── controllers/      # Auth, Project, Deployment, Env, Webhook, GitHub
│   │   ├── middleware/       # JWT Auth, Live Proxy handler
│   │   ├── routes/           # Express route definitions
│   │   ├── services/         # Git, Build, Runtime, Port, Env, GitHub services
│   │   ├── utils/            # SSE Log Broadcaster (logEmitter)
│   │   ├── workers/          # BullMQ deployment worker process
│   │   └── server.ts         # Express application root & reverse proxy mount
│   └── package.json
│
├── frontend/                 # React 18 + TypeScript Dashboard
│   ├── src/
│   │   ├── api/              # Strongly-typed API client SDK (REST + SSE)
│   │   ├── components/       # UI design system, terminal viewer, modals, env manager
│   │   ├── views/            # Dashboard, Projects, Details, Deployments, Settings, Auth
│   │   ├── types/            # TypeScript data models and interfaces
│   │   └── App.tsx           # Application root & tab routing
│   └── package.json
│
├── docs/                     # Architecture & design documentation
└── README.md
```

---

## 🚦 Quickstart Guide

### Prerequisites
1. **Node.js**: v18.0.0 or later (v20+ recommended)
2. **PostgreSQL**: Running locally or on cloud (e.g., Supabase, Neon)
3. **Redis**: Running on `localhost:6379` (or cloud Redis)
4. **Git**: Installed and available in PATH

---

### Step 1: Clone and Install Dependencies

```bash
# Clone the repository
git clone https://github.com/TanviMadani/DevDeploy.git
cd DevDeploy

# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

---

### Step 2: Configure Backend Environment

Create a `.env` file in the `backend/` directory:

```env
PORT=5000
DATABASE_URL="postgresql://postgres:yourpassword@localhost:5432/devdeploy?schema=public"
REDIS_URL="redis://localhost:6379"
JWT_SECRET="your-super-secret-jwt-key"
GITHUB_TOKEN="ghp_yourPersonalAccessTokenHere"
GITHUB_WEBHOOK_SECRET="your-github-webhook-secret"
```

Push database schema to PostgreSQL:
```bash
cd backend
npx prisma db push
npx prisma generate
```

---

### Step 3: Run the Application Services

Open 3 terminal tabs:

**Terminal 1 — API Server:**
```bash
cd backend
npm run dev
# Running on http://localhost:5000
```

**Terminal 2 — Deployment Worker:**
```bash
cd backend
npm run worker
# BullMQ worker listening on 'deployment' queue
```

**Terminal 3 — Frontend Dashboard:**
```bash
cd frontend
npm run dev
# UI accessible at http://localhost:5173
```

---

## 📡 API Reference Overview

| Method | Route | Description | Auth |
|---|---|---|---|
| `POST` | `/api/auth/register` | Register a new developer account | Public |
| `POST` | `/api/auth/login` | Log in and receive JWT token | Public |
| `GET` | `/api/projects` | List all user projects | Bearer JWT |
| `POST` | `/api/projects` | Create a new deployment project | Bearer JWT |
| `GET` | `/api/projects/:id/env` | List environment variables for project | Bearer JWT |
| `POST` | `/api/projects/:id/env` | Add or update environment variable | Bearer JWT |
| `DELETE` | `/api/projects/:id/env/:envId` | Delete environment variable | Bearer JWT |
| `POST` | `/api/projects/:id/deploy` | Trigger project deployment | Bearer JWT |
| `GET` | `/api/deployments/:id/logs` | Fetch static historical logs | Bearer JWT |
| `GET` | `/api/deployments/:id/logs/stream` | Stream live deployment logs (SSE) | Bearer / Query |
| `POST` | `/api/deployments/:id/rollback` | Rollback to specific deployment commit | Bearer JWT |
| `POST` | `/api/webhooks/github` | GitHub push event webhook | HMAC SHA-256 |
| `ALL` | `/live/:projectName/*` | Clean URL reverse proxy to live container | Public |

---

## 🛡️ License

Distributed under the **MIT License**. See `LICENSE` for more information.

---

<p align="center">
  Crafted with ❤️ by <strong>Tanvi Madani</strong> • Powered by DevDeploy
</p>
