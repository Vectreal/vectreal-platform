import { useAtom, useAtomValue, useSetAtom } from 'jotai/react'
import { memo, useCallback, useEffect, useState } from 'react'

import { hotspotViewId, REORDER_HINT_ID } from './hotspot-row'
import { MarkerList } from './marker-list'
import {
	MarkerAppearance,
	MarkerContent,
	MarkerOverview,
	MarkerPosition
} from './marker-views'
import { hotspotDisplayName } from './use-hotspot-edits'
import { isClickToPlaceActiveAtom } from '../../../../../lib/stores/publisher-config-store'
import {
	activeHotspotIdAtom,
	hotspotsAtom
} from '../../../../../lib/stores/scene-settings-store'
import { DrillDown, DrillDownView } from '../../drill-down'
import { useSidebarCoversCanvas } from '../../dynamic-sidebar'
import { useAnnouncer } from '../reorder-list'

/*
  The first level of the drill-down is not this panel's state: it is
  `activeHotspotIdAtom`, which a click on a marker in the scene also writes,
  so selecting from the canvas opens the marker here. Only the levels below
  it (content, appearance, position) are local, and any change of selection
  clears them, from wherever it came, so a marker always opens at its top.
*/
function useHotspotPath() {
	const [selectedId, setSelectedId] = useAtom(activeHotspotIdAtom)
	const [subPath, setSubPath] = useState<string[]>([])
	const [subPathOwner, setSubPathOwner] = useState(selectedId)
	if (subPathOwner !== selectedId) {
		setSubPathOwner(selectedId)
		setSubPath([])
	}

	const onPathChange = useCallback(
		(next: string[]) => {
			if (next.length === 0) {
				setSelectedId(null)
				return
			}
			setSubPath(next.slice(1))
		},
		[setSelectedId]
	)

	return {
		path: selectedId ? [hotspotViewId(selectedId), ...subPath] : [],
		onPathChange
	}
}

/**
 * Click-to-place and the selection are canvas state this panel takes, so it
 * hands both back: placement when the marker it was aimed at is deselected,
 * and both when the panel goes.
 *
 * The cleanup is the load-bearing half. Switching compose tools unmounts the
 * panel without deselecting anything, and the atoms outlive it, so the canvas
 * stayed armed, and kept a transform gizmo on the model, under a tool that
 * shows neither.
 */
function useReleaseCanvasState(selectedId: string | null) {
	const setIsClickToPlaceActive = useSetAtom(isClickToPlaceActiveAtom)
	const setSelectedId = useSetAtom(activeHotspotIdAtom)

	useEffect(() => {
		if (!selectedId) {
			setIsClickToPlaceActive(false)
		}
	}, [selectedId, setIsClickToPlaceActive])

	useEffect(
		() => () => {
			setIsClickToPlaceActive(false)
			setSelectedId(null)
		},
		[setIsClickToPlaceActive, setSelectedId]
	)
}

const HotspotsSettingsPanel = memo(() => {
	const hotspots = useAtomValue(hotspotsAtom)
	const selectedId = useAtomValue(activeHotspotIdAtom)
	const selectedHotspot = hotspots.find((hotspot) => hotspot.id === selectedId)
	const { path, onPathChange } = useHotspotPath()
	const { announce, regions } = useAnnouncer()
	const coversCanvas = useSidebarCoversCanvas()
	useReleaseCanvasState(selectedId)

	return (
		<div className="space-y-4">
			{/*
			  Outside the drill-down, so an announcement made from one view (a
			  delete in the list) is not unmounted with it.
			*/}
			{regions}
			<p id={REORDER_HINT_ID} className="sr-only">
				Use the up and down arrow keys to move a marker through the sequence, or
				Home and End to send it to either end.
			</p>

			<DrillDown path={path} onPathChange={onPathChange} rootTitle="Hotspots">
				<DrillDownView id="root">
					<MarkerList announce={announce} />
				</DrillDownView>

				{selectedHotspot && (
					<DrillDownView
						id={hotspotViewId(selectedHotspot.id)}
						title={hotspotDisplayName(selectedHotspot)}
					>
						<MarkerOverview hotspot={selectedHotspot} />
					</DrillDownView>
				)}
				{selectedHotspot && (
					<DrillDownView
						id="content"
						title="Content"
						caption="What a visitor sees when they open the marker."
					>
						<MarkerContent hotspot={selectedHotspot} />
					</DrillDownView>
				)}
				{selectedHotspot && (
					<DrillDownView
						id="appearance"
						title="Appearance"
						caption="A dot, or an image or SVG you upload."
					>
						<MarkerAppearance hotspot={selectedHotspot} />
					</DrillDownView>
				)}
				{selectedHotspot && (
					<DrillDownView
						id="position"
						title="Position"
						caption={
							coversCanvas
								? 'World coordinates of the marker.'
								: 'World coordinates. Dragging the marker in the scene, or Place on model, sets these for you.'
						}
					>
						<MarkerPosition hotspot={selectedHotspot} />
					</DrillDownView>
				)}
			</DrillDown>
		</div>
	)
})

HotspotsSettingsPanel.displayName = 'HotspotsSettingsPanel'

export default HotspotsSettingsPanel
