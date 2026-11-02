import { describe, expect, it } from 'vitest'

import {
	formatScheduledFor,
	isNewsArticleLive,
	isScheduledAt,
	lastChangedAt,
	newsSlugFromRequestPath,
	resolvePublishedAt
} from './news-schedule'

describe('resolvePublishedAt', () => {
	it('reads a date alone as midnight in Berlin, in winter and in summer', () => {
		// CET is UTC+1, CEST is UTC+2.
		expect(resolvePublishedAt('2026-11-03')).toBe(
			Date.parse('2026-11-02T23:00:00Z')
		)
		expect(resolvePublishedAt('2026-07-03')).toBe(
			Date.parse('2026-07-02T22:00:00Z')
		)
	})

	it('reads a time without an offset as Berlin wall-clock time', () => {
		expect(resolvePublishedAt('2026-11-03T09:30')).toBe(
			Date.parse('2026-11-03T08:30:00Z')
		)
		expect(resolvePublishedAt('2026-11-03 09:30')).toBe(
			Date.parse('2026-11-03T08:30:00Z')
		)
		expect(resolvePublishedAt('2026-07-03T09:30:15.250')).toBe(
			Date.parse('2026-07-03T07:30:15.250Z')
		)
	})

	it('settles the hour across both daylight-saving changes', () => {
		// 2026-03-29: clocks go from 02:00 CET to 03:00 CEST.
		expect(resolvePublishedAt('2026-03-29T03:00')).toBe(
			Date.parse('2026-03-29T01:00:00Z')
		)
		expect(resolvePublishedAt('2026-03-29T01:00')).toBe(
			Date.parse('2026-03-29T00:00:00Z')
		)
		// 2026-10-25: clocks go from 03:00 CEST back to 02:00 CET.
		expect(resolvePublishedAt('2026-10-25T04:00')).toBe(
			Date.parse('2026-10-25T03:00:00Z')
		)
		expect(resolvePublishedAt('2026-10-25T01:00')).toBe(
			Date.parse('2026-10-24T23:00:00Z')
		)
	})

	it('keeps an explicit offset or Z as written', () => {
		expect(resolvePublishedAt('2026-11-03T09:00:00Z')).toBe(
			Date.parse('2026-11-03T09:00:00Z')
		)
		expect(resolvePublishedAt('2026-11-03T09:00:00-05:00')).toBe(
			Date.parse('2026-11-03T14:00:00Z')
		)
	})

	it('is NaN for anything that is not a date', () => {
		expect(resolvePublishedAt('soon')).toBeNaN()
		expect(resolvePublishedAt('')).toBeNaN()
	})
})

describe('isNewsArticleLive', () => {
	const publishedAt = '2026-11-03T09:00'
	const at = resolvePublishedAt(publishedAt)

	it('is false before the time and true from it, where nothing previews', () => {
		const previewScheduled = false
		expect(isNewsArticleLive(publishedAt, at - 1, { previewScheduled })).toBe(
			false
		)
		expect(isNewsArticleLive(publishedAt, at, { previewScheduled })).toBe(true)
		expect(isNewsArticleLive(publishedAt, at + 1, { previewScheduled })).toBe(
			true
		)
	})

	it('is true before the time where scheduled articles are previewed', () => {
		expect(
			isNewsArticleLive(publishedAt, at - 1, { previewScheduled: true })
		).toBe(true)
	})

	it('treats an unreadable date as not scheduled, as validation drops it first', () => {
		expect(isScheduledAt('soon', 0)).toBe(false)
	})
})

describe('newsSlugFromRequestPath', () => {
	it.each([
		'/news-room/launch-article',
		'/news-room/launch-article/',
		'/news-room/launch-article/index.html',
		'/news-room/launch-article.data',
		'/news-room/launch-article.md',
		'/news-room/launch-article.md/',
		'/news-room/%6Caunch-article',
		'//news-room//launch-article',
		'/news-room/./launch-article',
		'/x/../news-room/launch-article',
		'/News-Room/Launch-Article/INDEX.HTML'
	])('finds the article in %s', (pathname) => {
		expect(newsSlugFromRequestPath(pathname)).toBe('launch-article')
	})

	it.each([
		'/news-room',
		'/news-room/',
		'/news-room.data',
		'/news-room/a/b',
		'/docs/launch-article',
		'/news-room/%E0%A4%A'
	])('finds no article in %s', (pathname) => {
		expect(newsSlugFromRequestPath(pathname)).toBeNull()
	})
})

describe('lastChangedAt', () => {
	it('is the update once it comes after going live', () => {
		expect(lastChangedAt('2026-11-03', '2026-11-10')).toBe('2026-11-10')
	})

	it('is the go-live time when the update was made before it', () => {
		expect(lastChangedAt('2026-11-03T09:00', '2026-11-01')).toBe(
			'2026-11-03T09:00'
		)
		// Same day, earlier hour, Berlin time.
		expect(lastChangedAt('2026-11-03T09:00', '2026-11-03T08:00')).toBe(
			'2026-11-03T09:00'
		)
	})

	it('is the go-live time when there is no update', () => {
		expect(lastChangedAt('2026-11-03')).toBe('2026-11-03')
	})
})

describe('formatScheduledFor', () => {
	it('names the date and time in Berlin, whatever zone this runs in', () => {
		expect(formatScheduledFor('2026-11-03T09:00')).toBe(
			'Scheduled for Nov 3, 2026, 9:00 AM GMT+1'
		)
		expect(formatScheduledFor('2026-07-03')).toBe(
			'Scheduled for Jul 3, 2026, 12:00 AM GMT+2'
		)
	})
})
