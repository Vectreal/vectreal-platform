import { useLoadModel } from '@vctrl/hooks'
import { VectrealViewer } from '@vctrl/viewer'
import { Component, useEffect, type ReactNode } from 'react'

// Reusable error boundary: a render-time crash would otherwise be swallowed by
// React. We mirror it onto a window flag the e2e polls, and swap in a marker node.
class CrashBoundary extends Component<
	{ children: ReactNode; testid: string; onCrash: (message: string) => void },
	{ crashed: boolean }
> {
	state = { crashed: false }

	static getDerivedStateFromError() {
		return { crashed: true }
	}

	componentDidCatch(error: Error) {
		this.props.onCrash(error.message)
	}

	render() {
		if (this.state.crashed) {
			return <div data-testid={this.props.testid}>crashed</div>
		}
		return this.props.children
	}
}

// Exercises the @vctrl/hooks -> @vctrl/core externalized dependency graph at
// runtime. @vctrl/core is no longer bundled into hooks, so it must resolve as a
// real installed dependency. useLoadModel instantiates core's ModelLoader
// internally; calling it with no model just initializes idle loader state.
// Reaching the effect proves the published hooks + its core dependency resolved.
function HooksProbe() {
	useLoadModel()
	useEffect(() => {
		window.__HOOKS_E2E__ = { status: 'ok' }
	}, [])
	return null
}

export default function App() {
	return (
		<div data-testid="viewer-host" style={{ height: '100vh', width: '100vw' }}>
			<CrashBoundary
				testid="hooks-crashed"
				onCrash={(message) => {
					window.__HOOKS_E2E__ = { status: 'crashed', error: message }
				}}
			>
				<HooksProbe />
			</CrashBoundary>
			<CrashBoundary
				testid="viewer-crashed"
				onCrash={(message) => {
					window.__VIEWER_E2E__ = { status: 'crashed', error: message }
				}}
			>
				<VectrealViewer
					theme="dark"
					controlsOptions={{ autoRotate: false }}
					onCommandExecutorReady={() => {
						// Viewer scene graph is live and the imperative API is wired up.
						window.__VIEWER_E2E__ = { status: 'mounted' }
					}}
				>
					<ambientLight intensity={0.8} />
					<directionalLight position={[3, 4, 2]} intensity={1.4} />
					<mesh>
						<boxGeometry args={[1.2, 1.2, 1.2]} />
						<meshStandardMaterial color="#60a5fa" />
					</mesh>
				</VectrealViewer>
			</CrashBoundary>
		</div>
	)
}
