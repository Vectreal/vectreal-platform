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
