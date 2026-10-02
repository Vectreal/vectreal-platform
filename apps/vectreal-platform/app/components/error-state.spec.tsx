// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { createRoutesStub } from 'react-router'
import { describe, expect, it, vi } from 'vitest'

import { ErrorState } from './error-state'
import { EmbedErrorState } from './scene-embed/embed-error-state'
import {
	EMBED_ERROR_COPY,
	type EmbedErrorKind
} from '../lib/errors/error-state-copy'

describe('ErrorState', () => {
	it('owns the main landmark at page size', () => {
		const Stub = createRoutesStub([
			{
				path: '/',
				Component: () => (
					<ErrorState size="page" heading="Gone" description="Gone." />
				)
			}
		])
		render(<Stub />)
		expect(screen.getByRole('main')).toBeTruthy()
	})

	it('adds no second main landmark when inset', () => {
		/* Inset renders inside a layout that already owns `<main>`. */
		render(<ErrorState size="inset" heading="Gone" description="Gone." />)
		expect(screen.queryByRole('main')).toBeNull()
		expect(screen.getByRole('region', { name: 'Gone' })).toBeTruthy()
	})
})

describe('EmbedErrorState', () => {
	const kinds = Object.keys(EMBED_ERROR_COPY) as EmbedErrorKind[]

	it.each(kinds)("%s offers no link, inside somebody else's page", (kind) => {
		const { container } = render(
			<EmbedErrorState kind={kind} onRetry={() => {}} />
		)
		expect(container.querySelectorAll('a')).toHaveLength(0)
		expect(container.querySelectorAll('button').length).toBeLessThanOrEqual(1)
	})

	it.each(kinds)('%s offers Try again only when it could help', (kind) => {
		render(<EmbedErrorState kind={kind} onRetry={() => {}} />)
		expect(screen.queryByRole('button', { name: 'Try again' }) !== null).toBe(
			EMBED_ERROR_COPY[kind].retryable
		)
	})

	it('runs the retry it was given', () => {
		const onRetry = vi.fn()
		render(<EmbedErrorState kind="load_failed" onRetry={onRetry} />)
		screen.getByRole('button', { name: 'Try again' }).click()
		expect(onRetry).toHaveBeenCalledOnce()
	})

	it('offers nothing when there is nothing to retry with', () => {
		render(<EmbedErrorState kind="load_failed" />)
		expect(screen.queryByRole('button')).toBeNull()
	})
})
