import { useSetAtom } from 'jotai'
import { Pen, Stars } from 'lucide-react'

import { processAtom } from '../../lib/stores/publisher-config-store'
import { SidebarMode } from '../../types/publisher-config'
import { TooltipButton } from '../tooltip-button'

const ToolSidebarButtons = () => {
	const setProcessState = useSetAtom(processAtom)
	const handleOpenSidebar = (sidebar: SidebarMode) => {
		setProcessState((prev) => ({
			...prev,
			mode: sidebar,
			showSidebar: true,
			showInfo: false
		}))
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
}

export default ToolSidebarButtons
