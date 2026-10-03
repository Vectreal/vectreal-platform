import { useAtomValue, useSetAtom } from 'jotai/react'
import { memo, useCallback, useEffect } from 'react'

import { ComposeSidebar } from './compose-sidebar'
import { getComposeToolDefinition } from './compose-sidebar/compose-tools'
import { DynamicSidebar } from './dynamic-sidebar'
import {
	arePublisherActionsDisabledAtom,
	cameraToolOpenRequestAtom,
	openComposeToolAtom,
	processAtom,
	toolSidebarStateAtom
} from '../../../lib/stores/publisher-config-store'
import {
	PUBLISHER_BELOW_TOOL_BAR,
	PUBLISHER_LAYER
} from '../shell/shell-layout'

interface ToolSidebarProps {
	isMobile?: boolean
}

/**
 * The open compose tool's panel. The tools themselves are chosen from the
 * `ToolBar`; this only hosts whichever one is selected, under the bar on
 * desktop and as a bottom sheet on mobile.
 */
export const ToolSidebar = memo(({ isMobile = false }: ToolSidebarProps) => {
	const { activeComposeTool, showSidebar } = useAtomValue(toolSidebarStateAtom)
	const arePublisherActionsDisabled = useAtomValue(
		arePublisherActionsDisabledAtom
	)
	const setProcessState = useSetAtom(processAtom)
	const activeToolDefinition = getComposeToolDefinition(activeComposeTool)

	// A request to open the Camera tool on one camera belongs to the opening
	// that made it. Dropped once the Camera tool is not the open tool, so a
	// switch away before its panel mounts cannot leave it for a later visit.
	const setCameraToolOpenRequest = useSetAtom(cameraToolOpenRequestAtom)
	const isCameraToolOpen =
		useAtomValue(openComposeToolAtom) === 'camera-controls'
	useEffect(() => {
		if (!isCameraToolOpen) setCameraToolOpenRequest(null)
	}, [isCameraToolOpen, setCameraToolOpenRequest])

	const handleOpenChange = useCallback(
		(open: boolean) => {
			if (arePublisherActionsDisabled) {
				return
			}

			setProcessState((prev) =>
				prev.showSidebar === open ? prev : { ...prev, showSidebar: open }
			)
		},
		[arePublisherActionsDisabled, setProcessState]
	)

	return (
		<DynamicSidebar
			open={showSidebar}
			onOpenChange={handleOpenChange}
			isMobile={isMobile}
			direction="left"
			title={activeToolDefinition.label}
			description={activeToolDefinition.description}
			showDesktopHeader={true}
			zIndexClassName={PUBLISHER_LAYER.sidebar}
			containerClassName={PUBLISHER_BELOW_TOOL_BAR}
			className={isMobile ? undefined : 'w-[21rem]'}
		>
			<div className="no-scrollbar min-h-0 flex-1 overflow-auto px-4 py-4">
				<ComposeSidebar activeTool={activeComposeTool} />
			</div>
		</DynamicSidebar>
	)
})

ToolSidebar.displayName = 'ToolSidebar'
