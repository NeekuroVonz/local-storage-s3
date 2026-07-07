# Development Guide

## Getting Started

```bash
./scripts/dev-setup.sh
bun dev
```

This starts both frontend (port 3000) and backend (port 4000) in watch mode.

## Individual Services

```bash
bun run dev:backend    # NestJS with hot reload
bun run dev:frontend   # Next.js with hot reload
```

## Database

```bash
bun run db:generate    # Generate Prisma client
bun run db:migrate     # Run migrations (dev)
bun run db:seed        # Seed roles, permissions, admin user
```

Open Prisma Studio:

```bash
cd backend && npx prisma studio
```

## Project Conventions

### Backend
- Feature modules in `backend/src/modules/`
- Shared infrastructure in `backend/src/infrastructure/`
- Common guards, pipes, filters in `backend/src/common/`
- Zod schemas shared via `@storage/shared` package
- All endpoints versioned under `/api/v1`

### Frontend
- App Router pages in `frontend/src/app/`
- UI components in `frontend/src/components/ui/`
- API calls via `frontend/src/lib/api-client.ts`
- State management via Zustand in `frontend/src/stores/`

### Shared Package
- Types, Zod schemas, permission constants
- Build before backend/frontend: `bun run --filter @storage/shared build`

## Adding a New Feature

1. Add Zod schema and types to `packages/shared/`
2. Create NestJS module (service + controller + module)
3. Register module in `app.module.ts`
4. Create frontend page and API integration
5. Add documentation

## Testing

```bash
bun test                    # All packages
bun run --filter @storage/backend test
```

## Code Quality

- TypeScript strict mode enabled
- No `any` types
- Exhaustive switch handling for unions
- Imports at top of file only
