/**
 * Fails the build when a newsroom article's body chunk is not named the way
 * the scheduled-article gate expects.
 *
 * Run by `build-ci`, right after the build. On production, `server.mjs`
 * withholds a scheduled article's files until its `publishedAt`, the client
 * chunk with its compiled body among them, and it recognizes that chunk by
 * opaque name (`newsArticleChunkFileNames` writes it, `isArticleBodyChunkPath`
 * reads it). A Vite upgrade that stopped applying `chunkFileNames`, or a
 * plugin that renamed the chunk, would serve every scheduled body early with
 * every test still green, because only the real build shows the name. It also
 * fails if any chunk is still named after an article file.
 */
import { readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
	isArticleBodyChunkPath,
	newsBodyId
} from '../app/lib/news/news-body-chunks'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const ARTICLES = path.resolve(
	scriptDir,
	'../app/routes/news-room-page/articles'
)
const ASSETS = path.resolve(
	scriptDir,
	'../../../build/apps/vectreal-platform/client/assets'
)

const chunks = readdirSync(ASSETS).map((file) =>
	`/assets/${file}`.toLowerCase()
)
const articles = readdirSync(ARTICLES).filter((file) => file.endsWith('.mdx'))
const unmatched = articles.filter(
	(file) =>
		!chunks.some((chunk) => isArticleBodyChunkPath(newsBodyId(file), chunk))
)
const named = articles.filter((file) => {
	const stem = file.replace(/\.mdx$/i, '').toLowerCase()
	return chunks.some((chunk) => chunk.includes(stem))
})

if (unmatched.length > 0 || named.length > 0) {
	if (unmatched.length > 0) {
		console.error(
			`No body chunk named /assets/news-body-<id>-<hash>.js for: ${unmatched.join(', ')}.\n` +
				'The scheduled-article gate would not withhold these bodies. Check newsArticleChunkFileNames in app/lib/news/news-body-chunks.ts is still applied.'
		)
	}
	if (named.length > 0) {
		console.error(
			`A client chunk is named after these article files: ${named.join(', ')}.\n` +
				"That publishes a scheduled article's slug before its time."
		)
	}
	process.exit(1)
}

console.log(`News body chunks: all ${articles.length} articles matched.`)
