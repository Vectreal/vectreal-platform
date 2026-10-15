import { Component, type ReactNode } from 'react'

interface LoadFailureBoundaryProps {
	children: ReactNode
	/** Called once when a child fails to load. */
	onError: (error: unknown) => void
	/**
	 * Drawn in place of the children from the render that caught the failure,
	 * not a commit later. Nothing by default.
	 */
	fallback?: ReactNode
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
		return this.state.failed
			? (this.props.fallback ?? null)
			: this.props.children
	}
}

export default LoadFailureBoundary
