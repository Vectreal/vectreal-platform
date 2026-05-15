import { Badge } from '@shared/components/ui/badge'
import { Button } from '@shared/components/ui/button'
import { Separator } from '@shared/components/ui/separator'
import { useAtom } from 'jotai/react'
import { BoxSelect, Plus, Trash2 } from 'lucide-react'
import { memo, useCallback } from 'react'

import { placeablesAtom } from '../../../../../lib/stores/scene-settings-store'
import { InfoTooltip } from '../../../../info-tooltip'

import type { PlaceableRef } from '@vctrl/core'

// ---------------------------------------------------------------------------
// Static catalog of built-in placeables.
// Add new entries here as catalog IDs are introduced.
// ---------------------------------------------------------------------------
interface CatalogEntry {
	id: string
	name: string
	description: string
}

const PLACEABLES_CATALOG: CatalogEntry[] = [
	{
		id: 'ground-plane',
		name: 'Ground Plane',
		description: 'A flat reflective ground surface.'
	},
	{
		id: 'waterdrop-backdrop',
		name: 'Waterdrop Backdrop',
		description: 'Curved matte backdrop for product shots.'
	}
]

function createPlaceableId(): string {
	return `placeable-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

const AssetsSettingsPanel = memo(() => {
	const [placeables, setPlaceables] = useAtom(placeablesAtom)

	const handleAdd = useCallback(
		(entry: CatalogEntry) => {
			const newRef: PlaceableRef = {
				id: createPlaceableId(),
				catalogId: entry.id,
				name: entry.name
			}
			setPlaceables((prev) => [...prev, newRef])
		},
		[setPlaceables]
	)

	const handleRemove = useCallback(
		(id: string) => {
			setPlaceables((prev) => prev.filter((p) => p.id !== id))
		},
		[setPlaceables]
	)

	return (
		<div className="space-y-6">
			{/* Built-in Catalog */}
			<div className="space-y-3">
				<div className="flex items-center gap-2">
					<p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
						Built-in Objects
					</p>
					<InfoTooltip content="Insert built-in scene objects. Added instances are listed under Scene Instances below." />
				</div>
				<Separator />

				<div className="space-y-2">
					{PLACEABLES_CATALOG.map((entry) => (
						<div
							key={entry.id}
							className="flex items-center gap-2 rounded-md border p-2"
						>
							<BoxSelect className="text-muted-foreground h-4 w-4 shrink-0" />
							<div className="min-w-0 flex-1">
								<p className="text-sm leading-tight">{entry.name}</p>
								<p className="text-muted-foreground truncate text-xs">
									{entry.description}
								</p>
							</div>
							<Button
								variant="outline"
								size="icon"
								className="h-6 w-6 shrink-0"
								title={`Add ${entry.name}`}
								onClick={() => handleAdd(entry)}
							>
								<Plus className="h-3.5 w-3.5" />
							</Button>
						</div>
					))}
				</div>
			</div>

			{/* Scene Instances */}
			<div className="space-y-3">
				<div className="flex items-center gap-2">
					<p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
						Scene Instances
					</p>
					<InfoTooltip content="Placed objects in this scene. Remove them by clicking the trash icon." />
				</div>
				<Separator />

				{placeables.length === 0 ? (
					<p className="text-muted-foreground py-4 text-center text-xs">
						No objects placed yet.
					</p>
				) : (
					<div className="space-y-1">
						{placeables.map((ref) => {
							const catalogEntry = PLACEABLES_CATALOG.find(
								(c) => c.id === ref.catalogId
							)
							return (
								<div
									key={ref.id}
									className="flex items-center gap-2 rounded-md px-2 py-1.5"
								>
									<div className="min-w-0 flex-1">
										<p className="truncate text-sm leading-tight">
											{ref.name ?? catalogEntry?.name ?? ref.catalogId}
										</p>
										<Badge variant="secondary" className="text-xs">
											{ref.catalogId}
										</Badge>
									</div>
									<Button
										variant="ghost"
										size="icon"
										className="h-6 w-6 shrink-0"
										title="Remove"
										onClick={() => handleRemove(ref.id)}
									>
										<Trash2 className="h-3.5 w-3.5" />
									</Button>
								</div>
							)
						})}
					</div>
				)}
			</div>

			{/* Note */}
			<p className="text-muted-foreground text-xs">
				Texture and material asset inventory will be available in a future
				update.
			</p>
		</div>
	)
})

AssetsSettingsPanel.displayName = 'AssetsSettingsPanel'

export default AssetsSettingsPanel
