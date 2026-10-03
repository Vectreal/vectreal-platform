import { Button } from '@shared/components/ui/button'
import { cn, formatFileSize } from '@shared/utils'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useAtomValue, useSetAtom } from 'jotai/react'
import {
	Box,
	Check,
	ChevronDown,
	CircleAlert,
	CloudCheck,
	File as FileIcon,
	History,
	Image as ImageIcon,
	RotateCw,
	SlidersHorizontal,
	X
} from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'

import { ProgressRing } from './progress-ring'
import { summarizeSaveProgress } from '../../../lib/domain/scene/client/scene-save-progress'
import {
	isPreviewModeAtom,
	sceneMetaAtom
} from '../../../lib/stores/publisher-config-store'
import {
	dismissSavePanelAtom,
	savePanelAtom
} from '../../../lib/stores/save-progress-store'

import type {
	SaveFileGroup,
	SaveGroupSummary,
	SavePanelFile,
	SavePanelState
} from '../../../lib/domain/scene/client/scene-save-progress'
import type { FC, FocusEvent, ReactNode } from 'react'

/** How long a finished save stays on screen while the panel is collapsed. */
const HIDE_AFTER_SAVED_MS = 4000

/** `--ease-out` over `--duration-base`, which Framer cannot read as tokens. */
const STATE_CHANGE = { duration: 0.25, ease: [0.16, 1, 0.3, 1] as const }

/**
 * Every change in the panel is a change of state, so every one moves, and
 * none moves with reduced motion.
 */
const useStateChange = () =>
	useReducedMotion() ? { duration: 0 } : STATE_CHANGE

const GROUP_META: Record<SaveFileGroup, { label: string; icon: ReactNode }> = {
	model: { label: 'Model', icon: <Box /> },
	original: { label: 'Original', icon: <History /> },
	preview: { label: 'Preview', icon: <ImageIcon /> }
}

const isFinished = (status: SavePanelState['status']) =>
	status === 'saved' || status === 'unchanged'

/** Opens and closes by height, so the panel grows rather than jumps. */
const Reveal: FC<{
	show: boolean
	id?: string
	className?: string
	children: ReactNode
}> = ({ show, id, className, children }) => {
	const transition = useStateChange()
	return (
		<AnimatePresence initial={false}>
			{show && (
				<motion.div
					key="reveal"
					id={id}
					initial={{ height: 0, opacity: 0 }}
					animate={{ height: 'auto', opacity: 1 }}
					exit={{ height: 0, opacity: 0 }}
					transition={transition}
					className={cn('overflow-hidden', className)}
				>
					{children}
				</motion.div>
			)}
		</AnimatePresence>
	)
}

/**
 * Turns one mark into the next in place: the ring settles into a check
 * rather than being swapped for one. Both sit in one grid cell while they
 * cross, so nothing around them moves.
 */
const MarkSwap: FC<{
	mark: string
	className?: string
	children: ReactNode
}> = ({ mark, className, children }) => {
	const transition = useStateChange()
	return (
		<span className={cn('grid shrink-0 place-items-center', className)}>
			<AnimatePresence initial={false}>
				<motion.span
					key={mark}
					initial={{ opacity: 0, scale: 0.6 }}
					animate={{ opacity: 1, scale: 1 }}
					exit={{ opacity: 0, scale: 0.6 }}
					transition={transition}
					className="col-start-1 row-start-1 grid place-items-center"
				>
					{children}
				</motion.span>
			</AnimatePresence>
		</span>
	)
}

const DoneMark = () => (
	<Check
		aria-hidden
		className="size-4 text-emerald-500 dark:text-emerald-400"
	/>
)

const FailedMark = () => (
	<CircleAlert aria-hidden className="text-destructive size-4" />
)

/** The mark at the end of a row: a ring while it moves, then how it ended. */
const StateMark: FC<{
	state: SaveGroupSummary['state'] | SavePanelFile['state']
	percent: number
}> = ({ state, percent }) => {
	const mark =
		state === 'done' || state === 'reused' || state === 'failed'
			? state
			: 'progress'
	return (
		<MarkSwap mark={mark} className="size-4">
			{mark === 'done' ? (
				<DoneMark />
			) : mark === 'reused' ? (
				<CloudCheck aria-hidden className="text-muted-foreground size-4" />
			) : mark === 'failed' ? (
				<FailedMark />
			) : (
				<ProgressRing
					value={percent}
					className={cn(
						'size-4',
						state === 'waiting' ? 'text-muted-foreground' : 'text-orange'
					)}
				/>
			)}
		</MarkSwap>
	)
}

