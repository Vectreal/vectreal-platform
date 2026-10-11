import { Button } from '@shared/components/ui/button'
import { Slider } from '@shared/components/ui/slider'
import { Toggle } from '@shared/components/ui/toggle'
import {
	ToggleGroup,
	ToggleGroupItem
} from '@shared/components/ui/toggle-group'
import { describeAnimationClips } from '@vctrl/core'
import { useAtom, useAtomValue } from 'jotai/react'
import {
	ArrowDown,
	ArrowUp,
	Check,
	Clapperboard,
	Infinity as InfinityIcon,
	MonitorPlay,
	Play,
	Repeat,
	RotateCcw
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import {
	ANIMATION_LOOP_LABELS,
	ANIMATION_REPETITIONS_FIELD,
	ANIMATION_SPEED_FIELD,
	animationStartOffsetField,
	DEFAULT_FINITE_REPETITIONS,
	formatClipSeconds
} from './constants'
import { useModelClips } from './use-animation-reconciliation'
import {
	isForeverCutShort,
	moveAnimationClip,
	resolveAnimationDraft,
	updateAnimationClip
} from '../../../../../lib/domain/scene/scene-animation-draft'
import {
	animationAtom,
	animationDriftAtom
} from '../../../../../lib/stores/scene-settings-store'
import { InlineNotice } from '../../../../layout-components'
import { usePublisherViewerCapture } from '../../../publisher-viewer-capture-context'
import { DrillDown, DrillDownTrigger, DrillDownView } from '../../drill-down'
import { FieldSlider } from '../../field-slider'
import { SettingGroup } from '../../sidebar-section'

import type {
	AnimationClipConfig,
	AnimationClipDescriptor,
	AnimationLoopMode,
	AnimationPlaybackMode,
	AnimationReconciliation,
	AnimationSettings
} from '@vctrl/core'
import type { ViewerCommand } from '@vctrl/viewer'

const COMMIT_DELAY_MS = 250

const clipViewId = (clipId: string) => `clip:${clipId}`

const clipLabel = (descriptor: AnimationClipDescriptor) =>
	descriptor.name || `Clip ${descriptor.index + 1}`

const pluralize = (count: number, noun: string) =>
	`${count} ${noun}${count === 1 ? '' : 's'}`

/** One sentence for the reconciliation report, or null when nothing changed. */
function describeDrift(
	drift: Pick<AnimationReconciliation, 'added' | 'dropped' | 'remapped'> | null
): string | null {
	if (!drift) return null
	const parts = [
		drift.remapped.length > 0 &&
			`${pluralize(drift.remapped.length, 'clip')} renamed`,
		drift.dropped.length > 0 &&
			`${pluralize(drift.dropped.length, 'clip')} no longer in the model`,
		drift.added.length > 0 && `${pluralize(drift.added.length, 'new clip')}`
	].filter(Boolean)
	if (parts.length === 0) return null

	return `The model's clips changed since this scene was saved (${parts.join(', ')}). The settings now follow the model's clips; check them and save.`
}

const AnimationSettingsPanel = () => {
	const clips = useModelClips()
	const [saved, setSaved] = useAtom(animationAtom)
	const drift = useAtomValue(animationDriftAtom)
	const { commandExecutor } = usePublisherViewerCapture()
	const [path, setPath] = useState<string[]>([])

	const descriptors = useMemo(() => describeAnimationClips(clips), [clips])
	const resolved = useMemo(
		() => resolveAnimationDraft(saved, clips).settings,
		[saved, clips]
	)

	// Local draft so a slider drag stays responsive without retuning the
	// mixer on every tick; committed shortly after the drag settles, like the
	// shadow panel's.
	const [draft, setDraft] = useState<AnimationSettings>(resolved)
	const commitTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
	const pendingCommit = useRef<AnimationSettings | null>(null)
	// What this panel last wrote, so a change it did not make can be told apart.
	const lastWritten = useRef(saved)

	const write = useCallback(
		(next: AnimationSettings) => {
			lastWritten.current = next
			setSaved(next)
		},
		[setSaved]
	)

	const cancelPendingCommit = useCallback(() => {
		if (commitTimer.current) clearTimeout(commitTimer.current)
		commitTimer.current = null
		pendingCommit.current = null
	}, [])

	useEffect(() => {
		setDraft(resolved)
	}, [resolved])

	// Something else wrote the atom mid-drag: another scene opened, or the
	// model's clips were reconciled. That config wins, and the pending commit,
	// built from the one before it, must not land on top of it.
	useEffect(() => {
		if (saved !== lastWritten.current) cancelPendingCommit()
	}, [saved, cancelPendingCommit])

	// Switching tools mid-drag unmounts the panel inside the commit delay;
	// the edit lands rather than vanishing.
	useEffect(
		() => () => {
			const pending = pendingCommit.current
			cancelPendingCommit()
			if (pending) write(pending)
		},
		[cancelPendingCommit, write]
	)

	const scheduleCommit = useCallback(
		(next: AnimationSettings) => {
			setDraft(next)
			cancelPendingCommit()
			pendingCommit.current = next
			commitTimer.current = setTimeout(() => {
				pendingCommit.current = null
				write(next)
			}, COMMIT_DELAY_MS)
		},
		[cancelPendingCommit, write]
	)

	const commitNow = useCallback(
		(next: AnimationSettings) => {
			cancelPendingCommit()
			setDraft(next)
			write(next)
		},
		[cancelPendingCommit, write]
	)

	const descriptorById = useMemo(
		() =>
			new Map(descriptors.map((descriptor) => [descriptor.clipId, descriptor])),
		[descriptors]
	)
	const isSequence = draft.mode === 'sequence'
	// The list follows playback order in a sequence and the file's own order
	// otherwise, where order means nothing.
	const listedClips = useMemo(
		() =>
			[...draft.clips].sort((a, b) =>
				isSequence ? a.order - b.order : a.sourceIndex - b.sourceIndex
			),
		[draft.clips, isSequence]
	)

	const updateClip = (
		clipId: string,
		patch: Partial<Omit<AnimationClipConfig, 'clipId'>>,
		commit: (next: AnimationSettings) => void = commitNow
	) => commit(updateAnimationClip(draft, clipId, patch))

	// Read from the ref when the author acts, not while rendering: the viewer
	// registers its executor after this panel may already have rendered.
	const executeCommand = useCallback(
		(command: ViewerCommand) => commandExecutor.current?.execute(command),
		[commandExecutor]
	)

	const driftMessage = describeDrift(drift)

	if (descriptors.length === 0) {
		return (
			<DrillDown path={path} onPathChange={setPath} rootTitle="Animation">
				<DrillDownView id="root">
					{driftMessage && (
						<InlineNotice tone="warning">{driftMessage}</InlineNotice>
					)}
					<InlineNotice tone="neutral">
						This model has no animation clips. Vectreal plays the animation that
						comes inside your model file and can&apos;t create animation of its
						own. Export your clips with the model from your 3D tool, then upload
						it again.
					</InlineNotice>
				</DrillDownView>
			</DrillDown>
		)
	}

	return (
		<DrillDown path={path} onPathChange={setPath} rootTitle="Animation">
			<DrillDownView id="root">
				{driftMessage && (
					<InlineNotice tone="warning">{driftMessage}</InlineNotice>
				)}

				<div className="grid grid-cols-3 gap-2">
					<Toggle
						layout="tile"
						label="Play animation"
						icon={<Clapperboard />}
						checked={draft.enabled}
						onCheckedChange={(enabled) => commitNow({ ...draft, enabled })}
					/>
					{draft.enabled && (
						<>
							<Toggle
								layout="tile"
								label="Autoplay"
								icon={<Play />}
								checked={draft.autoplay}
								onCheckedChange={(autoplay) =>
									commitNow({ ...draft, autoplay })
								}
							/>
							<Toggle
								layout="tile"
								label="Playback controls"
								icon={<MonitorPlay />}
								checked={draft.showControls}
								onCheckedChange={(showControls) =>
									commitNow({ ...draft, showControls })
								}
							/>
						</>
					)}
				</div>

				{draft.enabled ? (
					<>
						<SettingGroup
							label="Playback"
							description={
								isSequence
									? 'Included clips play one after another, in the order below.'
									: 'Every included clip plays at the same time.'
							}
						>
							<ToggleGroup
								type="single"
								aria-label="Playback mode"
								value={draft.mode}
								onValueChange={(mode) => {
									if (mode)
										commitNow({
											...draft,
											mode: mode as AnimationPlaybackMode
										})
								}}
							>
								<ToggleGroupItem value="simultaneous">Together</ToggleGroupItem>
								<ToggleGroupItem value="sequence">In order</ToggleGroupItem>
							</ToggleGroup>
						</SettingGroup>

						{isSequence && (
							<div className="grid grid-cols-3 gap-2">
								<Toggle
									layout="tile"
									label="Loop sequence"
									icon={<Repeat />}
									checked={draft.loopSequence}
									onCheckedChange={(loopSequence) =>
										commitNow({ ...draft, loopSequence })
									}
								/>
							</div>
						)}

						<SettingGroup label="Clips">
							<ul className="space-y-2">
								{listedClips.map((clip, position) => {
									const descriptor = descriptorById.get(clip.clipId)
									if (!descriptor) return null
									const label = clipLabel(descriptor)

									return (
										<li key={clip.clipId} className="flex items-center gap-1">
											<DrillDownTrigger
												to={clipViewId(clip.clipId)}
												label={label}
												className="min-w-0 flex-1"
												summary={
													clip.enabled
														? `${formatClipSeconds(descriptor.duration)} · ${clip.timeScale}x`
														: 'Off'
												}
											/>
											{isSequence && (
												<>
													<Button
														variant="ghost"
														size="icon"
														aria-label={`Move ${label} earlier`}
														disabled={position === 0}
														onClick={() =>
															commitNow(
																moveAnimationClip(draft, clip.clipId, -1)
															)
														}
													>
														<ArrowUp />
													</Button>
													<Button
														variant="ghost"
														size="icon"
														aria-label={`Move ${label} later`}
														disabled={position === listedClips.length - 1}
														onClick={() =>
															commitNow(
																moveAnimationClip(draft, clip.clipId, 1)
															)
														}
													>
														<ArrowDown />
													</Button>
												</>
											)}
										</li>
									)
								})}
							</ul>
						</SettingGroup>
					</>
				) : (
					<InlineNotice tone="neutral">
						This model has {pluralize(descriptors.length, 'animation clip')}.
						Turn on animation to choose which play and how.
					</InlineNotice>
				)}
			</DrillDownView>

			{listedClips.map((clip) => {
				const descriptor = descriptorById.get(clip.clipId)
				if (!descriptor) return null
				const isForever = clip.loop !== 'once' && clip.repetitions === undefined
				const canScrub = draft.enabled && clip.enabled

				return (
					<DrillDownView
						key={clip.clipId}
						id={clipViewId(clip.clipId)}
						title={clipLabel(descriptor)}
						caption={`${formatClipSeconds(descriptor.duration)} long.`}
					>
						<div className="grid grid-cols-3 gap-2">
							<Toggle
								layout="tile"
								label="Include"
								icon={<Check />}
								checked={clip.enabled}
								onCheckedChange={(enabled) =>
									updateClip(clip.clipId, { enabled })
								}
							/>
							{clip.loop !== 'once' && (
								<Toggle
									layout="tile"
									label="Forever"
									icon={<InfinityIcon />}
									checked={isForever}
									onCheckedChange={(forever) =>
										updateClip(clip.clipId, {
											repetitions: forever
												? undefined
												: DEFAULT_FINITE_REPETITIONS
										})
									}
								/>
							)}
						</div>

						<SettingGroup label="Loop">
							<ToggleGroup
								type="single"
								aria-label="Loop mode"
								value={clip.loop}
								onValueChange={(loop) => {
									if (!loop) return
									updateClip(clip.clipId, {
										loop: loop as AnimationLoopMode,
										// A count means nothing for a single pass, and the
										// normalizer drops it anyway.
										...(loop === 'once' ? { repetitions: undefined } : {})
									})
								}}
							>
								{(
									Object.entries(ANIMATION_LOOP_LABELS) as [
										AnimationLoopMode,
										string
									][]
								).map(([value, text]) => (
									<ToggleGroupItem key={value} value={value}>
										{text}
									</ToggleGroupItem>
								))}
							</ToggleGroup>
						</SettingGroup>

						{clip.loop !== 'once' && !isForever && (
							<FieldSlider
								field={ANIMATION_REPETITIONS_FIELD}
								value={clip.repetitions ?? DEFAULT_FINITE_REPETITIONS}
								onChange={(_key, repetitions) =>
									updateClip(clip.clipId, { repetitions }, scheduleCommit)
								}
							/>
						)}

						{isForeverCutShort(draft, clip.clipId, clips) && (
							<InlineNotice tone="neutral">
								A clip has to finish before the next one can start, so in this
								sequence it plays one pass each time through.
							</InlineNotice>
						)}

						<FieldSlider
							field={ANIMATION_SPEED_FIELD}
							value={clip.timeScale}
							onChange={(_key, timeScale) =>
								updateClip(clip.clipId, { timeScale }, scheduleCommit)
							}
						/>
						{descriptor.duration > 0 && (
							<FieldSlider
								field={animationStartOffsetField(descriptor.duration)}
								value={Math.min(clip.startOffset, descriptor.duration)}
								onChange={(_key, startOffset) =>
									updateClip(clip.clipId, { startOffset }, scheduleCommit)
								}
							/>
						)}

						{descriptor.duration > 0 && (
							<ClipScrubber
								clipId={clip.clipId}
								duration={descriptor.duration}
								disabled={!canScrub}
								execute={executeCommand}
							/>
						)}
					</DrillDownView>
				)
			})}
		</DrillDown>
	)
}

interface ClipScrubberProps {
	clipId: string
	duration: number
	disabled: boolean
	execute: (command: ViewerCommand) => void
}

/**
 * Previews one moment of a clip in the editor.
 *
 * Write-only: the viewer reports no clip time, and across several clips of
 * different lengths and speeds there is no single position to show. Scrubbing
 * pauses playback, so the pose stays where it was dragged; Play and Restart
 * give it back, since the scene's own controls may be switched off.
 * Never saved.
 */
function ClipScrubber({
	clipId,
	duration,
	disabled,
	execute
}: ClipScrubberProps) {
	const [position, setPosition] = useState(0)

	return (
		<SettingGroup
			label="Preview"
			description={
				disabled
					? 'Turn on animation and include this clip to preview it.'
					: 'Drag to hold the model at any moment of this clip. Not saved.'
			}
		>
			<Slider
				label="Position"
				min={0}
				max={duration}
				step={0.01}
				value={position}
				formatValue={formatClipSeconds}
				disabled={disabled}
				onValueChange={(time) => {
					setPosition(time)
					execute({ type: 'set_animation_playing', playing: false })
					execute({ type: 'seek_animation_clip', clipId, time })
				}}
			/>
			<div className="flex gap-2">
				<Button
					variant="secondary"
					size="sm"
					disabled={disabled}
					onClick={() =>
						execute({ type: 'set_animation_playing', playing: true })
					}
				>
					<Play />
					Play
				</Button>
				<Button
					variant="secondary"
					size="sm"
					disabled={disabled}
					onClick={() => execute({ type: 'restart_animation' })}
				>
					<RotateCcw />
					Restart
				</Button>
			</div>
		</SettingGroup>
	)
}

export default AnimationSettingsPanel
