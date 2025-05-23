import { useModelContext } from '@vctrl/hooks/use-load-model'
import { OptimizationInfo } from '@vctrl/hooks/use-optimize-model'
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger
} from '@vctrl-ui/ui/accordion'
import { Button } from '@vctrl-ui/ui/button'
import {
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle
} from '@vctrl-ui/ui/card'
import { Separator } from '@vctrl-ui/ui/separator'
import { cn, formatFileSize } from '@vctrl-ui/utils'
import { motion } from 'framer-motion'
import { useAtom } from 'jotai'
import {
	ArrowRightIcon,
	CheckIcon,
	FileIcon,
	Settings2,
	SparklesIcon,
	Star
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

import { optimizationAtom } from '../../../../../lib/stores/publisher-config-store'

import { AdvancedPanel } from './advanced-optimization-panel'
import { BasicOptimizationPanel } from './basic-optimization-panel'
import SceneDetails from './scene-details'

interface OptimizationInfoProps {
	info: OptimizationInfo
}

// File size comparison component
const FileSizeComparison: React.FC<OptimizationInfoProps> = ({ info }) => {
	const initialFileSize = info.initial.sceneBytes
	const currentFileSize = info.optimized.sceneBytes

	return (
		<div className="flex items-center justify-between">
			<motion.div
				className="text-center"
				initial={{ opacity: 0, y: 20 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ duration: 0.5 }}
			>
				<div className="text-3xl font-bold">
					{formatFileSize(initialFileSize)}
				</div>
				<div className="text-sm text-zinc-400">Original</div>
			</motion.div>
			<ArrowRightIcon className="text-accent h-8 w-8 transform" />
			<motion.div
				className="text-center"
				initial={{ opacity: 0, y: 20 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ duration: 0.5, delay: 0.2 }}
			>
				<div className="text-accent text-3xl font-bold">
					{formatFileSize(currentFileSize)}
				</div>
				<div className="text-sm text-zinc-400">Optimized</div>
			</motion.div>
		</div>
	)
}

type OptimizationStat = {
	name: 'vertices' | 'primitives' | 'mesh' | 'texture' | 'scene'
	unit: 'size' | 'count'
	reduction: number
}

interface OptimizatoinSummaryProps {
	optimizationStats: OptimizationStat[]
}

// Optimization summary component
const OptimizationSummary: React.FC<OptimizatoinSummaryProps> = ({
	optimizationStats
}) => {
	return (
		<motion.div
			className="bg-muted/50 rounded-lg p-4"
			initial={{ opacity: 0, y: 20 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ duration: 0.5, delay: 0.4 }}
		>
			<h4 className="mb-3 flex items-center text-sm font-semibold">
				<CheckIcon className="text-accent mr-2 h-4 w-4" />
				Optimizations Applied
			</h4>
			<ul className="space-y-2">
				{optimizationStats
					.filter(({ name }) => name !== 'scene')
					.map((opt, index) => (
						<motion.li
							key={index}
							className="flex justify-between text-sm"
							initial={{ opacity: 0, x: -20 }}
							animate={{ opacity: 1, x: 0 }}
							transition={{
								delay: 0.6 + index * 0.1,
								duration: 0.3
							}}
						>
							<span className="text-zinc-400 capitalize">
								{opt.name} {opt.unit.toLocaleLowerCase()} reduction
							</span>
							<span className="text-accent">{opt.reduction}%</span>
						</motion.li>
					))}
			</ul>
		</motion.div>
	)
}

interface OptimizationStatsProps extends OptimizationInfoProps {
	optimizationStats: OptimizationStat[]
}
// Extracted OptimizationStats component for better modularity
const OptimizationStats: React.FC<OptimizationStatsProps> = (props) => {
	const { info, optimizationStats } = props
	if (!optimizationStats.length) return null

	return (
		<>
			<CardContent className="p-6">
				<div className="space-y-6">
					<FileSizeComparison info={info} />
					<OptimizationSummary optimizationStats={optimizationStats} />
				</div>
			</CardContent>
			<Separator />
		</>
	)
}

type OptimizeButtonProps = {
	onOptimize: () => Promise<void>
	isPending: boolean
	hasOptimized: boolean
}

// Optimization button component
const OptimizeButton: React.FC<OptimizeButtonProps> = ({
	hasOptimized,
	isPending,
	onOptimize
}) => (
	<div className="border-t p-4">
		<Button
			variant="accent"
			className="w-full"
			onClick={onOptimize}
			disabled={isPending}
		>
			{isPending ? (
				<>
					<SparklesIcon className="mr-2 h-4 w-4 animate-spin" />
					Optimizing...
				</>
			) : (
				<>
					<SparklesIcon className="mr-2 h-4 w-4" />
					{hasOptimized ? 'Optimize More' : 'Apply Optimizations'}
				</>
			)}
		</Button>
	</div>
)

const calculateOptimizationStats = (
	info: OptimizationInfo
): OptimizationStat[] => {
	// Define all possible optimization metrics
	const metrics: Array<{
		key: keyof typeof info.improvement
		name: OptimizationStat['name']
		unit: OptimizationStat['unit']
	}> = [
		{ key: 'verticesCount', name: 'vertices', unit: 'count' },
		{ key: 'primitivesCount', name: 'primitives', unit: 'count' },
		{ key: 'meshesSize', name: 'mesh', unit: 'size' },
		{ key: 'texturesSize', name: 'texture', unit: 'size' },
		{ key: 'sceneBytes', name: 'scene', unit: 'size' }
	]

	// Filter metrics that show improvement and map them to stats
	return metrics
		.filter(({ key }) => info.improvement[key] > 0)
		.map(({ key, name, unit }) => ({
			name,
			unit,
			reduction: Math.round((info.improvement[key] / info.initial[key]) * 100)
		}))
}

const OptimizeSidebarContent: React.FC = () => {
	const { optimize, on, off } = useModelContext()
	const {
		reset: resetOptimize,
		applyOptimization,
		optimizations: { info, ...optimizations }
	} = optimize

	const optimizationStats = calculateOptimizationStats(info)

	const [{ plannedOptimizations }] = useAtom(optimizationAtom)

	const [isPending, setIsPending] = useState<boolean>(false)

	// Handle optimization process
	const handleOptimizeClick = useCallback(async () => {
		if (isPending) return

		setIsPending(true)

		try {
			const optimizationOptions = Object.values(plannedOptimizations).filter(
				(option): option is typeof option => !!option && option.enabled
			)

			for (let i = 0; i < optimizationOptions.length; i++) {
				const option = optimizationOptions[i]

				try {
					// Apply single optimization based on option type
					if (option.name === 'simplification') {
						await optimizations.simplifyOptimization(option)
					} else if (option.name === 'texture') {
						await optimizations.texturesOptimization(option)
					} else if (option.name === 'quantize') {
						await optimizations.quantizeOptimization()
					} else if (option.name === 'dedup') {
						await optimizations.dedupOptimization()
					} else if (option.name === 'normals') {
						await optimizations.normalsOptimization()
					}

					// Let UI update between optimizations
					await new Promise<void>((resolve) =>
						requestAnimationFrame(() => setTimeout(() => resolve(), 0))
					)
				} catch (error) {
					console.error(`Error processing ${option.name}:`, error)
				}
			}

			// Apply all optimizations
			await applyOptimization()

			console.log('optimizations applied successfully')
		} catch (error) {
			console.error('Error during optimization:', error)
		} finally {
			setIsPending(false)
		}
	}, [applyOptimization, optimizations, plannedOptimizations, isPending])

	// Reset on model load
	useEffect(() => {
		on('load-start', resetOptimize)
		return () => off('load-start', resetOptimize)
	}, [off, on, resetOptimize])

	return (
		<div className="flex h-full flex-col">
			<div className="no-scrollbar grow overflow-y-auto">
				<CardHeader className="py-6">
					<CardTitle>
						<motion.span
							className={cn(
								'font-bold',
								info.optimized.sceneBytes < info.initial.sceneBytes
									? 'text-accent'
									: 'text-muted-foreground'
							)}
							initial={{ opacity: 0, y: -20 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ delay: 0.1, duration: 0.5 }}
						>
							{info.improvement.sceneBytes > 0
								? Math.round(
										(info.improvement.sceneBytes / info.initial.sceneBytes) *
											100
									)
								: 0}
							%
						</motion.span>{' '}
						Reduced Scene Size
					</CardTitle>
					<CardDescription>Enhancement summary</CardDescription>
				</CardHeader>

				<Separator />

				<OptimizationStats info={info} optimizationStats={optimizationStats} />

				<Accordion type="single" defaultValue="basic" collapsible>
					<AccordionItem value="basic" className="px-4">
						<AccordionTrigger className="px-2">
							<span className="flex items-center gap-3">
								<Star className="inline" size={14} />
								Optimization
							</span>
						</AccordionTrigger>
						<AccordionContent>
							<BasicOptimizationPanel />
						</AccordionContent>
					</AccordionItem>
					<AccordionItem value="advanced" className="px-4">
						<AccordionTrigger className="px-2">
							<span className="flex items-center gap-3">
								<Settings2 className="inline" size={14} />
								Advanced Optimization
							</span>
						</AccordionTrigger>
						<AccordionContent>
							<AdvancedPanel />
						</AccordionContent>
					</AccordionItem>
					<AccordionItem value="details" className="px-4">
						<AccordionTrigger className="px-2">
							<span className="flex items-center gap-3">
								<FileIcon className="inline" size={14} />
								Scene Details
							</span>
						</AccordionTrigger>
						<AccordionContent>
							<SceneDetails info={info} />
						</AccordionContent>
					</AccordionItem>
				</Accordion>
			</div>

			<OptimizeButton
				onOptimize={handleOptimizeClick}
				isPending={isPending}
				hasOptimized={info.optimized.sceneBytes < info.initial.sceneBytes}
			/>
		</div>
	)
}

export default OptimizeSidebarContent
