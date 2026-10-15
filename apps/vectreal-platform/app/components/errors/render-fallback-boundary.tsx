import { Component } from 'react'

import type { ReactNode } from 'react'

/**
 * Keeps a failed 3D preview from taking the page with it.
 *
 * The viewer has no WebGL capability check anywhere, so on a device without it
 * - or with hardware acceleration switched off - R3F's `<Canvas>` throws during
 * render. Nothing stood between that and the route, so the entire docs index
 * was replaced by an error screen because a decoration could not draw. A failed
 * chunk fetch did the same.
 *
 * Rendering `fallback` is right where the 3D is not the page's content: the
 * frame around it keeps its shape, and the reader loses a picture rather than
 * the page they came for. A route boundary cannot do this job - by the time it
 * runs, the route is already gone.
 */
export class RenderFallbackBoundary extends Component<
	{ children: ReactNode; fallback: ReactNode },
	{ failed: boolean }
> {
	state = { failed: false }

	static getDerivedStateFromError() {
		return { failed: true }
	}

	render() {
		return this.state.failed ? this.props.fallback : this.props.children
	}
}
