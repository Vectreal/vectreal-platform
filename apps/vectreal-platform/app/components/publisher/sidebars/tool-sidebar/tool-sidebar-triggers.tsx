import { useSetAtom } from 'jotai/react'
import { Pen, Stars } from 'lucide-react'
import { memo } from 'react'

import { processAtom } from '../../../../lib/stores/publisher-config-store'
import { SidebarMode } from '../../../../types/publisher-config'
import { TooltipButton } from '../../../tooltip-button'

interface ToolSidebarTriggersProps {
	isMobile?: boolean
}

const ToolSidebarTriggers = memo(({ isMobile }: ToolSidebarTriggersProps) => {
	const setProcessState = useSetAtom(processAtom)
	const handleOpenSidebar = (sidebar: SidebarMode) => {
		setProcessState((prev) => ({
			...prev,
			mode: sidebar,
			showSidebar: true,
			showInfo: false
		}))
	}

	if (isMobile) {
		return null
	}

	return (
		<div className="fixed bottom-6 left-0 z-20 m-4 flex gap-4">
			<TooltipButton
				onClick={() => handleOpenSidebar('optimize')}
				info="Optimize your 3D model"
			>
				<Stars size={14} className="inline" /> Optimize
			</TooltipButton>
			<TooltipButton
				onClick={() => handleOpenSidebar('compose')}
				info="Compose your 3D scene"
			>
				<Pen size={14} className="inline" />
				Compose
			</TooltipButton>
		</div>
	)
})

export default ToolSidebarTriggers
