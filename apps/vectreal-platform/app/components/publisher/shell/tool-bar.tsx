import { ActiveIndicator } from '@shared/components/ui/active-indicator'
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger
} from '@shared/components/ui/tooltip'
import { cn } from '@shared/utils'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useAtomValue, useSetAtom } from 'jotai/react'
import { ExternalLink, Eye, EyeOff } from 'lucide-react'
import { memo, useCallback, useId } from 'react'
import { useParams } from 'react-router'

import { PUBLISHER_EDGE_INSET, PUBLISHER_LAYER } from './shell-layout'
import { buildInternalPreviewPath } from '../../../lib/domain/embed/embed-snippet'
import {
	currentLocationAtom,
	enterPreviewModeAtom,
	exitPreviewModeAtom,
	isPreviewModeAtom,
	lastSavedSceneIdAtom,
	openComposeToolAtom,
	processAtom
} from '../../../lib/stores/publisher-config-store'
import { COMPOSE_TOOL_DEFINITIONS } from '../sidebars/compose-sidebar/compose-tools'

import type { ComposeTool } from '../../../types/publisher-config'

/** `--ease-out` and `--duration-base`, which Framer cannot read as tokens. */
const TOOLS_TRANSITION = { duration: 0.25, ease: [0.16, 1, 0.3, 1] as const }

const triggerClassName =
	'publisher-shell-focus inline-flex h-9 shrink-0 items-center gap-2 rounded-lg px-3 text-sm font-medium whitespace-nowrap transition-colors duration-150 motion-reduce:transition-none [&_svg]:size-4 [&_svg]:shrink-0'
const restingClassName =
	'text-muted-foreground hover:text-foreground hover:bg-foreground/5'
const activeClassName = 'bg-foreground text-background'

/**
 * The publisher's tools, as one labelled row floating over the top-left of the
 * stage.
 *
 * It replaces a column of unlabelled icons that pushed every sidebar right by
 * its own width, was hidden on phones (so phones had no tools at all), and
 * could not hold preview mode, which only the Camera tool could enter. The
 * sidebar now opens at the stage's left edge, under this row.
 *
 * In preview the tools leave and the Preview trigger stays where it was as the
 * way out, so there is one place to enter and leave and nothing else on the
 * canvas.
 */
export const ToolBar = memo(() => {
	const openComposeTool = useAtomValue(openComposeToolAtom)
	const isPreviewMode = useAtomValue(isPreviewModeAtom)
	const enterPreviewMode = useSetAtom(enterPreviewModeAtom)
	const exitPreviewMode = useSetAtom(exitPreviewModeAtom)
	const setProcessState = useSetAtom(processAtom)
	const prefersReducedMotion = useReducedMotion()
	const activeToolIndicatorId = useId()

	const routeParams = useParams()
	const { projectId } = useAtomValue(currentLocationAtom)
	const lastSavedSceneId = useAtomValue(lastSavedSceneIdAtom)
	// The route param lags a first save, so fall back to the just-saved id.
	// Without both ids there is no scene on disk to open, hence the disabled state.
	const savedSceneId = routeParams.sceneId ?? lastSavedSceneId ?? null
	const fullPreviewHref =
		projectId && savedSceneId
			? buildInternalPreviewPath({ projectId, sceneId: savedSceneId })
			: null

	const handleToolSelect = useCallback(
		(tool: ComposeTool) => {
			setProcessState((prev) => ({
				...prev,
				mode: 'compose',
				activeComposeTool: tool,
				showSidebar:
					prev.mode === 'compose' && prev.activeComposeTool === tool
						? !prev.showSidebar
						: true,
				showPublishPanel: false
			}))
		},
		[setProcessState]
	)

	return (
		<div
			role="toolbar"
			aria-label="Publisher tools"
			className={cn(
				'publisher-shell-panel no-scrollbar absolute top-0 left-0 flex max-w-[calc(100%-1.5rem)] items-center gap-1 overflow-x-auto p-1',
				PUBLISHER_EDGE_INSET,
				PUBLISHER_LAYER.toolBar
			)}
		>
			<AnimatePresence initial={false}>
				{!isPreviewMode && (
					<motion.div
						key="tools"
						initial={{ opacity: 0, width: 0 }}
						animate={{ opacity: 1, width: 'auto' }}
						exit={{ opacity: 0, width: 0 }}
						transition={
							prefersReducedMotion ? { duration: 0 } : TOOLS_TRANSITION
						}
						// Clipped so the tools can collapse to nothing, and padded by the
						// focus ring's reach (2px offset, 2px ring) with the margin taken
						// back, so the clip does not cut a focused trigger's ring.
						className="-m-1 flex shrink-0 items-center gap-1 overflow-hidden p-1"
					>
						{COMPOSE_TOOL_DEFINITIONS.map(
							({ value, icon: Icon, shortLabel }) => {
								const isActive = value === openComposeTool
								return (
									<button
										key={value}
										type="button"
										aria-pressed={isActive}
										onClick={() => handleToolSelect(value)}
										className={cn(
											triggerClassName,
											'relative isolate',
											isActive ? 'text-background' : restingClassName
										)}
									>
										{isActive && (
											<ActiveIndicator layoutId={activeToolIndicatorId} />
										)}
										<Icon aria-hidden />
										{shortLabel}
									</button>
								)
							}
						)}
						<span aria-hidden className="ds-divider mx-1 h-5 w-px shrink-0" />
					</motion.div>
				)}
			</AnimatePresence>

			<button
				type="button"
				aria-pressed={isPreviewMode}
				onClick={isPreviewMode ? exitPreviewMode : enterPreviewMode}
				className={cn(
					triggerClassName,
					isPreviewMode ? activeClassName : restingClassName
				)}
			>
				{isPreviewMode ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
				{isPreviewMode ? 'Exit preview' : 'Preview'}
			</button>

			<Tooltip>
				<TooltipTrigger asChild>
					{fullPreviewHref ? (
						<a
							href={fullPreviewHref}
							target="_blank"
							rel="noreferrer"
							aria-label="Open full preview in a new tab"
							className={cn(triggerClassName, restingClassName, 'px-2.5')}
						>
							<ExternalLink aria-hidden />
						</a>
					) : (
						// `aria-disabled` rather than `disabled`: a disabled button takes no
						// pointer events or focus, so its tooltip could never explain why.
						<button
							type="button"
							aria-disabled="true"
							aria-label="Open full preview"
							onClick={(event) => event.preventDefault()}
							className={cn(
								triggerClassName,
								'text-muted-foreground/50 cursor-not-allowed px-2.5'
							)}
						>
							<ExternalLink aria-hidden />
						</button>
					)}
				</TooltipTrigger>
				<TooltipContent side="bottom">
					{fullPreviewHref ? 'Open full preview' : 'Save this scene first.'}
				</TooltipContent>
			</Tooltip>
		</div>
	)
})

ToolBar.displayName = 'ToolBar'
