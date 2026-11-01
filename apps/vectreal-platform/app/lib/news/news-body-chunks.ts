import { readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import type { Plugin, Rolldown } from 'vite'

/*
  How the browser loads one article body without learning what the others are
  called.

  `import.meta.glob` keys its table by source path and Vite names each chunk
  after its file, so the article page shipped every MDX file name to every
  visitor, and a scheduled article's slug was public from the day it was
  deployed. The plugin below emits the same table keyed by an opaque id
  instead, and names each body chunk after that id, so neither the page chunk
  nor the `/assets` listing names an article. The server gate reads the same
  naming rule to withhold a scheduled body.

  It runs inside the Vite config graph, so it imports nothing but Node and
  Vite types (see `mdx-to-markdown.ts` for why).
*/

const VIRTUAL_ID = 'virtual:news-article-bodies'
const RESOLVED_ID = `\0${VIRTUAL_ID}`
// Resolved when used: the server bundle imports this module for the naming
// rule, and its own location says nothing about where the articles are.
const articlesDirectory = () =>
	fileURLToPath(
		new URL('../../routes/news-room-page/articles', import.meta.url)
	)

/**
 * The opaque id an article's body is loaded and served by, from its file name.
 *
 * FNV-1a over the file name: stable across builds, so the gate and the browser
 * agree without a lookup table, and short. It hides names from a reader of the
 * bundle; someone who guesses a file name exactly can still confirm it, which
 * is no more than requesting the guessed article URL already tells them.
 */
export function newsBodyId(sourcePath: string): string {
	const fileName = sourcePath.slice(sourcePath.lastIndexOf('/') + 1)
	let hash = 0x811c9dc5
	for (const char of fileName) {
		hash ^= char.codePointAt(0) ?? 0
		hash = Math.imul(hash, 0x01000193) >>> 0
	}
	return hash.toString(16).padStart(8, '0')
}

const BODY_CHUNK_PREFIX = '/assets/news-body-'

/**
 * True when `path`, already lowercased by `normalizeRequestPath`, is the
 * client chunk holding the body with this id. `newsArticleChunkFileNames`
 * below writes the name, and `scripts/check-news-body-chunks.ts` checks the
 * real build produced it.
 */
export function isArticleBodyChunkPath(bodyId: string, path: string): boolean {
	const prefix = `${BODY_CHUNK_PREFIX}${bodyId}-`
	return (
		path.startsWith(prefix) &&
		path.endsWith('.js') &&
		!path.slice(prefix.length).includes('/')
	)
}

function isArticleSource(id: string): boolean {
	return (
		path.dirname(id) === articlesDirectory() &&
		id.toLowerCase().endsWith('.mdx')
	)
}

const UNSAFE_IN_SOURCE: Record<string, string> = {
	'<': '\\u003C',
	'>': '\\u003E',
	'\u2028': '\\u2028',
	'\u2029': '\\u2029'
}

/**
 * A string as a JavaScript literal in emitted source. `JSON.stringify` quotes
 * it and escapes control characters; the rest are the characters that still
 * change what surrounding markup or older parsers make of it.
 */
function toJsLiteral(value: string): string {
	return JSON.stringify(value).replace(
		/[<>\u2028\u2029]/g,
		(char) => UNSAFE_IN_SOURCE[char]
	)
}

/** `output.chunkFileNames`: Vite's default, except for an article body. */
export function newsArticleChunkFileNames(chunk: Rolldown.PreRenderedChunk) {
	const id = chunk.facadeModuleId
	return id && isArticleSource(id)
		? `${BODY_CHUNK_PREFIX.slice(1)}${newsBodyId(id)}-[hash].js`
		: 'assets/[name]-[hash].js'
}

/**
 * Serves `virtual:news-article-bodies`: every article's body loader, keyed by
 * `newsBodyId`. Read by `news-article-body.ts`.
 */
export function newsArticleBodiesPlugin(): Plugin {
	return {
		name: 'vectreal-news-article-bodies',
		resolveId(id) {
			return id === VIRTUAL_ID ? RESOLVED_ID : null
		},
		load(id) {
			if (id !== RESOLVED_ID) return null

			const directory = articlesDirectory()
			const files = readdirSync(directory).filter((file) =>
				file.toLowerCase().endsWith('.mdx')
			)
			const ids = new Map<string, string>()
			for (const file of files) {
				const bodyId = newsBodyId(file)
				const clash = ids.get(bodyId)
				if (clash) {
					throw new Error(
						`News body id ${bodyId} is shared by ${clash} and ${file}. Rename one of them.`
					)
				}
				ids.set(bodyId, file)
			}

			const entries = [...ids].map(
				([bodyId, file]) =>
					`${toJsLiteral(bodyId)}: () => import(${toJsLiteral(path.join(directory, file))})`
			)
			return `export default {\n${entries.join(',\n')}\n}\n`
		},
		configureServer(server) {
			// A new or removed article changes the table, and both the browser
			// and the SSR runner hold the old one. A virtual module has no file
			// for `reloadModule` to work from, so restart: adding an article is
			// rare enough that a second's wait costs nothing.
			const restart = (file: string) => {
				if (isArticleSource(file)) void server.restart()
			}
			server.watcher.on('add', restart)
			server.watcher.on('unlink', restart)
		}
	}
}
