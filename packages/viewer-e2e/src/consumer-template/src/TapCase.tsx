import { VectrealViewer } from '@vctrl/viewer'

/*
  A scene in a page that scrolls: the viewer takes the top 60% of a page two
  screens tall, so a wheel over it either scrolls the page or zooms. `?tap-case`
  waits for a tap and `?tap-case=immediate` does not; `&spin` turns it.
*/
export function TapCase({
	interactionStart,
	spin
}: {
	interactionStart: 'immediate' | 'tap'
	spin: boolean
}) {
	return (
		<div style={{ height: '200vh', width: '100vw' }}>
			<div style={{ height: '60vh', width: '100vw' }}>
				<VectrealViewer
					interactionStart={interactionStart}
					locale="en"
					controlsOptions={{ autoRotate: spin, autoRotateSpeed: 8 }}
					onViewChange={(view) => {
						window.__VIEW_AZIMUTH__ = view.azimuth
					}}
					onInteractionEvent={(event) => {
						if (event.type === 'viewer_ready') window.__VIEWER_READY__ = true
					}}
				>
					<ambientLight />
					<mesh>
						<boxGeometry args={[1, 1, 1]} />
						<meshStandardMaterial color="#60a5fa" />
					</mesh>
				</VectrealViewer>
			</div>
		</div>
	)
}