const percentOf = (sent: number, bytes: number) =>
	bytes > 0 ? (sent / bytes) * 100 : 0

const FileRow: FC<{ file: SavePanelFile }> = ({ file }) => (
	<li className="flex items-center gap-2 py-1">
		{file.previewUrl ? (
			<img
				src={file.previewUrl}
				alt=""
				className="size-7 shrink-0 rounded-md object-cover"
			/>
		) : (
			<span className="bg-shell-surface-soft text-muted-foreground flex size-7 shrink-0 items-center justify-center rounded-md">
				<FileIcon aria-hidden className="size-3.5" />
			</span>
		)}
		<span className="min-w-0 flex-1">
			<span className="block truncate text-xs">{file.name}</span>
			<span className="text-muted-foreground block text-[11px] tabular-nums">
				{file.state === 'reused'
					? 'Already saved'
					: file.state === 'failed'
						? "Couldn't upload"
						: file.state === 'uploading'
							? `${formatFileSize(file.sent)} of ${formatFileSize(file.bytes)}`
							: formatFileSize(file.bytes)}
			</span>
		</span>
		<StateMark state={file.state} percent={percentOf(file.sent, file.bytes)} />
	</li>
)

const describeGroup = (group: SaveGroupSummary) => {
	const settled = group.files.filter(
		(file) => file.state === 'done' || file.state === 'reused'
	).length
	if (group.reused === group.files.length) return 'Already saved'
	return `${settled} of ${group.files.length} · ${formatFileSize(group.bytes)}`
}

const GroupRow: FC<{
	group: SaveGroupSummary
	isOpen: boolean
	onToggle: () => void
}> = ({ group, isOpen, onToggle }) => {
	const filesId = useId()
	const { label, icon } = GROUP_META[group.group]

	return (
		<>
			<button
				type="button"
				onClick={onToggle}
				aria-expanded={isOpen}
				aria-controls={filesId}
				className="publisher-shell-focus ds-field-interactive flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left"
			>
				<span className="text-muted-foreground [&_svg]:size-4">{icon}</span>
				<span className="min-w-0 flex-1">
					<span className="block text-sm">{label}</span>
					<span className="text-muted-foreground block text-[11px] tabular-nums">
						{describeGroup(group)}
					</span>
				</span>
				<StateMark
					state={group.state}
					percent={percentOf(group.sent, group.bytes)}
				/>
			</button>
			<Reveal show={isOpen} id={filesId}>
				<ul className="max-h-48 overflow-y-auto pr-1 pl-8">
					{group.files.map((file) => (
						<FileRow key={file.key} file={file} />
					))}
				</ul>
			</Reveal>
		</>
	)
}

/** The settings are committed last, in one step, once every file is stored. */
const SettingsRow: FC<{ status: SavePanelState['status'] }> = ({ status }) => (
	<div className="flex items-center gap-2 px-2 py-1.5">
		<SlidersHorizontal aria-hidden className="text-muted-foreground size-4" />
		<span className="min-w-0 flex-1">
			<span className="block text-sm">Scene settings</span>
			<span className="text-muted-foreground block text-[11px]">
				{isFinished(status)
					? 'Saved'
					: status === 'committing'
						? 'Saving'
						: status === 'failed'
							? 'Not saved'
							: 'Saved last'}
			</span>
		</span>
		<MarkSwap mark={isFinished(status) ? 'done' : status} className="size-4">
			{isFinished(status) ? (
				<DoneMark />
			) : status === 'committing' ? (
				<ProgressRing value={null} className="text-orange size-4" />
			) : status === 'failed' ? (
				<FailedMark />
			) : (
				<ProgressRing value={0} className="text-muted-foreground size-4" />
			)}
		</MarkSwap>
	</div>
)

const headline = (state: SavePanelState, sceneName: string) => {
	switch (state.status) {
		case 'preparing':
			return 'Preparing scene'
		case 'uploading':
			return `Saving ${sceneName || 'scene'}`
		case 'committing':
			return 'Saving settings'
		case 'saved':
			return 'Saved'
		case 'unchanged':
			return 'Already up to date'
		case 'failed':
			return "Save didn't complete"
	}
}

