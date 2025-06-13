import { Button } from '@vctrl-ui/ui/button'
import { useAtom, useAtomValue } from 'jotai/react'
import { Info } from 'lucide-react'
import { useCallback } from 'react'

import {
	processAtom,
	ProcessState
} from '../../../lib/stores/publisher-config-store'

import PreparingStepInfo from './step-info/preparing'

interface StepProps {
	step: ProcessState['step']
	index: number
}

const Step = ({ step, index }: StepProps) => {
	return (
		<div
			key={step}
			className="flex h-full w-fit flex-col items-center justify-between capitalize transition-colors"
		>
			<div className="text-muted-foreground hover:text-muted-foreground flex w-fit grow items-center p-2 px-4">
				<Info
					className="text-muted-foreground hover:text-muted-foreground mr-4"
					size={20}
				/>
				<span className="text-muted-foreground text-sm font-medium capitalize transition-colors">
					{step}
				</span>
				<small className="ml-4 leading-tight">step</small>
				<span className="text-accent after:bg-accent relative mx-2 text-lg leading-[1] font-bold after:absolute after:left-0 after:h-4 after:w-2 after:blur-md">
					{index + 1}
				</span>
				<small className="leading-tight">/ {steps.length}</small>
			</div>
		</div>
	)
}

const steps: ProcessState['step'][] = ['uploading', 'preparing', 'publishing']

const Stepper = () => {
	const currentStep = useAtomValue(processAtom).step
	const [{ step }, setProcess] = useAtom(processAtom)

	// // Reset the process state when the component unmounts
	// useEffect(() => {
	// 	return setProcess(RESET)
	// }, [setProcess])

	const index = steps.indexOf(currentStep)

	const handleClick = useCallback(() => {
		setProcess((prev) => ({
			...prev,
			showInfo: !prev.showInfo
		}))
	}, [setProcess])

	return (
		<div className="fixed top-0 left-1/2 z-20 m-4 flex -translate-x-1/2 items-center gap-4">
			<div className="absolute inset-0 -z-10 scale-150 bg-black/50 blur-3xl" />
			{/* Info sheet */}
			{currentStep === 'preparing' ? <PreparingStepInfo /> : null}

			{/* Steps bar */}
			<Button
				variant="secondary"
				onClick={handleClick}
				className="bg-muted relative z-30 h-full w-full rounded-xl p-0! shadow-lg hover:cursor-help"
			>
				<Step key={step} index={index} step={step} />
			</Button>
		</div>
	)
}

export default Stepper
