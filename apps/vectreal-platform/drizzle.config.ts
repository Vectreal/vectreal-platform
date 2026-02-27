// apps/vectreal-platform/drizzle.config.ts
import { defineConfig } from 'drizzle-kit'

const isGenerateCommand = process.argv.some((arg) => arg.includes('generate'))

const connectionUrl =
	process.env.DATABASE_URL ||
	(isGenerateCommand
		? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
		: undefined)

if (!connectionUrl) {
	throw new Error(
		'DATABASE_URL environment variable is not set (required for drizzle-kit commands that connect to the database)'
	)
}

export default defineConfig({
	// Specify the database dialect

	dialect: 'postgresql', // Explicitly set database dialect
	schema: './app/db/schema/index.ts', // Point to the main schema file
	out: './supabase/migrations', // Output directory for migrations
	dbCredentials: {
		url: connectionUrl
	}
})