interface SaveProgressPanelProps {
	/** Runs the same save again. Files already stored come back as saved. */
	onRetry: () => void
}

/**
 * What Save is doing, as a small summary beside the publish card.
 *
 * Collapsed it is one line: a ring, what is happening, and how much has been
 * sent. Expanded it groups the save by what it stores (the model's files, the
 * preview images, the settings committed last), and a group opens to list its
 * files with the same thumbnails the dashboard shows for them. The canvas stays
 * the focus; this is there to watch, not to manage.
 */
export const SaveProgressPanel: FC<SaveProgressPanelProps> = ({ onRetry }) => {
	const state = useAtomValue(savePanelAtom)
	const dismiss = useSetAtom(dismissSavePanelAtom)
	const { name: sceneName } = useAtomValue(sceneMetaAtom)
	const transition = useStateChange()
	const [isExpanded, setIsExpanded] = useState(false)
	const [openGroup, setOpenGroup] = useState<SaveFileGroup | null>(null)
	const [isHovered, setIsHovered] = useState(false)
	const [hasFocus, setHasFocus] = useState(false)
	const contentId = useId()
	const toggleRef = useRef<HTMLButtonElement>(null)
	/** Where focus came from, so closing the panel hands it back. */
	const returnFocusRef = useRef<HTMLElement | null>(null)
	const isPreviewMode = useAtomValue(isPreviewModeAtom)

	const status = state?.status

	// A finished save leaves on its own unless the reader is looking at it:
	// opened, pointed at, or holding focus inside it.
	const isHeld = isExpanded || isHovered || hasFocus
	useEffect(() => {
		if (!status || !isFinished(status) || isHeld) return
		const timer = setTimeout(dismiss, HIDE_AFTER_SAVED_MS)
		return () => clearTimeout(timer)
	}, [status, isHeld, dismiss])

	// The previews are object URLs; leaving the publisher must free them.
	useEffect(() => dismiss, [dismiss])

	// Each save opens collapsed, whatever the last one was left as.
	useEffect(() => {
		if (status === 'preparing') {
			setIsExpanded(false)
			setOpenGroup(null)
		}
	}, [status])

	const summary = state ? summarizeSaveProgress(state) : null
	const isRunning =
		status === 'preparing' || status === 'uploading' || status === 'committing'

	// Only keyboard focus holds the panel open: a click leaves focus on the
	// button it pressed, which would otherwise pin a finished save on screen.
	// `:focus-visible` is the browser's own answer to "was that the keyboard".
	const handleFocus = (event: FocusEvent<HTMLElement>) => {
		const from = event.relatedTarget
		if (!event.currentTarget.contains(from)) {
			returnFocusRef.current = from instanceof HTMLElement ? from : null
		}
		setHasFocus(
			event.target instanceof Element && event.target.matches(':focus-visible')
		)
	}
	const handleBlur = (event: FocusEvent<HTMLElement>) => {
		if (!event.currentTarget.contains(event.relatedTarget)) setHasFocus(false)
	}
	const close = () => {
		const target = returnFocusRef.current
		setHasFocus(false)
		setIsHovered(false)
		dismiss()
		if (target?.isConnected) target.focus()
	}
	// Retry leaves once the save restarts, so keyboard focus moves to the
	// toggle first.
	const retry = () => {
		if (hasFocus) toggleRef.current?.focus()
		onRetry()
	}

	return (
		<>
			{/* Mounted for the publisher's lifetime, so the first headline is announced too; only the headline is, since the byte count changes every tick. */}
			<span aria-live="polite" className="sr-only">
				{state && !isPreviewMode ? headline(state, sceneName) : ''}
			</span>
			<AnimatePresence>
				{state && summary && !isPreviewMode && (
					<motion.section
						key="save-progress"
						aria-label="Save progress"
						initial={{ opacity: 0, y: 8 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0, y: 8 }}
						transition={transition}
						onFocus={handleFocus}
						onBlur={handleBlur}
						onPointerEnter={() => setIsHovered(true)}
						onPointerLeave={() => setIsHovered(false)}
						className="publisher-shell-panel pointer-events-auto flex min-h-0 w-full flex-col overflow-hidden p-2"
					>
						<div className="flex items-center gap-2 px-1">
							<MarkSwap
								mark={
									state.status === 'failed'
										? 'failed'
										: isFinished(state.status)
											? 'done'
											: 'progress'
								}
								className="size-5"
							>
								{state.status === 'failed' ? (
									<FailedMark />
								) : isFinished(state.status) ? (
									<DoneMark />
								) : (
									<span
										role="progressbar"
										aria-label="Saved so far"
										aria-valuemin={0}
										aria-valuemax={100}
										aria-valuenow={
											state.status === 'preparing'
												? undefined
												: Math.round(summary.percent)
										}
									>
										<ProgressRing
											value={
												state.status === 'preparing' ? null : summary.percent
											}
											className="text-orange"
										/>
									</span>
								)}
							</MarkSwap>
							<span className="grid min-w-0 flex-1">
								<AnimatePresence initial={false}>
									<motion.span
										key={headline(state, sceneName)}
										initial={{ opacity: 0, y: 4 }}
										animate={{ opacity: 1, y: 0 }}
										exit={{ opacity: 0, y: -4 }}
										transition={transition}
										aria-hidden
										className="col-start-1 row-start-1 truncate text-sm font-medium"
									>
										{headline(state, sceneName)}
									</motion.span>
								</AnimatePresence>
								<span className="text-muted-foreground truncate text-[11px] tabular-nums">
									{state.status === 'failed'
										? state.message
										: state.status === 'preparing'
											? 'Exporting the model and its preview'
											: isFinished(state.status)
												? formatFileSize(summary.bytes)
												: `${formatFileSize(summary.sent)} of ${formatFileSize(summary.bytes)}`}
								</span>
							</span>
							<button
								ref={toggleRef}
								type="button"
								onClick={() => setIsExpanded((expanded) => !expanded)}
								aria-expanded={isExpanded}
								aria-controls={contentId}
								aria-label={
									isExpanded ? 'Hide save details' : 'Show save details'
								}
								className="publisher-shell-focus ds-field-interactive text-muted-foreground flex size-7 items-center justify-center rounded-md"
							>
								<motion.span
									animate={{ rotate: isExpanded ? 0 : 180 }}
									transition={transition}
									className="grid place-items-center"
								>
									<ChevronDown aria-hidden className="size-4" />
								</motion.span>
							</button>
							<AnimatePresence initial={false}>
								{!isRunning && (
									<motion.button
										key="close"
										type="button"
										onClick={close}
										aria-label="Close"
										initial={{ opacity: 0, width: 0 }}
										animate={{ opacity: 1, width: 28 }}
										exit={{ opacity: 0, width: 0 }}
										transition={transition}
										className="publisher-shell-focus ds-field-interactive text-muted-foreground flex h-7 items-center justify-center overflow-hidden rounded-md"
									>
										<X aria-hidden className="size-4 shrink-0" />
									</motion.button>
								)}
							</AnimatePresence>
						</div>

						<Reveal
							show={isExpanded}
							id={contentId}
							className="flex min-h-0 flex-col"
						>
							{/* Scrolls inside the panel, so the header stays reachable on a short stage. */}
							<ul className="mt-2 min-h-0 space-y-0.5 overflow-y-auto">
								<AnimatePresence initial={false}>
									{summary.groups.map((group) => (
										<motion.li
											key={group.group}
											initial={{ height: 0, opacity: 0 }}
											animate={{ height: 'auto', opacity: 1 }}
											exit={{ height: 0, opacity: 0 }}
											transition={transition}
											className="overflow-hidden"
										>
											<GroupRow
												group={group}
												isOpen={openGroup === group.group}
												onToggle={() =>
													setOpenGroup((open) =>
														open === group.group ? null : group.group
													)
												}
											/>
										</motion.li>
									))}
								</AnimatePresence>
								<li>
									<SettingsRow status={state.status} />
								</li>
							</ul>
						</Reveal>

						<Reveal show={status === 'failed'}>
							<Button
								type="button"
								size="sm"
								variant="secondary"
								className="mt-2 w-full"
								onClick={retry}
							>
								<RotateCw aria-hidden />
								Retry
							</Button>
						</Reveal>
					</motion.section>
				)}
			</AnimatePresence>
		</>
	)
}
