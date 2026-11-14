// @vitest-environment jsdom
/**
 * The mission band has one effect: the statement's key phrases light as it
 * scrolls. No figure stands beside it, so nothing else on the band moves.
 */
import { render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'

import { MissionStatement } from './mission-statement'
import { HOME_PAGE_COPY } from '../../constants/product-copy'

const COPY = HOME_PAGE_COPY.mission

it('is the statement and its signature, and nothing pictured beside it', () => {
	const { container } = render(<MissionStatement />)
	expect(container.querySelector('blockquote')).not.toBeNull()
	expect(screen.getByText(COPY.signature)).toBeTruthy()
	expect(container.querySelectorAll('img, [style*="--drawing"]')).toHaveLength(
		0
	)
})

it('sets every key phrase apart, so each can light in turn', () => {
	render(<MissionStatement />)
	for (const part of COPY.statement) {
		if (typeof part !== 'string' && 'key' in part)
			expect(screen.getByText(part.key).style.getPropertyValue('--k')).not.toBe(
				''
			)
	}
})
