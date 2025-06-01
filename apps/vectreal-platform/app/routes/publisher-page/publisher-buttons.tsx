import { Button } from '@vctrl-ui/ui/button'
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger
} from '@vctrl-ui/ui/tooltip'
import { useAtom } from 'jotai'
import { ArrowRight, Info, Pen, Stars } from 'lucide-react'

import { PropsWithChildren } from 'react'

import {
	processAtom,
	SidebarMode
} from '../../lib/stores/publisher-config-store'

interface ButtonProps extends PropsWithChildren {
	onClick?: () => void
	info: string
	size?: 'icon'
}

const ButtonWithTooltip = ({ children, info, size, onClick }: ButtonProps) => {
	return (
		<Tooltip>
			<TooltipTrigger>
				<Button
					asChild
					size={size}
					variant="outline"
					className="hover:text-muted-foreground p-2"
					onClick={onClick}
				>
					<span>{children}</span>
				</Button>
				<TooltipContent>{info}</TooltipContent>
			</TooltipTrigger>
		</Tooltip>
	)
}

const PublisherButtons = () => {
	const [{ step }, setProcess] = useAtom(processAtom)

	function handleInfoOpen(isOpen: boolean) {
		setProcess((prev) => ({
			...prev,
			showInfo: isOpen
		}))
	}

	const handleOpenSidebar = (sidebar: SidebarMode) => {
		setProcess((prev) => ({
			...prev,
			mode: sidebar,
			showSidebar: true,
			showInfo: false
		}))
	}

	const goToPublishing = () => {
		setProcess((prev) => ({
			...prev,
			step: 'publishing',
			mode: 'publish',
			showSidebar: true,
			showInfo: false
		}))
	}

	return (
		<TooltipProvider>
			<div className="absolute right-0 bottom-0 left-0 z-10 flex justify-between gap-2 p-4">
				{step !== 'uploading' && (
					<>
						<span className="space-x-2">
							<ButtonWithTooltip
								onClick={() => handleOpenSidebar('optimize')}
								info="Optimize your 3D model"
							>
								<Stars size={14} className="inline" /> Optimize
							</ButtonWithTooltip>
							<ButtonWithTooltip
								onClick={() => handleOpenSidebar('compose')}
								info="Compose your 3D scene"
							>
								<Pen size={14} className="inline" />
								Compose
							</ButtonWithTooltip>

							{/* Info open button */}
							<ButtonWithTooltip
								onClick={() => handleInfoOpen(true)}
								info="Information about the current step"
								size="icon"
							>
								<Info size={12} />
							</ButtonWithTooltip>
						</span>

						<ButtonWithTooltip
							onClick={goToPublishing}
							info="Publish your 3D scene"
						>
							<ArrowRight size={14} className="inline" />
							Go to Publishing
						</ButtonWithTooltip>
					</>
				)}
			</div>
		</TooltipProvider>
	)
}

export default PublisherButtons
