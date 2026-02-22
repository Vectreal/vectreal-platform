import { TooltipProvider } from '@shared/components/ui/tooltip'
import { cn } from '@shared/utils'
import { useModelContext } from '@vctrl/hooks/use-load-model'
import { useAtom } from 'jotai'
import { ArrowLeft, ArrowRight, Pen, Stars } from 'lucide-react'

import { processAtom } from '../../lib/stores/publisher-config-store'
import { SidebarMode } from '../../types/publisher-config'
import { TooltipButton } from '../tooltip-button'

const PublisherButtons = () => {
	const { file } = useModelContext()
	const [{ step, showSidebar }, setProcess] = useAtom(processAtom)

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

	const goToPreparing = () => {
		setProcess((prev) => ({
			...prev,
			step: 'preparing',
			mode: 'optimize',
			showSidebar: true,
			showInfo: false
		}))
	}

	const isPreparingStep = file?.model && step === 'preparing'
	const isPublishingStep = file?.model && step === 'publishing'

	return (
		<TooltipProvider>
			<div className="absolute right-0 bottom-0 left-0 z-10 flex justify-between gap-2 p-4">
				{isPreparingStep && (
					<>
						<span className="space-x-2">
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
						</span>

						<TooltipButton
							onClick={goToPublishing}
							info="Publish your 3D scene"
						>
							<ArrowRight size={14} className="inline" />
							Go to Publishing
						</TooltipButton>
					</>
				)}
				{isPublishingStep && (
					<span
						className={cn(
							'fixed bottom-0 z-20 m-4 flex gap-2 transition-all duration-300 ease-in-out',
							showSidebar ? 'left-94' : 'left-0'
						)}
					>
						<TooltipButton onClick={goToPreparing} info="Go back to preparing">
							<ArrowLeft size={14} className="inline" />
							Go Back to Preparing
						</TooltipButton>
					</span>
				)}
			</div>
		</TooltipProvider>
	)
}

export default PublisherButtons
