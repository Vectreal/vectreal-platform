// Served by `newsArticleBodiesPlugin` (app/lib/news/news-body-chunks.ts).
declare module 'virtual:news-article-bodies' {
	const bodyLoaders: Record<
		string,
		() => Promise<{
			default: import('react').ComponentType<Record<string, unknown>>
		}>
	>
	export default bodyLoaders
}
