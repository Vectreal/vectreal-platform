import {
	LIGHTING_SETUPS,
	type EnvironmentKey,
	type LightingSettings,
	type LightingSetupId
} from '@vctrl/core'
import { useCallback, useEffect, useState } from 'react'
import { Group, Mesh, MeshStandardMaterial, SphereGeometry } from 'three'

import VectrealViewer from './vectreal-viewer'

import type { ViewerInteractionEvent } from './types/viewer-interactions'
import type { ShadowBakeCapture } from './types/viewer-types'
import type { Meta, StoryObj } from '@storybook/react-vite'

/**
 * The lighting references the Lighting tool shows as thumbnails, rendered
 * through the viewer itself so they match what it draws, tone mapping
 * included. `apps/vectreal-platform/scripts/render-lighting-thumbnails.ts`
 * screenshots this story once per setup and per environment map.
 *
 * A setup reads the way an HDR is read on set: a chrome ball shows the
 * environment and where its lights sit, a matte grey ball on the ground shows
 * the key's direction, softness and the shadow it casts. A map shows the
 * chrome ball alone.
 */
const meta = {
	title: 'Viewer/Lighting reference',
	parameters: {
		layout: 'fullscreen',
		// One frame, captured as it is: no theme pair around it.
		dualTheme: false,
		chromatic: { disableSnapshot: true }
	}
} satisfies Meta

export default meta

const chrome = () =>
	new Mesh(
		new SphereGeometry(0.5, 128, 64),
		new MeshStandardMaterial({
			color: '#ffffff',
			metalness: 1,
			roughness: 0.03
		})
	)

const setupModel = () => {
	const model = new Group()
	const ball = chrome()
	ball.position.set(-0.56, 0.5, 0)
	const matte = new Mesh(
		new SphereGeometry(0.5, 128, 64),
		new MeshStandardMaterial({ color: '#8e8e93', roughness: 0.92 })
	)
	matte.position.set(0.56, 0.5, 0)
	model.add(ball, matte)
	return model
}

const environmentModel = () => {
	const model = new Group()
	const ball = chrome()
	ball.position.set(0, 0.5, 0)
	model.add(ball)
	return model
}

interface ReferenceProps {
	lighting: LightingSettings
	model: Group
	/** Waits for the ground's bake as well as the first frame. */
	waitsForBake: boolean
	position: [number, number, number]
	target: [number, number, number]
}

/** How often a settling bake is asked whether it is done. */
const BAKE_POLL_MS = 200

/**
 * Marks the page `data-reference-ready` once the frame is final: the viewer
 * framed, and, when there is a ground, its bake settled. The capture script
 * waits for it. A ground bake accumulates over many frames after the viewer
 * reports ready, and its capture function answers null until it has, so it
 * is asked until it answers.
 */
const Reference = ({
	lighting,
	model,
	waitsForBake,
	position,
	target
}: ReferenceProps) => {
	const [framed, setFramed] = useState(false)
	const [capture, setCapture] = useState<ShadowBakeCapture | null>(null)

	// A new frame is not ready until it says so.
	useEffect(() => {
		delete document.body.dataset.referenceReady
	}, [])

	useEffect(() => {
		if (!framed) return
		if (!waitsForBake) {
			document.body.dataset.referenceReady = 'true'
			return
		}
		if (!capture) return
		let cancelled = false
		const ask = async () => {
			if (cancelled) return
			if (await capture()) {
				// Settling calibrates the shadow and asks for a frame; the
				// calibrated frame is drawn on the next one.
				requestAnimationFrame(() =>
					requestAnimationFrame(() => {
						if (!cancelled) document.body.dataset.referenceReady = 'true'
					})
				)
				return
			}
			setTimeout(ask, BAKE_POLL_MS)
		}
		ask().catch((error: unknown) => {
			// The capture script fails on this instead of timing out.
			document.body.dataset.referenceError = String(error)
		})
		return () => {
			cancelled = true
		}
	}, [framed, waitsForBake, capture])

	// Stable, so the viewer keeps one registration for the frame's life.
	const onInteractionEvent = useCallback((event: ViewerInteractionEvent) => {
		if (event.type === 'viewer_ready') setFramed(true)
	}, [])
	const onShadowBakeReady = useCallback(
		(next: ShadowBakeCapture | null) => setCapture(() => next),
		[]
	)

	return (
		<div style={{ width: 320, height: 320 }}>
			<VectrealViewer
				model={model}
				lighting={{ ...lighting, background: { type: 'none' } }}
				cameraOptions={{
					activeCameraId: 'reference',
					cameras: [
						{ cameraId: 'reference', name: 'Reference', position, target }
					]
				}}
				controlsOptions={{ enabled: false }}
				onInteractionEvent={onInteractionEvent}
				onShadowBakeReady={waitsForBake ? onShadowBakeReady : undefined}
			/>
		</div>
	)
}

export const Setup: StoryObj<{ setup: LightingSetupId }> = {
	argTypes: {
		setup: {
			control: 'select',
			options: LIGHTING_SETUPS.map(({ id }) => id)
		}
	},
	args: { setup: 'soft-studio' },
	render: ({ setup }) => {
		const { lighting } = LIGHTING_SETUPS.find(({ id }) => id === setup)!
		return (
			<Reference
				key={setup}
				lighting={lighting}
				model={setupModel()}
				waitsForBake={Boolean(lighting.ground?.enabled)}
				position={[0, 0.75, 2.05]}
				target={[0, 0.5, 0]}
			/>
		)
	}
}

export const Environment: StoryObj<{ map: EnvironmentKey }> = {
	args: { map: 'studio-soft' },
	render: ({ map }) => (
		<Reference
			key={map}
			lighting={{ environment: { map } }}
			model={environmentModel()}
			waitsForBake={false}
			position={[0, 0.5, 1.15]}
			target={[0, 0.5, 0]}
		/>
	)
}
