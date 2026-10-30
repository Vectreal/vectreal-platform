/**
 * Fails the build when a newsroom article's body chunk is not named the way
 * the scheduled-article gate expects.
 *
 * Run by `build-ci`, right after the build. On production, `server.mjs`
 * withholds a scheduled article's files until its `publishedAt`, the client
 * chunk with its compiled body among them, and it recognizes that chunk by
 * name (`isArticleBodyChunkPath`). A Vite upgrade or a `chunkFileNames`
 * setting that renamed it would serve every scheduled body early with every
 * test still green, because only the real build shows the name.
 */
import { readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { isArticleBodyChunkPath } from '../app/lib/news/news-schedule'

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
	(file) => !chunks.some((chunk) => isArticleBodyChunkPath(file, chunk))
)

if (unmatched.length > 0) {
	console.error(
		`No body chunk named /assets/<file name>-<hash>.js for: ${unmatched.join(', ')}.\n` +
			'The scheduled-article gate would not withhold these bodies. Update isArticleBodyChunkPath in app/lib/news/news-schedule.ts to match the new naming.'
	)
	process.exit(1)
}

console.log(`News body chunks: all ${articles.length} articles matched.`)
