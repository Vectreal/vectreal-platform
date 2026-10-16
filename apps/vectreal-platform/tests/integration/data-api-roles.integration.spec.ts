/**
 * The Data API roles can do nothing in `public`.
 *
 * `anon` and `authenticated` are what PostgREST and pg_graphql act as, and any
 * Supabase-issued JWT, an OAuth token handed to a third-party client included,
 * is honored there. The app never uses either surface, so the roles hold
 * nothing, and RLS is not what stands between such a token and the tables.
 *
 * Checked as effective privileges, so a grant inherited from PUBLIC counts.
 * The second case creates objects the way a later migration would, because
 * the default privileges are what keep a new table closed.
 *
 * Opt-in:
 *   pnpm nx run vectreal-platform:supabase-start
 *   pnpm nx run vectreal-platform:test-integration
 */

import { sql } from 'drizzle-orm'
import { beforeAll, describe, expect, it } from 'vitest'

type Db = ReturnType<typeof import('../../app/db/client').getDbClient>
type Executor = Pick<Db, 'execute'>

// A type alias rather than an interface: `execute<T>` requires a Record.
type HeldPrivilege = {
	role: string
	object: string
	privilege: string
}

const API_ROLES = sql`unnest(array['anon', 'authenticated']) as r(role)`

async function heldPrivileges(db: Executor): Promise<HeldPrivilege[]> {
	const rows = await db.execute<HeldPrivilege>(sql`
		select r.role, c.relname as object, p.privilege
		from pg_class c
		join pg_namespace n on n.oid = c.relnamespace
		cross join ${API_ROLES}
		cross join unnest(array[
			'SELECT', 'INSERT', 'UPDATE', 'DELETE',
			'TRUNCATE', 'REFERENCES', 'TRIGGER', 'MAINTAIN'
		]) as p(privilege)
		where n.nspname = 'public'
			and c.relkind in ('r', 'p', 'v', 'm', 'f')
			and has_table_privilege(r.role, c.oid, p.privilege)
		union all
		-- Column grants: PostgREST serves a column granted on its own, and
		-- has_table_privilege does not see one.
		select r.role, c.relname, p.privilege || ' (column)'
		from pg_class c
		join pg_namespace n on n.oid = c.relnamespace
		cross join ${API_ROLES}
		cross join unnest(array['SELECT', 'INSERT', 'UPDATE', 'REFERENCES'])
			as p(privilege)
		where n.nspname = 'public'
			and c.relkind in ('r', 'p', 'v', 'm', 'f')
			and not has_table_privilege(r.role, c.oid, p.privilege)
			and has_any_column_privilege(r.role, c.oid, p.privilege)
		union all
		select r.role, c.relname, p.privilege
		from pg_class c
		join pg_namespace n on n.oid = c.relnamespace
		cross join ${API_ROLES}
		cross join unnest(array['USAGE', 'SELECT', 'UPDATE']) as p(privilege)
		where n.nspname = 'public'
			and c.relkind = 'S'
			and has_sequence_privilege(r.role, c.oid, p.privilege)
		union all
		select r.role, f.proname, 'EXECUTE'
		from pg_proc f
		join pg_namespace n on n.oid = f.pronamespace
		cross join ${API_ROLES}
		where n.nspname = 'public'
			and has_function_privilege(r.role, f.oid, 'EXECUTE')
		order by 1, 2, 3
	`)
	return [...rows]
}

describe('Data API roles on the public schema', () => {
	let db: Db

	beforeAll(async () => {
		db = (await import('../../app/db/client')).getDbClient()
	})

	it('hold no privilege on any table, sequence or function', async () => {
		expect(await heldPrivileges(db)).toEqual([])
	})

	it('receive none on objects created after the migration', async () => {
		const rollback = new Error('rollback')
		let held: HeldPrivilege[] = []

		await db
			.transaction(async (tx) => {
				await tx.execute(sql`
					create table public.data_api_roles_probe (id serial primary key)
				`)
				await tx.execute(sql`
					create function public.data_api_roles_probe_fn() returns int
					language sql as 'select 1'
				`)
				held = await heldPrivileges(tx)
				throw rollback
			})
			.catch((error: unknown) => {
				if (error !== rollback) throw error
			})

		expect(held).toEqual([])
	})
})
