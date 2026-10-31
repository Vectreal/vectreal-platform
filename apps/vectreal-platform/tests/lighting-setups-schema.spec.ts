/**
 * Every lighting setup is a lighting a save accepts.
 *
 * The Lighting tool writes a picked setup straight into the scene, through
 * the same schema the settings API and the CLI validate against. A setup the
 * schema refuses would fail to save the moment someone picked it.
 */
import { LIGHTING_SETUPS } from '@vctrl/core'
import { sceneLightingSchema } from '@vctrl/sdk'
import { describe, expect, it } from 'vitest'

describe('LIGHTING_SETUPS', () => {
	it.each(LIGHTING_SETUPS.map((setup) => [setup.id, setup.lighting] as const))(
		'%s saves',
		(_id, lighting) => {
			expect(sceneLightingSchema.safeParse(lighting).success).toBe(true)
		}
	)
})
