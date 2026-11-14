// @vitest-environment jsdom
/**
 * Whether a clip holds the model off its bind pose, as the status reports it.
 * The publisher shows a baked copy of the model only while it is not posed,
 * so a paused or clamped clip has to count, and only a stopped mixer, which
 * three returns to the bind pose, does not.
 */
import { act, render } from '@testing-library/react'
import { describeAnimationClips } from '@vctrl/core'
import { AnimationClip, Group, NumberKeyframeTrack } from 'three'
import { describe, expect, it, vi } from 'vitest'

import SceneAnimation from './scene-animation'

import type {
	AnimationLayerExecutor,
	AnimationPlaybackStatus
} from './scene-animation'

vi.mock('@react-three/fiber', () => ({ useFrame: () => undefined }))

const arrange = (autoplay: boolean) => {
	const model = new Group()
	model.name = 'body'
	const clip = new AnimationClip('Walk', 1, [
		new NumberKeyframeTrack('body.position[x]', [0, 1], [0, 1])
	])
	const statuses: AnimationPlaybackStatus[] = []
	let executor: AnimationLayerExecutor | null = null
	const view = render(
		<SceneAnimation
			model={model}
			animations={[clip]}
			options={{
				enabled: true,
				mode: 'simultaneous',
				autoplay,
				loopSequence: false,
				showControls: false,
				clips: describeAnimationClips([clip]).map((entry, order) => ({
					clipId: entry.clipId,
					sourceName: entry.name,
					sourceIndex: entry.index,
					enabled: true,
					order,
					loop: 'once',
					timeScale: 1,
					startOffset: 0
				}))
			}}
			onCommandExecutorReady={(ready) => {
				executor = ready
			}}
			onPlaybackStatusChange={(status) => statuses.push(status)}
		/>
	)
	const posed = () => statuses.at(-1)?.posed
	const execute = (command: Parameters<AnimationLayerExecutor['execute']>[0]) =>
		act(() => executor?.execute(command))
	return { posed, execute, view }
}

describe('the pose the animation status reports', () => {
	it('is the bind pose until a clip starts', () => {
		const { posed } = arrange(false)
		expect(posed()).toBe(false)
	})

	it('is posed while a clip plays, and stays posed once it is paused', () => {
		const { posed, execute } = arrange(false)

		execute({ type: 'set_animation_playing', playing: true })
		expect(posed()).toBe(true)

		execute({ type: 'set_animation_playing', playing: false })
		expect(posed()).toBe(true)
	})

	it('is posed from the start when the scene plays on load', () => {
		const { posed } = arrange(true)
		expect(posed()).toBe(true)
	})
})
