import { getPublishedNewsArticles } from './news-manifest.server'
import { resolvePublishedAt } from './news-schedule'
import { SITE_URL } from '../seo'

/*
  Tells search engines when a newsroom article goes live, over IndexNow
  (https://www.indexnow.org/documentation), which Bing, Yandex and the other
  participating engines share. Google takes no part: it retired its sitemap
  ping in 2023 and reads the sitemap's `lastmod` instead.

  Going live is decided by the clock on every request (`news-schedule.ts`), so
  nothing happens at that moment for a hook to run on. The production server
  is the one process that sees the clock pass, so it checks every few minutes
  and submits whatever went live since the last check.
*/

/**
 * Proves to the engines that we own the host: they fetch `/<key>.txt` and
 * expect exactly this. It is public by design, served from
 * `public/<key>.txt`; changing it means renaming that file too.
 */
export const INDEXNOW_KEY = 'af5b4778130ef2a3f1210c447590ceb1'

const INDEXNOW_ENDPOINT = 'https://api.indexnow.org/indexnow'
const CHECK_INTERVAL_MS = 5 * 60_000
// How far back the first check after a start looks. A deploy or restart
// shortly after an article went live submits it again, which the engines
// treat as a repeat, not as spam.
const CATCH_UP_MS = 24 * 60 * 60_000

/**
 * True only where `APPLICATION_URL` names the production host. Stricter than
 * `isCanonicalDeployment`, which counts an unset or unreadable value as
 * production so a misconfigured deploy stays indexed: here that would let a
 * developer's machine or a local container announce URLs.
 */
function isProductionServer(
	applicationUrl = process.env.APPLICATION_URL
): boolean {
	try {
		return new URL(applicationUrl ?? '').host === new URL(SITE_URL).host
	} catch {
		return false
	}
}

/** URLs of the articles that went live after `from` and up to `to`. */
export function articleUrlsLiveBetween(from: number, to: number): string[] {
	return getPublishedNewsArticles(to)
		.filter((article) => resolvePublishedAt(article.publishedAt) > from)
		.map((article) => `${SITE_URL}/news-room/${article.slug}`)
}

/**
 * Sends `urls` to IndexNow. A failure is logged and dropped: the sitemap
 * still lists the article, so a missed notification only means the engines
 * find it on their next crawl.
 */
export async function submitToIndexNow(urls: string[]): Promise<void> {
	if (urls.length === 0) return

	try {
		const response = await fetch(INDEXNOW_ENDPOINT, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json; charset=utf-8' },
			body: JSON.stringify({
				host: new URL(SITE_URL).host,
				key: INDEXNOW_KEY,
				urlList: urls
			}),
			// A slow endpoint must not stack requests across five-minute checks.
			signal: AbortSignal.timeout(10_000)
		})
		// Nothing in the body is needed; release the connection.
		await response.body?.cancel()
		if (!response.ok) {
			console.warn(
				`IndexNow answered ${response.status} for ${urls.join(', ')}`
			)
		}
	} catch (error) {
		console.warn('IndexNow submission failed', error)
	}
}

/**
 * Starts the checks; `server.mjs` calls it once the server listens. Does
 * nothing anywhere but production: staging shows scheduled articles early,
 * and a local run has nothing to announce.
 *
 * Each machine checks on its own, so with more than one running, an article
 * is submitted once per machine, and a machine that starts within a day of
 * an article going live submits it again. Repeats of a handful of URLs are
 * not what IndexNow throttles, and coordinating machines would need shared
 * state this app does not otherwise keep.
 */
export function startIndexNowSubmissions({
	now = Date.now,
	submit = submitToIndexNow
}: {
	now?: () => number
	submit?: (urls: string[]) => Promise<void>
} = {}): () => void {
	if (!isProductionServer()) return () => {}

	let checkedUntil = now() - CATCH_UP_MS
	const check = () => {
		const to = now()
		void submit(articleUrlsLiveBetween(checkedUntil, to))
		checkedUntil = to
	}

	check()
	const timer = setInterval(check, CHECK_INTERVAL_MS)
	timer.unref()
	return () => clearInterval(timer)
}
