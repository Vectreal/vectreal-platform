export function normalizeSlug(input: string): string {
	return input
		.trim()
		.toLowerCase()
		.replace(/\.(md|mdx)$/i, '')
		.replace(/[^a-z0-9\s-]/g, '')
		.replace(/\s+/g, '-')
		.replace(/-+/g, '-')
		.replace(/^-|-$/g, '')
}
