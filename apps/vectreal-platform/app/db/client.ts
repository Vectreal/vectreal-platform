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

	// Configure connection pooling to prevent exhausting database connections
	const client = postgres(DATABASE_URL, {
		prepare: false,
		// Connection pooling configuration
		max: parseInt(process.env.DB_POOL_MAX || '10'), // Maximum number of connections in pool
		idle_timeout: parseInt(process.env.DB_IDLE_TIMEOUT || '20'), // Close connections after inactivity
		max_lifetime: parseInt(process.env.DB_MAX_LIFETIME || '1800'), // Close connections after time (30 min default)
		// For serverless/development environments
		transform: {
			undefined: null, // Transform undefined to null for PostgreSQL compatibility
		},
		// Prevent connection leaks in development
		debug: process.env.NODE_ENV === 'development' ? console.log : false,
	})
	
	cachedClient = drizzle({ client, schema })
	return cachedClient
}

/**
 * Cleanup database connections on application shutdown.
 * Call this during graceful shutdown to prevent connection leaks.
 */
export async function closeDbConnection() {
	if (cachedClient) {
		// Access the underlying postgres client for cleanup
		const client = (cachedClient as unknown as { $client: { end(): Promise<void> } }).$client
		if (client && typeof client.end === 'function') {
			await client.end()
		}
		cachedClient = null
	}
}
