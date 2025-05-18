import {
	InspectMeshReport,
	InspectReport,
	InspectTextureReport
} from '@gltf-transform/functions'
import { useModelContext } from '@vctrl/hooks/use-load-model'
import { ModelSize } from '@vctrl/hooks/use-optimize-model'
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
	FileQuestion,
	Settings2,
	SparklesIcon,
	Star
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { optimizationAtom } from '../../../../../lib/stores/publisher-config-store'

import { AdvancedPanel } from './advanced-optimization-panel'
import { BasicOptimizationPanel } from './basic-optimization-panel'
import SceneDetails from './scene-details'

type OptimizationStat = {
	name: 'mesh' | 'texture'
	reduction: number
}

type ModelTotals = {
	verticesTotal: number
	primitivesTotal: number
	texturesSizeTotal: number
	fileSize: number
}

type OptimizationStats = {
	optimizationStats: OptimizationStat[]
	initialFileSize: number
	currentFileSize: number
}

type FileSizeComparisonProps = {
	initialFileSize: number
	currentFileSize: number
}

type OptimizationSummaryProps = {
	optimizationStats: OptimizationStat[]
	currentFileSize: number
	initialFileSize: number
}

type OptimizeButtonProps = {
	onOptimize: () => Promise<void>
	isPending: boolean
}

type InitialReportsRef = {
	report: InspectReport | undefined
	size: ModelSize | null
} | null

/**
 * Helper function to sum a specific property over an array of objects.
 */
function sumProperty<K extends string>(
	items: Record<K, number>[] | undefined,
	property: K
): number {
	if (!items) return 0
	return items.reduce((total, item) => total + (item[property] || 0), 0)
}

/**
 * Calculate the percentage improvement.
 */
function calculatePercentageImprovement(
	improvement: number,
	initialTotal: number
): number {
	if (initialTotal === 0) return 0
	return Math.round((improvement / initialTotal) * 100)
}

// Extracted OptimizationStats component for better modularity
const OptimizationStats: React.FC<OptimizationStats> = ({
	optimizationStats,
	initialFileSize,
	currentFileSize
}) => {
	if (!optimizationStats.length) return null

	return (
		<>
			<CardContent className="p-6">
				<div className="space-y-6">
					<FileSizeComparison
						initialFileSize={initialFileSize}
						currentFileSize={currentFileSize}
					/>
					<OptimizationSummary
						optimizationStats={optimizationStats}
						currentFileSize={currentFileSize}
						initialFileSize={initialFileSize}
					/>
				</div>
			</CardContent>
			<Separator />
		</>
	)
}

// File size comparison component
const FileSizeComparison: React.FC<FileSizeComparisonProps> = ({
	initialFileSize,
	currentFileSize
}) => (
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
		<ArrowRightIcon
			className={cn(
				'h-8 w-8 transform',
				currentFileSize < initialFileSize
					? 'rotate-45 text-emerald-400'
					: 'text-gray-400'
			)}
		/>
		<motion.div
			className="text-center"
			initial={{ opacity: 0, y: 20 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ duration: 0.5, delay: 0.2 }}
		>
			<div
				className={cn(
					'text-3xl font-bold',
					currentFileSize < initialFileSize
						? 'text-emerald-400'
						: 'text-gray-400'
				)}
			>
				{formatFileSize(currentFileSize)}
			</div>
			<div className="text-sm text-zinc-400">Optimized</div>
		</motion.div>
	</div>
)

