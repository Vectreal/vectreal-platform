// apps/api/drizzle.config.ts
import { defineConfig } from 'drizzle-kit'

// Ensure the DATABASE_URL environment variable is set
const connectionUrl = process.env.DATABASE_URL
if (!connectionUrl) {
	throw new Error('DATABASE_URL environment variable is not set')
}

export default defineConfig({
	// Specify the database dialect
	dialect: 'postgresql', // Explicitly set database dialect
	schema: './app/db/schema/index.ts', // Point to the main schema file
	out: 'drizzle', // Output directory for migrations
	dbCredentials: {
		url: connectionUrl
	}
})
