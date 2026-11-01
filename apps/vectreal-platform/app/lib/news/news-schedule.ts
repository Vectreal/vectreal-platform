/*
  When a newsroom article goes live, decided in one place.

  An article is scheduled while its `publishedAt` is in the future. It is
  merged and deployed like any other, prerendered with the rest, and becomes
  visible on production on its own once the time passes: `server.mjs` stops
  answering its prerendered files with a 404 and the per-request list pages
  start listing it. Staging shows it early, labeled, so it can be read in place
  before it goes out.

  This module is pure and client-safe. The browser uses it for the "Scheduled
  for" label; the server half, which knows the deployment, is
  `news-manifest.server.ts`.
*/

/**
 * The timezone a `publishedAt` without an offset is read in. A date alone,
 * `2026-11-03`, means 00:00 on that day here; a time without an offset,
 * `2026-11-03T09:00`, is 09:00 here. Either way it is the wall clock the
 * newsroom is written from, whatever timezone the server or the reader is in.
 * Add `Z` or an offset to say anything else.
 */
export const NEWS_SCHEDULE_TIME_ZONE = 'Europe/Berlin'

// A date, optionally with a time, and no `Z` or offset. A space in place of
// the `T` is accepted too, since `Date.parse` would otherwise read it in the
// server's own timezone.
const LOCAL_DATE_TIME =
	/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3})\d*)?)?)?$/

const offsetFormatter = new Intl.DateTimeFormat('en-US', {
	timeZone: NEWS_SCHEDULE_TIME_ZONE,
	hourCycle: 'h23',
	year: 'numeric',
	month: 'numeric',
	day: 'numeric',
	hour: 'numeric',
	minute: 'numeric',
	second: 'numeric'
})

/** How far the schedule timezone's wall clock is ahead of UTC at `instant`. */
function scheduleZoneOffsetMs(instant: number): number {
	const parts = Object.fromEntries(
		offsetFormatter
			.formatToParts(new Date(instant))
			.map(({ type, value }) => [type, Number(value)])
	)
	const wallClockAsUtc = Date.UTC(
		parts.year,
		parts.month - 1,
		parts.day,
		parts.hour,
		parts.minute,
		parts.second
	)

	return wallClockAsUtc - Math.floor(instant / 1000) * 1000
}

/**
 * The instant a `publishedAt` names, in epoch milliseconds, or `NaN` when it is
 * not a date. See `NEWS_SCHEDULE_TIME_ZONE` for strings without an offset.
 */
export function resolvePublishedAt(value: string): number {
	const local = LOCAL_DATE_TIME.exec(value.trim())
	if (!local) {
		return Date.parse(value)
	}

	const [, year, month, day, hour, minute, second, millis] = local
	const wallClockAsUtc = Date.UTC(
		Number(year),
		Number(month) - 1,
		Number(day),
		Number(hour ?? 0),
		Number(minute ?? 0),
		Number(second ?? 0),
		Number((millis ?? '0').padEnd(3, '0'))
	)

	// Taking the offset at the wall-clock instant and then again at the
	// result settles the hour around a daylight-saving change.
	const firstGuess = wallClockAsUtc - scheduleZoneOffsetMs(wallClockAsUtc)
	return wallClockAsUtc - scheduleZoneOffsetMs(firstGuess)
}

/** True while `publishedAt` is still ahead of `now`. */
export function isScheduledAt(publishedAt: string, now: number): boolean {
	return resolvePublishedAt(publishedAt) > now
}

/**
 * Whether an article may be shown here and now.
 *
 * `previewScheduled` is true where scheduled articles are shown early: staging,
 * the dev server and the prerender, which has to render every page whatever
 * its date. Drafts are a separate rule, applied before this one.
 */
export function isNewsArticleLive(
	publishedAt: string,
	now: number,
	{ previewScheduled }: { previewScheduled: boolean }
): boolean {
	return previewScheduled || !isScheduledAt(publishedAt, now)
}

const NEWS_ARTICLE_PATH_PREFIX = '/news-room/'

/**
 * A request path the way `express.static` resolves it, lowercased, or null
 * when it cannot be decoded.
 *
 * `express.static` decodes the path and resolves `//`, `.` and `..` segments
 * before it looks for a file, so `/news-room/%73lug` and `//news-room/./slug`
 * both reach `news-room/slug/index.html`. A gate that compared the raw string
 * would miss them. Lowercased so that on a case-insensitive filesystem a
 * gate errs toward withholding.
 */
export function normalizeRequestPath(pathname: string): string | null {
	let decoded: string
	try {
		decoded = decodeURIComponent(pathname)
	} catch {
		return null
	}

	const segments: string[] = []
	for (const segment of decoded.split('/')) {
		if (segment === '' || segment === '.') continue
		if (segment === '..') segments.pop()
		else segments.push(segment)
	}

	return `/${segments.join('/')}`.toLowerCase()
}

/**
 * The article slug a request path names, in any spelling that can reach the
 * article's prerendered files, or null when it names no article. The suffixes
 * are the prerendered page itself (`/index.html`), its single-fetch payload
 * (`.data`) and its markdown twin (`.md`).
 */
export function newsSlugFromRequestPath(pathname: string): string | null {
	const path = normalizeRequestPath(pathname)
		?.replace(/\/index\.html$/, '')
		.replace(/\.(data|md)$/, '')
	if (!path?.startsWith(NEWS_ARTICLE_PATH_PREFIX)) return null

	const slug = path.slice(NEWS_ARTICLE_PATH_PREFIX.length)
	return slug && !slug.includes('/') ? slug : null
}

const scheduledForFormatter = new Intl.DateTimeFormat('en-US', {
	timeZone: NEWS_SCHEDULE_TIME_ZONE,
	month: 'short',
	day: 'numeric',
	year: 'numeric',
	hour: 'numeric',
	minute: '2-digit',
	timeZoneName: 'short'
})

/** "Scheduled for Nov 3, 2026, 9:00 AM GMT+1", in the schedule timezone. */
export function formatScheduledFor(publishedAt: string): string {
	return `Scheduled for ${scheduledForFormatter.format(resolvePublishedAt(publishedAt))}`
}