// Optimization summary component
const OptimizationSummary: React.FC<OptimizationSummaryProps> = ({
	optimizationStats,
	currentFileSize,
	initialFileSize
}) => (
	<motion.div
		className="rounded-lg bg-zinc-900 p-4"
		initial={{ opacity: 0, y: 20 }}
		animate={{ opacity: 1, y: 0 }}
		transition={{ duration: 0.5, delay: 0.4 }}
	>
		<h4
			className={cn(
				'flex items-center text-sm font-semibold',
				currentFileSize < initialFileSize && 'mb-3'
			)}
		>
			{optimizationStats.length > 0 ? (
				<>
					<CheckIcon className="mr-2 h-4 w-4 text-emerald-400" />
					Optimizations Applied
				</>
			) : (
				<>
					<FileQuestion className="mr-2 h-4 w-4 text-gray-400" />
					No optimizations applied yet
				</>
			)}
		</h4>
		<ul className="space-y-2">
			{optimizationStats.map((opt, index) => (
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
						{opt.name} size reduction
					</span>
					<span className="text-emerald-400">{opt.reduction}%</span>
				</motion.li>
			))}
		</ul>
	</motion.div>
)

// Optimization button component
const OptimizeButton: React.FC<OptimizeButtonProps> = ({
	onOptimize,
	isPending
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
					Apply Optimizations
				</>
			)}
		</Button>
	</div>
)

