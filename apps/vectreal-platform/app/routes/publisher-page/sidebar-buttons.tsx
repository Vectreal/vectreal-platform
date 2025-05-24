import { Button } from '@vctrl-ui/ui/button'
import { useSetAtom } from 'jotai'
import { Pen, Stars } from 'lucide-react'

import {
	processAtom,
	SidebarMode
} from '../../lib/stores/publisher-config-store'

const SidebarButtons = () => {
	const setProcess = useSetAtom(processAtom)

	const handleOpenSidebar = (sidebar: SidebarMode) => {
		setProcess((prev) => ({
			...prev,
			mode: sidebar,
			showSidebar: true,
			showInfo: false
		}))
	}

	return (
		<div className="absolute right-0 bottom-0 left-0 z-10 space-x-2 p-4">
			<Button onClick={() => handleOpenSidebar('optimize')} variant="outline">
				<Stars size={14} className="inline" /> Optimize
			</Button>
			<Button onClick={() => handleOpenSidebar('compose')} variant="outline">
				<Pen size={14} className="inline" />
				Compose
			</Button>
		</div>
	)
}

export default SidebarButtons
