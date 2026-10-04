import { Component, type ReactNode } from 'react'

interface LoadFailureBoundaryProps {
	children: ReactNode
	/** Called once when a child fails to load; the boundary then renders nothing. */
	onError: (error: unknown) => void
}

/**
 * Contains the failure of an optional asset loaded inside the canvas.
 *
 * A loader that throws (a 404, an expired URL) otherwise escapes the canvas
 * and replaces the whole scene with the page's error boundary, though only
 * an extra was missing.
 */
class LoadFailureBoundary extends Component<
	LoadFailureBoundaryProps,
	{ failed: boolean }
> {
	state = { failed: false }

	static getDerivedStateFromError() {
		return { failed: true }
	}

	componentDidCatch(error: unknown) {
		this.props.onError(error)
	}

	render() {
		return this.state.failed ? null : this.props.children
	}
}

export default LoadFailureBoundary
