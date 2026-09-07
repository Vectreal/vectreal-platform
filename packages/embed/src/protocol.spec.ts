import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { isViewerCommand } from './protocol'

/**
 * `isViewerCommand` is the gate every command passes through on its way into
 * the iframe. Its `default: return false` means an unhandled command type is
 * dropped with no error on either side, so each supported type needs an
 * explicit assertion that it survives the crossing.
 */
describe('isViewerCommand', () => {
	it.each([
		{ type: 'activate_camera', cameraId: 'front' },
		{ type: 'focus_hotspot', hotspotId: 'handle' },
		{ type: 'set_controls_enabled', enabled: false },
		{ type: 'set_auto_rotate', enabled: true },
		{ type: 'set_auto_rotate', enabled: true, speed: 0.5 },
		{ type: 'set_controls_options', zoom: true },
		{ type: 'set_controls_options', pan: false },
		{ type: 'set_transition', transitionType: 'linear' },
		{ type: 'set_animation_playing', playing: true },
		{ type: 'set_animation_playing', playing: false },
		{ type: 'restart_animation' },
		{ type: 'seek_animation_clip', clipId: 'spin', time: 0 },
		{ type: 'seek_animation_clip', clipId: 'spin', time: 1.25 }
	])('accepts %j', (command) => {
		expect(isViewerCommand(command)).toBe(true)
	})

	it.each([
		null,
		undefined,
		'set_animation_playing',
		[],
		{},
		{ type: 42 },
		{ type: 'unknown_command' },
		{ type: 'activate_camera', cameraId: '  ' },
		{ type: 'set_transition', transitionType: 'warp' },
		// Animation-specific rejections.
		{ type: 'set_animation_playing' },
		{ type: 'set_animation_playing', playing: 'yes' },
		{ type: 'seek_animation_clip', clipId: 'spin' },
		{ type: 'seek_animation_clip', clipId: '', time: 1 },
		{ type: 'seek_animation_clip', clipId: 'spin', time: -1 },
		{ type: 'seek_animation_clip', clipId: 'spin', time: Number.NaN },
		{ type: 'seek_animation_clip', clipId: 'spin', time: Infinity },
		{ type: 'seek_animation_clip', clipId: 'spin', time: '1' }
	])('rejects %j', (command) => {
		expect(isViewerCommand(command)).toBe(false)
	})
})

describe('focus_hotspot', () => {
	it.each([
		['no id at all', { type: 'focus_hotspot' }],
		['a blank id', { type: 'focus_hotspot', hotspotId: '   ' }],
		['a non-string id', { type: 'focus_hotspot', hotspotId: 42 }]
	])('refuses %s', (_label, command) => {
		expect(isViewerCommand(command)).toBe(false)
	})
})

/**
 * Every command in the union has a case in the guard.
 *
 * `isViewerCommand`'s `default: return false` drops an unregistered command
 * silently, with no error on either side of the iframe - so a command added to
 * the union and forgotten here type-checks, sends, and simply never arrives.
 * The guard reads the union out of the viewer package rather than repeating it,
 * so it covers the next command added, not just this one.
 */
describe('the guard covers the command union', () => {
	const viewerTypes = readFileSync(
		join(import.meta.dirname, '../../viewer/src/types/viewer-interactions.ts'),
		'utf8'
	)
	const protocol = readFileSync(
		join(import.meta.dirname, 'protocol.ts'),
		'utf8'
	)

	const commandTypes = [
		...viewerTypes.matchAll(
			/export interface \w+ViewerCommand \{\n\ttype: '(\w+)'/g
		)
	].map((match) => match[1])

	const guard = protocol
		.split('export function isViewerCommand')[1]
		?.split('\nexport ')[0]

	it('found the union and the guard to compare', () => {
		expect(commandTypes.length).toBeGreaterThan(5)
		expect(guard).toBeTruthy()
	})

	it.each(commandTypes)('registers %s', (type) => {
		expect(guard).toContain(`case '${type}':`)
	})
})
