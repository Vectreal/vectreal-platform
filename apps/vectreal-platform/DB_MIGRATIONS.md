# Vectreal Platform DB Migrations

This app uses a **Supabase-first migration flow**:

- **Drizzle** is used only for schema definition and SQL migration generation.
- **Supabase CLI** is used to apply migrations to local, staging, and production databases.

## Principles

- Do not run `drizzle-kit push` against staging/production.
- Do not run `drizzle-kit migrate` for deployment.
- Keep generated SQL in `apps/vectreal-platform/supabase/migrations`.

## Local development

1. Update schema in `app/db/schema`.
1. Generate migration SQL:

```bash
pnpm nx run vectreal-platform:drizzle-generate
```

1. Apply locally (rebuild local db from migrations):

```bash
pnpm nx run vectreal-platform:supabase-db-reset
```

Or apply pending migrations without reset:

```bash
pnpm nx run vectreal-platform:supabase-db-push-local
```

Run SQL lint checks before pushing to remote:

```bash
pnpm nx run vectreal-platform:supabase-db-lint
```

## Staging migrations

Set these environment variables in the shell or CI:

- `SUPABASE_PROJECT_REF_STAGING`
- `SUPABASE_DB_PASSWORD_STAGING`

Then run:

```bash
pnpm nx run vectreal-platform:supabase-db-push-staging
```

## Production migrations

Set these environment variables in the shell or CI:

- `SUPABASE_PROJECT_REF_PROD`
- `SUPABASE_DB_PASSWORD_PROD`

Then run:

```bash
pnpm nx run vectreal-platform:supabase-db-push-prod
```

## Remote reset / rebaseline

Use these only when you intentionally want to reset a remote database and re-apply the tracked baseline migrations from this repo.

Staging:

```bash
pnpm nx run vectreal-platform:supabase-db-reset-staging
```

Production:

```bash
pnpm nx run vectreal-platform:supabase-db-reset-prod
```

## Remote schema pull (drift sync)

Use pull only when remote schema was changed outside your tracked migrations and you need to capture that state as a migration.

Staging:

```bash
pnpm nx run vectreal-platform:supabase-db-pull-staging
```

Production:

```bash
pnpm nx run vectreal-platform:supabase-db-pull-prod
```

If pull still fails due Supabase internal service migrations (for example storage migration errors), use schema dump fallback:

```bash
pnpm nx run vectreal-platform:supabase-db-dump-staging-public
```

## Suggested release sequence

1. Generate SQL from Drizzle schema.
2. Review SQL migration in PR.
3. Apply to staging and validate.
4. Apply to production.

## Security hardening

- Keep baseline hardening as versioned migrations in `supabase/migrations`.
- Current baseline starts with `supabase/migrations/0000_security_hardening.sql`.
- Core schema baseline is `supabase/migrations/0001_complete_hex.sql`.
- Keep `supabase/sql/*.sql` for reusable snippets only, not deployment.
