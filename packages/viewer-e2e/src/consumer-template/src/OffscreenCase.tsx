import { VectrealViewer } from '@vctrl/viewer'

/*
  A viewer at the top of a page four screens tall, on a white page, so
  scrolling to the bottom takes it out of view and back. `?offscreen-case`
  unloads off-screen and `?offscreen-case=pause` keeps the scene loaded.
*/
export function OffscreenCase({ unload }: { unload: boolean }) {
	return (
		<div style={{ height: '400vh', width: '100vw', background: '#ffffff' }}>
			<div style={{ height: '60vh', width: '100vw' }}>
				<VectrealViewer
					unloadWhenOffscreen={unload}
					onInteractionEvent={(event) => {
						if (event.type === 'viewer_ready') window.__VIEWER_READY__ = true
					}}
				>
					<mesh scale={2.5}>
						<boxGeometry args={[1, 1, 1]} />
						<meshBasicMaterial color="#1d4ed8" />
					</mesh>
				</VectrealViewer>
			</div>
		</div>
	)
}
