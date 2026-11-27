import { Button } from '@shared/components/ui/button'
import { Slider } from '@shared/components/ui/slider'
import { Toggle } from '@shared/components/ui/toggle'
import { useAtomValue } from 'jotai/react'
import { CopyCheck } from 'lucide-react'
import { toast } from 'sonner'

import { ZOOM_FACTOR_MAX } from '../../../../../lib/domain/scene/camera-limits'
import { canEditCameraSettingsAtom } from '../../../../../lib/stores/publisher-config-store'
import { SettingGroup } from '../../sidebar-section'

import type { SceneCameras } from './use-scene-cameras'

/** The default the orbit sliders start at when an orbit limit is first set. */
const ORBIT_START = 45

const formatFactor = (value: number) =>
	value >= ZOOM_FACTOR_MAX ? 'No limit' : `${value}×`
const factorOf = (value: number) =>
	value >= ZOOM_FACTOR_MAX ? undefined : value
const formatDegrees = (value: number) => `${Math.round(value)}°`

/**
 * How far a visitor can move away from the selected camera's view: zoom, pan,
 * and the angles they can look from. Applies to visitors and in Preview; the
 * editor always moves freely.
 */
export function CameraLimitsView({ cameras }: { cameras: SceneCameras }) {
	const isLocked = !useAtomValue(canEditCameraSettingsAtom)
	const { limits, setLimits } = cameras
	if (!limits) return null

	const zoomOn = limits.zoom?.enabled !== false
	const lowest = limits.tilt?.lowest ?? -90
	const highest = limits.tilt?.highest ?? 90

	return (
		<>
			<Toggle
				label="Zoom"
				description="Visitors can zoom in and out from this view."
				checked={zoomOn}
				disabled={isLocked}
				onCheckedChange={(enabled) =>
					setLimits({ ...limits, zoom: { ...limits.zoom, enabled } })
				}
			/>
			{zoomOn && (
				<div className="space-y-2">
					<Slider
						label="Closer"
						min={1}
						max={ZOOM_FACTOR_MAX}
						step={0.5}
						formatValue={formatFactor}
						disabled={isLocked}
						value={limits.zoom?.closer ?? ZOOM_FACTOR_MAX}
						onValueChange={(value) =>
							setLimits({
								...limits,
								zoom: { ...limits.zoom, closer: factorOf(value) }
							})
						}
					/>
					<Slider
						label="Farther"
						min={1}
						max={ZOOM_FACTOR_MAX}
						step={0.5}
						formatValue={formatFactor}
						disabled={isLocked}
						value={limits.zoom?.farther ?? ZOOM_FACTOR_MAX}
						onValueChange={(value) =>
							setLimits({
								...limits,
								zoom: { ...limits.zoom, farther: factorOf(value) }
							})
						}
					/>
				</div>
			)}

			<Toggle
				label="Pan"
				description="Visitors can move the point they turn around. It stays inside the model."
				checked={limits.pan !== false}
				disabled={isLocked}
				onCheckedChange={(pan) => setLimits({ ...limits, pan })}
			/>

			<SettingGroup
				label="Angle"
				description="0° is level, 90° looks straight down. The range always takes in this camera's own view."
			>
				<div className="space-y-2">
					<Slider
						label="Lowest angle"
						min={-90}
						max={90}
						step={1}
						formatValue={formatDegrees}
						disabled={isLocked}
						value={lowest}
						onValueChange={(value) =>
							setLimits({
								...limits,
								tilt: { lowest: Math.min(value, highest), highest }
							})
						}
					/>
					<Slider
						label="Highest angle"
						min={-90}
						max={90}
						step={1}
						formatValue={formatDegrees}
						disabled={isLocked}
						value={highest}
						onValueChange={(value) =>
							setLimits({
								...limits,
								tilt: { lowest, highest: Math.max(value, lowest) }
							})
						}
					/>
				</div>
			</SettingGroup>

			<Toggle
				label="All the way round"
				description={
					limits.orbit
						? 'Off: visitors turn only as far as set below. Auto rotate stays off for this camera.'
						: 'Visitors can turn all the way around the model.'
				}
				checked={!limits.orbit}
				disabled={isLocked}
				onCheckedChange={(allRound) => {
					const { orbit: _orbit, ...rest } = limits
					setLimits(
						allRound
							? rest
							: { ...rest, orbit: { left: ORBIT_START, right: ORBIT_START } }
					)
				}}
			/>
			{limits.orbit && (
				<div className="space-y-2">
					<Slider
						label="Left"
						min={0}
						max={180}
						step={1}
						formatValue={formatDegrees}
						disabled={isLocked}
						value={limits.orbit.left}
						onValueChange={(left) =>
							limits.orbit &&
							setLimits({ ...limits, orbit: { ...limits.orbit, left } })
						}
					/>
					<Slider
						label="Right"
						min={0}
						max={180}
						step={1}
						formatValue={formatDegrees}
						disabled={isLocked}
						value={limits.orbit.right}
						onValueChange={(right) =>
							limits.orbit &&
							setLimits({ ...limits, orbit: { ...limits.orbit, right } })
						}
					/>
				</div>
			)}

			<Button
				variant="secondary"
				className="w-full"
				disabled={isLocked}
				onClick={() => {
					cameras.applyLimitsToAll()
					toast.success('Every camera now has these limits.')
				}}
			>
				<CopyCheck className="size-4" />
				Apply to all cameras
			</Button>
		</>
	)
}
