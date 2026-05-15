import { Separator } from '@shared/components/ui/separator'

import { CameraControlsSettings } from '../camera-controls-settings'
import { InteractionControlsSettings } from '../interaction-controls-settings'

/**
 * Combined camera and interaction controls tool panel.
 *
 * Merges the former separate "Camera" and "Interaction" tools into a single
 * panel so related settings live together. The camera section handles saved
 * camera definitions, field of view, and transitions; the interaction section
 * handles orbit, zoom, and movement behaviour.
 */
export default function CameraToolsSettings() {
	return (
		<div className="space-y-3">
			<CameraControlsSettings />
			<Separator className="my-2 opacity-40" />
			<InteractionControlsSettings />
		</div>
	)
}
