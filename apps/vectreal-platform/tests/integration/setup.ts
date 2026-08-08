const url = process.env.DATABASE_URL

if (!url) {
	throw new Error(
		'DATABASE_URL is not set. Start the local stack with `pnpm supabase start`, ' +
			'then run `pnpm nx run vectreal-platform:test-integration`.',
	)
}

const host = new URL(url).hostname

if (host !== '127.0.0.1' && host !== 'localhost') {
	throw new Error(
		`Integration tests only run against a local database (got host "${host}"). ` +
			'They write real rows; point DATABASE_URL at the local Supabase instance.',
	)
}
