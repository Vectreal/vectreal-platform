/**
 * The real article the newsroom schedule specs treat as one about to go live,
 * and the article before it.
 *
 * It is the newest article with two days clear on both sides, picked
 * from every article whatever today's date. Taking the newest published one
 * instead broke the specs whenever two articles went live at the same minute,
 * and changed what they tested each time an article went live. A clock set
 * around its `publishedAt` leaves every older article published and every
 * newer one scheduled, and the two days either side keep its neighbors out of
 * a day's catch-up started a few minutes off its time.
 */
import { getPublishedNewsArticles } from '../app/lib/news/news-manifest.server'
import { resolvePublishedAt } from '../app/lib/news/news-schedule'

import type { NewsArticle } from '../app/lib/news/news-article'

const CLEAR = 2 * 24 * 60 * 60_000

export function getStandInArticles(): {
	standIn: NewsArticle
	previous: NewsArticle
} {
	const articles = getPublishedNewsArticles(Number.MAX_SAFE_INTEGER)
	const at = (index: number) => resolvePublishedAt(articles[index].publishedAt)
	const index = articles.findIndex(
		(_, i) =>
			i + 1 < articles.length &&
			at(i) - at(i + 1) > CLEAR &&
			(i === 0 || at(i - 1) - at(i) > CLEAR)
	)
	if (index === -1)
		throw new Error('No article has two days clear on both sides')
	return { standIn: articles[index], previous: articles[index + 1] }
}
