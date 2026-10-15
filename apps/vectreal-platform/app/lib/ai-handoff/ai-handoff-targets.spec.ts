import { describe, expect, it } from 'vitest'

import { AI_HANDOFF_TARGETS, buildPagePrompt } from './ai-handoff-targets'

describe('AI hand-off targets', () => {
	it.each(AI_HANDOFF_TARGETS.map((target) => [target.id, target]))(
		'%s carries the prompt intact through encoding',
		(_, target) => {
			const prompt = buildPagePrompt(
				target.kind,
				'/docs/guides/upload',
				'A title with & "quotes" #hash ?query'
			)
			const url = new URL(target.buildUrl(prompt))

			expect([...url.searchParams.values()]).toEqual([prompt])
		}
	)

	it('points the model at the twin on the canonical site, whatever the origin', () => {
		for (const kind of ['chat', 'agent'] as const) {
			expect(
				buildPagePrompt(kind, '/docs/guides/upload', 'Uploading')
			).toContain('https://vectreal.com/docs/guides/upload.md')
		}
	})
})