const OptimizeSidebarContent: React.FC = () => {
	const { optimize, on, off } = useModelContext()
	const {
		report,
		getSize,
		reset: resetOptimize,
		applyOptimization,
		optimizations
	} = optimize

	const [{ plannedOptimizations }] = useAtom(optimizationAtom)

	const [size, setSize] = useState<ModelSize | null>(null)
	const [initialCaptured, setInitialCaptured] = useState<boolean>(false)
	const [isPending, setIsPending] = useState<boolean>(false)

	const initialReports = useRef<InitialReportsRef>(null)

	// Reset function to reset all optimization state
	const reset = useCallback(() => {
		setSize(null)
		setInitialCaptured(false)
		resetOptimize?.()
		initialReports.current = null
	}, [resetOptimize])

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

	// Update size when report changes
	useEffect(() => {
		setSize(getSize?.() ?? null)
	}, [getSize, report])

	// Capture initial state
	useEffect(() => {
		if (!initialCaptured && report && size) {
			initialReports.current = { report, size }
			setInitialCaptured(true)
		}
	}, [initialCaptured, report, size])

	// Reset on model load
	useEffect(() => {
		on('load-start', reset)
		return () => off('load-start', reset)
	}, [off, on, reset])

	// Memoized calculations for model statistics
	const {
		initialTotals,
		currentTotals,
		percentageImprovements,
		optimizationStats
	} = useMemo(() => {
		const initial = initialReports.current

		// Initial stats
		const initialVerticesTotal = sumProperty<'vertices'>(
			initial?.report?.meshes?.properties as InspectMeshReport[],
			'vertices'
		)

		const initialPrimitivesTotal = sumProperty<'glPrimitives'>(
			initial?.report?.meshes?.properties as InspectMeshReport[],
			'glPrimitives'
		)

		const initialTexturesSizeTotal = sumProperty<'size'>(
			initial?.report?.textures?.properties as InspectTextureReport[],
			'size'
		)

		const initialFileSize = initial?.size?.fileSize || 0

		// Current stats
		const currentVerticesTotal = sumProperty<'vertices'>(
			report?.meshes?.properties as InspectMeshReport[],
			'vertices'
		)

		const currentPrimitivesTotal = sumProperty<'glPrimitives'>(
			report?.meshes?.properties as InspectMeshReport[],
			'glPrimitives'
		)

		const currentTexturesSizeTotal = sumProperty<'size'>(
			report?.textures?.properties as InspectTextureReport[],
			'size'
		)

		const currentFileSize = size?.fileSize || 0

		// Calculate improvements
		const improvements = {
			verticesCount: initialVerticesTotal - currentVerticesTotal,
			primitivesCount: initialPrimitivesTotal - currentPrimitivesTotal,
			texturesSize: initialTexturesSizeTotal - currentTexturesSizeTotal,
			totalSize: initialFileSize - currentFileSize
		}

		// Calculate percentage improvements
		const percentageImprovements = {
			verticesCount: calculatePercentageImprovement(
				improvements.verticesCount,
				initialVerticesTotal
			),
			primitivesCount: calculatePercentageImprovement(
				improvements.primitivesCount,
				initialPrimitivesTotal
			),
			texturesSize: calculatePercentageImprovement(
				improvements.texturesSize,
				initialTexturesSizeTotal
			),
			totalSize: calculatePercentageImprovement(
				improvements.totalSize,
				initialFileSize
			)
		}

		// Generate optimization stats
		const optimizationStats = Object.entries(percentageImprovements).reduce<
			OptimizationStat[]
		>((acc, [key, value]) => {
			if (value === 0) return acc

			if (
				key === 'texturesSize' &&
				!acc.find(({ name }) => name === 'texture')
			) {
				acc.push({ name: 'texture', reduction: value })
			}

			if (
				key === 'primitivesCount' &&
				!acc.find(({ name }) => name === 'mesh')
			) {
				acc.push({ name: 'mesh', reduction: value })
			}

			return acc
		}, [])

		return {
			initialTotals: {
				verticesTotal: initialVerticesTotal,
				primitivesTotal: initialPrimitivesTotal,
				texturesSizeTotal: initialTexturesSizeTotal,
				fileSize: initialFileSize
			} as ModelTotals,
			currentTotals: {
				verticesTotal: currentVerticesTotal,
				primitivesTotal: currentPrimitivesTotal,
				texturesSizeTotal: currentTexturesSizeTotal,
				fileSize: currentFileSize
			} as ModelTotals,
			improvements,
			percentageImprovements,
			optimizationStats
		}
	}, [report, size])

	return (
		<div className="flex h-full flex-col">
			<div className="no-scrollbar grow overflow-y-auto">
				<CardHeader className="py-6">
					<CardTitle>
						<motion.span
							className={cn(
								'font-bold',
								currentTotals.fileSize < initialTotals.fileSize
									? 'text-accent'
									: 'text-muted-foreground'
							)}
							initial={{ opacity: 0, y: -20 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ delay: 0.1, duration: 0.5 }}
						>
							{percentageImprovements.totalSize}%
						</motion.span>{' '}
						Optimized Scene Size
					</CardTitle>
					<CardDescription>Enhancement summary</CardDescription>
				</CardHeader>

				<Separator />

				<OptimizationStats
					optimizationStats={optimizationStats}
					initialFileSize={initialTotals.fileSize}
					currentFileSize={currentTotals.fileSize}
				/>

				<Accordion type="single" defaultValue="basic" collapsible>
					<AccordionItem value="basic" className="px-4">
						<AccordionTrigger className="px-2">
							<span className="flex items-center gap-2">
								<Star className="inline" size={12} />
								Optimization
							</span>
						</AccordionTrigger>
						<AccordionContent>
							<BasicOptimizationPanel />
						</AccordionContent>
					</AccordionItem>
					<AccordionItem value="advanced" className="px-4">
						<AccordionTrigger className="px-2">
							<span className="flex items-center gap-2">
								<Settings2 className="inline" size={12} />
								Advanced Optimization
							</span>
						</AccordionTrigger>
						<AccordionContent>
							<AdvancedPanel />
						</AccordionContent>
					</AccordionItem>
					<AccordionItem value="details" className="px-4">
						<AccordionTrigger className="px-2">
							<span className="flex items-center gap-2">
								<FileIcon className="inline" size={12} />
								Scene Details
							</span>
						</AccordionTrigger>
						<AccordionContent>
							<SceneDetails
								vertices={{
									initial: initialTotals.verticesTotal,
									current: currentTotals.verticesTotal
								}}
								primitives={{
									initial: initialTotals.primitivesTotal,
									current: currentTotals.primitivesTotal
								}}
								textures={{
									initial: initialTotals.texturesSizeTotal,
									current: currentTotals.texturesSizeTotal
								}}
							/>
						</AccordionContent>
					</AccordionItem>
				</Accordion>
			</div>

			<OptimizeButton onOptimize={handleOptimizeClick} isPending={isPending} />
		</div>
	)
}

export default OptimizeSidebarContent
