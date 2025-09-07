// src/db/client.ts
import { drizzle, PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

import * as schema from './schema'

/**
 * Lazily create or return a singleton Drizzle client.
 * Ensures a single instance per invocation and support serverless environments.
 */
let cachedClient: PostgresJsDatabase<typeof schema> | null = null

export function getDbClient() {
	if (cachedClient) {
		return cachedClient
	}
	const DATABASE_URL = process.env.DATABASE_URL
	if (!DATABASE_URL) throw new Error('Missing DATABASE_URL env variable')

	const client = postgres(DATABASE_URL, { prepare: false })
	cachedClient = drizzle({ client, schema })
	return cachedClient
}
