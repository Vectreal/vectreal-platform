// @vitest-environment jsdom
/**
 * Whether an embedded scene carries the Vectreal mark.
 *
 * `embed-branding-policy.spec.ts` pins the rule that inverts the entitlement.
 * This pins the part that rule cannot: that the answer reaches the screen, and
 * that it does not ride on the author's info-popover setting. Folding the mark
 * into that popover is exactly how a free plan used to remove branding for
 * nothing, so the two are asserted against each other here.
 */
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import SceneEmbedPage from '../app/components/scene-embed/scene-embed-page'

import type { ServerSceneData } from '@vctrl/hooks/use-load-model'
import type { VectrealViewerProps } from '@vctrl/viewer'

const captured: VectrealViewerProps[] = []

vi.mock('../app/components/viewer/client-vectreal-viewer', () => ({
	ClientVectrealViewer: (props: VectrealViewerProps) => {
		captured.push(props)
		return <>{props.popover}</>
	}
}))

const sceneDataRef: { current: Partial<ServerSceneData> } = { current: {} }

vi.mock('../app/components/scene-embed/use-scene-embed-scene', () => ({
	useSceneEmbedScene: () => ({
		file: { model: {} },
		isLoadingScene: false,
		sceneData: sceneDataRef.current,
		loadError: null,
		retrySceneLoad: () => Promise.resolve()
	})
}))

vi.mock('../app/lib/domain/embed/hosted-preview-bridge', () => ({
	useHostedPreviewBridge: () => ({})
}))

vi.mock('react-router', () => ({
	useSearchParams: () => [new URLSearchParams(), () => undefined]
}))

function renderEmbed(options: {
	branding: boolean
	showInfoPopover?: boolean
}) {
	captured.length = 0
	sceneDataRef.current =
		options.showInfoPopover === undefined
			? {}
			: { presentation: { showInfoPopover: options.showInfoPopover } }

	render(
		<SceneEmbedPage
			projectId="p"
			sceneId="s"
			showsVectrealBranding={options.branding}
		/>
	)

	return {
		mark: screen.queryByRole('link', { name: /vectreal/i }),
		infoButton: screen.queryByLabelText('Open information popover')
	}
}

beforeEach(() => {
	captured.length = 0
})

describe('the Vectreal mark on an embedded scene', () => {
	it('is drawn for a plan that has not bought its removal', () => {
		expect(renderEmbed({ branding: true }).mark).not.toBeNull()
	})

	it('is gone once the plan grants removal', () => {
		expect(renderEmbed({ branding: false }).mark).toBeNull()
	})

	it('stays when the author switches the info popover off', () => {
		// The hole this design closes: while the mark lived inside the popover,
		// this combination removed Vectreal branding on a free plan.
		const { mark, infoButton } = renderEmbed({
			branding: true,
			showInfoPopover: false
		})

		expect(infoButton).toBeNull()
		expect(mark).not.toBeNull()
	})

	it('is absent on a paid plan whether or not the popover is shown', () => {
		expect(
			renderEmbed({ branding: false, showInfoPopover: true }).mark
		).toBeNull()
		expect(
			renderEmbed({ branding: false, showInfoPopover: false }).mark
		).toBeNull()
	})
})
