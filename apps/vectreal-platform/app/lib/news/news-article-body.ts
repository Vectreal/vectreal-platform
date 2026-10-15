import { lazy } from 'react'

import type { ComponentType, LazyExoticComponent } from 'react'

type ArticleBody = ComponentType<Record<string, unknown>>

/*
  One article's compiled MDX, loaded on its own. The glob is lazy, so each body
  is a separate chunk and the article page carries only a table of loaders.

  The page renders the body with no Suspense boundary of its own, on purpose.
  On the server that holds back the shell until the body is ready, so the HTML
  (and every prerendered page) has the article inline rather than streamed in
  behind a script. In the browser, hydration and navigation both run in a
  transition, which keeps the current screen up until the chunk arrives.
*/
const loaders = import.meta.glob<ArticleBody>(
	'../../routes/news-room-page/articles/*.mdx',
	{ import: 'default' }
)

const bodies = new Map<string, LazyExoticComponent<ArticleBody>>(
	Object.entries(loaders).map(([moduleKey, load]) => [
		fileNameOf(moduleKey),
		lazy(() => load().then((Body) => ({ default: Body })))
	])
)

function fileNameOf(path: string): string {
	return path.slice(path.lastIndexOf('/') + 1)
}

/** The body of the article at `sourcePath`, as the manifest gives it. */
export function getArticleBody(
	sourcePath: string
): LazyExoticComponent<ArticleBody> | undefined {
	return bodies.get(fileNameOf(sourcePath))
}
