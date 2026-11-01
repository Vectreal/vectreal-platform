import { lazy } from 'react'
import bodyLoaders from 'virtual:news-article-bodies'

import type { ComponentType, LazyExoticComponent } from 'react'

type ArticleBody = ComponentType<Record<string, unknown>>

/*
  One article's compiled MDX, loaded on its own. Each body is a separate chunk
  and the article page carries only a table of loaders, keyed by an opaque id
  (`news-body-chunks.ts`) so the table names no article: a scheduled
  one's slug would otherwise ship to every visitor before its time.

  The page renders the body with no Suspense boundary of its own, on purpose.
  On the server that holds back the shell until the body is ready, so the HTML
  (and every prerendered page) has the article inline rather than streamed in
  behind a script. In the browser, hydration and navigation both run in a
  transition, which keeps the current screen up until the chunk arrives.
*/
const bodies = new Map<string, LazyExoticComponent<ArticleBody>>(
	Object.entries(bodyLoaders).map(([bodyId, load]) => [bodyId, lazy(load)])
)

/** The body of the article with `bodyId`, as the manifest gives it. */
export function getArticleBody(
	bodyId: string
): LazyExoticComponent<ArticleBody> | undefined {
	return bodies.get(bodyId)
}
