# Folder Structure

```
local-storage-s3/
├── frontend/                    # Next.js 15 frontend application
│   ├── src/
│   │   ├── app/                 # App Router pages
│   │   │   ├── login/           # Authentication
│   │   │   ├── dashboard/       # Dashboard overview
│   │   │   ├── buckets/         # Bucket list & explorer
│   │   │   └── search/          # Global search
│   │   ├── components/
│   │   │   ├── ui/              # shadcn/ui components
│   │   │   └── layout/          # App shell, sidebar, topbar
│   │   ├── lib/                 # API client, utilities
│   │   └── stores/              # Zustand state management
│   ├── next.config.ts
│   ├── tailwind.config.ts
│   └── package.json
│
├── backend/                     # NestJS backend API
│   ├── src/
│   │   ├── main.ts              # Application entry point
│   │   ├── app.module.ts        # Root module
│   │   ├── config/              # Configuration & env validation
│   │   ├── common/              # Guards, filters, pipes, decorators
│   │   ├── infrastructure/      # Database, Redis, S3, Queue
│   │   └── modules/             # Feature modules
│   │       ├── auth/
│   │       ├── users/
│   │       ├── roles/
│   │       ├── buckets/
│   │       ├── objects/
│   │       ├── upload/
│   │       ├── download/
│   │       ├── search/
│   │       ├── share/
│   │       ├── activity/
│   │       ├── dashboard/
│   │       ├── analytics/
│   │       ├── notifications/
│   │       ├── admin/
│   │       ├── health/
│   │       └── settings/
│   ├── prisma/
│   │   ├── schema.prisma        # Database schema
│   │   └── seed.ts              # Seed data
│   └── package.json
│
├── packages/
│   └── shared/                  # Shared types & validation
│       └── src/
│           ├── constants/       # Roles, permissions
│           ├── schemas/         # Zod validation schemas
│           └── types/           # TypeScript interfaces
│
├── docker/
│   ├── backend/Dockerfile
│   ├── frontend/Dockerfile
│   ├── docker-compose.yml       # Production stack
│   └── docker-compose.dev.yml   # Dev infrastructure only
│
├── docs/                        # Documentation
├── scripts/                     # Setup & deployment scripts
├── infra/                       # Infrastructure configs
├── .github/workflows/           # CI/CD
├── package.json                 # Monorepo root (Bun workspaces)
├── bun.lock
└── .env.example
```
