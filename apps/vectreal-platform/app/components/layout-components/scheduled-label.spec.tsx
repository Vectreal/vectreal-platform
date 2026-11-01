// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ScheduledLabel } from './scheduled-label'
import { resolvePublishedAt } from '../../lib/news/news-schedule'

const PUBLISHED_AT = '2026-11-03T09:00'

beforeEach(() => {
	vi.useFakeTimers({ toFake: ['Date'] })
})

afterEach(() => {
	cleanup()
	vi.useRealTimers()
})

describe('ScheduledLabel', () => {
	it('renders nothing on the server, so prerendered HTML never carries it', () => {
		vi.setSystemTime(resolvePublishedAt(PUBLISHED_AT) - 60_000)
		expect(renderToString(<ScheduledLabel publishedAt={PUBLISHED_AT} />)).toBe(
			''
		)
	})

	it('names the time in the browser while it is still ahead', () => {
		vi.setSystemTime(resolvePublishedAt(PUBLISHED_AT) - 60_000)
		const { container } = render(<ScheduledLabel publishedAt={PUBLISHED_AT} />)
		expect(container.textContent).toBe(
			'Scheduled for Nov 3, 2026, 9:00 AM GMT+1'
		)
	})

	it('is gone once the time has passed', () => {
		vi.setSystemTime(resolvePublishedAt(PUBLISHED_AT))
		const { container } = render(<ScheduledLabel publishedAt={PUBLISHED_AT} />)
		expect(container.textContent).toBe('')
	})
})
