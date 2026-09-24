import { Component, type ReactNode } from 'react'

/**
 * Keeps a failed stage part from taking the page with it: no WebGL, a chunk
 * that will not load, a model that will not parse. Whatever sits under it is
 * already complete without it, so failing to nothing is the fallback.
 */
export class StageBoundary extends Component<
	{ children: ReactNode; onError?: () => void },
	{ failed: boolean }
> {
	state = { failed: false }

	static getDerivedStateFromError() {
		return { failed: true }
	}

	componentDidCatch() {
		this.props.onError?.()
	}

	render() {
		return this.state.failed ? null : this.props.children
	}
}
