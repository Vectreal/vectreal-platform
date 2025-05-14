import { Button } from '@vctrl-ui/ui/button'
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger
} from '@vctrl-ui/ui/tooltip'
import { cn } from '@vctrl-ui/utils'
import { AnimatePresence, motion } from 'framer-motion'
import { useAtom, useAtomValue } from 'jotai/react'
import { RESET } from 'jotai/utils'
import { Info, X } from 'lucide-react'
import { useEffect } from 'react'

import {
	processAtom,
	ProcessState
} from '../../../../lib/stores/publisher-config-store'

import PreparingStep from './steps/preparating'
import UploadingStep from './steps/uploading'

const infoVariants = {
	hidden: {
		display: 'none',
		opacity: 0,
		y: 20
	},
	visible: {
		display: 'flex',
		opacity: 1,
		y: 0
	}
}

const highlightVariants = {
	hidden: {
		opacity: 0,
		width: 50
	},
	visible: {
		transition: { delay: 1.5 },
		opacity: 1,
		width: '100%'
	}
}

interface StepProps {
	isActive: boolean
	step: ProcessState['step']
	index: number
}

const Step = ({ isActive, step, index }: StepProps) => {
	return (
		<li
			key={step}
			className={cn(
				'flex h-full w-fit flex-col items-center justify-between capitalize transition-colors',
				isActive && 'marker:text-orange'
			)}
		>
			<div className="text-muted-foreground hover:text-muted-foreground flex w-fit grow items-center pt-3 pb-2">
				<span
					className={cn(
						'text-sm font-medium transition-colors',
						isActive && 'text-orange'
					)}
				>
					{index + 1}. <span className="capitalize">{step}</span>
				</span>
			</div>

			{/* Highlight line */}
			<AnimatePresence>
				{isActive ? (
					<motion.div
						variants={highlightVariants}
						initial="hidden"
						animate="visible"
						exit="hidden"
						transition={{ duration: 0.5, ease: 'easeInOut' }}
						key={step}
						className="border-ring/50 bg-orange after:bg-orange relative mx-auto h-1 w-full rounded-t-xl border-x border-t after:absolute after:h-1 after:w-full after:blur-sm after:content-['']"
					/>
				) : (
					<div className="h-1 w-full" />
				)}
			</AnimatePresence>
		</li>
	)
}

const steps: ProcessState['step'][] = ['uploading', 'preparing', 'publishing']

const Stepper = () => {
	const currentStep = useAtomValue(processAtom).step
	const [{ showInfo, showSidebar }, setProcess] = useAtom(processAtom)

	function handleInfoOpen(isOpen: boolean) {
		setProcess((prev) => ({
			...prev,
			showInfo: isOpen
		}))
	}

	// Reset the process state when the component unmounts
	useEffect(() => {
		return setProcess(RESET)
	}, [setProcess])

	return (
		<div className="fixed bottom-0 flex h-12 w-full flex-col items-center justify-center gap-4">
			{/* Info sheet */}
			<motion.div
				variants={infoVariants}
				initial="hidden"
				animate={showInfo ? 'visible' : 'hidden'}
				transition={{ duration: 0.5, ease: 'backInOut' }}
				className="border-border/50 bg-card/75 absolute bottom-0 left-0 z-20 mb-12 h-fit w-full border-t shadow-[0_5px_24px_rgba(0,0,0,.2)] backdrop-blur-xl"
			>
				<div className="relative mx-auto max-w-4xl p-4 py-8">
					<Button
						variant="ghost"
						className="absolute top-0 right-0 z-20 mt-2 mr-8"
						onClick={() => handleInfoOpen(false)}
					>
						<X className="" />
					</Button>
					{currentStep === 'uploading' ? (
						<UploadingStep />
					) : currentStep === 'preparing' ? (
						<PreparingStep />
					) : null}
				</div>
			</motion.div>

			{/* Info open button */}
			<TooltipProvider>
				<AnimatePresence>
					{!showInfo && !showSidebar && (
						<motion.div
							variants={infoVariants}
							initial="hidden"
							animate="visible"
							exit="hidden"
							key="info-button"
							transition={{ duration: 0.5, ease: 'easeInOut' }}
							className="absolute right-0 bottom-0 z-20 mr-4 mb-16 flex h-fit w-fit justify-end gap-4"
						>
							<Tooltip>
								<TooltipTrigger>
									<Button
										asChild
										size="icon"
										variant="outline"
										className="text-muted-foreground hover:text-muted-foreground p-2"
										onClick={() => handleInfoOpen(true)}
									>
										<Info size={12} />
									</Button>
									<TooltipContent>
										Information about the current step
									</TooltipContent>
								</TooltipTrigger>
							</Tooltip>
						</motion.div>
					)}
				</AnimatePresence>
			</TooltipProvider>

			{/* Steps bar */}
			<div className="bg-muted border-ring/25 relative z-30 h-full w-full border-t">
				<ol className="mx-auto flex h-full w-full items-center justify-between md:max-w-2xl">
					{steps.map((step, index) => (
						<Step
							key={step}
							index={index}
							step={step}
							isActive={currentStep === step}
						/>
					))}
				</ol>
			</div>
		</div>
	)
}

export default Stepper
