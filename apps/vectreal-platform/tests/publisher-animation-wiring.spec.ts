/**
 * The publisher canvas plays what the Animation tool edits.
 *
 * Read from source because a route module cannot be imported by a test. The
 * viewer mounts no animation runtime without both the model's clips and the
 * settings, and the reconciliation hook is what keeps a saved config pointed
 * at the clips a re-uploaded model actually has; it lives here rather than in
 * the tool so it runs whether or not the tool is opened.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const page = readFileSync(
	join(
		import.meta.dirname,
		'..',
		'app',
		'routes',
		'publisher-page',
		'publisher.$sceneId.tsx'
	),
	'utf8'
)

describe('the publisher canvas', () => {
	it("hands the viewer the model's clips and the edited settings", () => {
		expect(page).toContain('animations={file?.animations}')
		expect(page).toContain('animationOptions={animation}')
		expect(page).toMatch(
			/const \{\s*animation,[\s\S]*?\} = useAtomValue\(sceneViewerSettingsAtom\)/
		)
	})

	it('reconciles a saved config with the loaded clips', () => {
		expect(page).toMatch(/^\tuseAnimationReconciliation\(\)$/m)
	})
})
