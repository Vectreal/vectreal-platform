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
import { useCallback, useEffect, useRef, useState, useTransition } from 'react'

import { optimizationAtom } from '../../../../../lib/stores/publisher-config-store'

import { AdvancedPanel } from './advanced-optimization-panel'
import { BasicOptimizationPanel } from './basic-optimization-panel'
import SceneDetails from './scene-details'

const OptimizeSidebarContent = () => {
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
	const [initialCaptured, setInitialCaptured] = useState(false)
	const initialReports = useRef<{
		report: typeof report
		size: typeof size
	} | null>(null)

	const [isPending, startTransition] = useTransition()

	/**
	 * Reset function to reset all optimization state.
	 */
	const reset = useCallback(() => {
		setSize(null)
		setInitialCaptured(false)
		resetOptimize?.()
		initialReports.current = null
	}, [resetOptimize])

	const handleOptimizeClick = useCallback(() => {
		// Disable the button to prevent multiple clicks
		startTransition(async () => {
			try {
				const optimizationOptions = Object.values(plannedOptimizations).filter(
					(option) => option.enabled
				)

				let currentIndex = 0

				// Process one optimization per animation frame
				const processNextOptimization = async () => {
					if (currentIndex >= optimizationOptions.length) {
						// All optimizations complete, apply changes
						await applyOptimization()
						console.log('optimizations applied successfully')
						return
					}

					const option = optimizationOptions[currentIndex++]

					try {
						// Apply single optimization
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

						// Schedule next optimization
						requestAnimationFrame(() => {
							setTimeout(processNextOptimization, 0)
						})
					} catch (error) {
						console.error(`Error processing ${option.name}:`, error)
					}
				}

				// Start the process
				processNextOptimization()
			} catch (error) {
				console.error('Error during optimization:', error)
			}
		})
	}, [applyOptimization, optimizations, plannedOptimizations])

	useEffect(() => {
		// Update the current size whenever the report changes
		setSize(getSize?.() ?? null)
	}, [getSize, report])

	useEffect(() => {
		// Capture the initial report and size before any optimizations
		if (!initialCaptured && report && size) {
			initialReports.current = { report, size }
			setInitialCaptured(true)
		}
	}, [initialCaptured, report, size])

	useEffect(() => {
		// Reset the optimization state when a new model is loaded
		on('load-start', reset)

		return () => {
			off('load-start', reset)
		}
	}, [off, on, reset])

	// Retrieve the initial reports and sizes
	const initial = initialReports.current

	/**
	 * Helper function to sum a specific property over an array of objects.
	 *
	 * @param items - Array of objects with a numeric property.
	 * @param property - Name of the property to sum.
	 * @returns Sum of the property values.
	 */
	const sumProperty = <K extends string>(
		items: Record<K, number>[],
		property: K
	): number => items.reduce((total, item) => total + (item[property] || 0), 0)

	// Safely retrieve the initial totals
	const initialVerticesTotal = initial?.report?.meshes?.properties
		? sumProperty(initial.report.meshes.properties, 'vertices')
		: 0

	const initialPrimitivesTotal = initial?.report?.meshes?.properties
		? sumProperty(initial.report.meshes.properties, 'glPrimitives')
		: 0

	const initialTexturesSizeTotal = initial?.report?.textures?.properties
		? sumProperty(initial.report.textures.properties, 'size')
		: 0

	const initialFileSize = initial?.size?.fileSize || 0

	// Safely retrieve the current totals
	const currentVerticesTotal = report?.meshes?.properties
		? sumProperty(report.meshes.properties, 'vertices')
		: 0

	const currentPrimitivesTotal = report?.meshes?.properties
		? sumProperty(report.meshes.properties, 'glPrimitives')
		: 0

	const currentTexturesSizeTotal = report?.textures?.properties
		? sumProperty(report.textures.properties, 'size')
		: 0

	const currentFileSize = size?.fileSize || 0

	// Calculate the improvements
	const improvements = {
		verticesCount: initialVerticesTotal - currentVerticesTotal,
		primitivesCount: initialPrimitivesTotal - currentPrimitivesTotal,
		texturesSize: initialTexturesSizeTotal - currentTexturesSizeTotal,
		totalSize: initialFileSize - currentFileSize
	}

	/**
	 * Calculate the percentage improvement.
	 *
	 * @param improvement - The absolute improvement (positive or negative).
	 * @param initialTotal - The initial total value.
	 * @returns The percentage improvement (a value between -100 and 100).
	 */
	const calculatePercentageImprovement = (
		improvement: number,
		initialTotal: number
	): number => {
		if (initialTotal === 0) {
			// Avoid division by zero; if initial total is zero, return 0% improvement
			return 0
		}
		return Math.round((improvement / initialTotal) * 100)
	}

	// Calculate the percentage improvements
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

	/**
	 * An array of optimizations based on the percentage improvements.
	 * If an optimization has a value of 0 (no improvement), skip it.
	 * If an optimization has a value greater than 0, add it to the array with the name:
	 * - 'mesh' for mesh optimizations
	 * - 'texture' for texture optimizations
	 * @param percentageImprovements - The percentage improvements
	 * @returns An array of optimizations with the name and reduction percentage
	 */
	const optimizationStats = Object.entries(percentageImprovements).reduce(
		(acc, [key, value]) => {
			if (value === 0) return acc

			// Check if the optimization is a mesh or texture optimization
			// and add it to the array only if it's not already there
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
		},
		[] as { name: 'mesh' | 'texture'; reduction: number }[]
	)

	return (
		<div className="flex h-full flex-col">
			<div className="grow overflow-y-auto">
				<CardHeader className="py-6">
					<CardTitle>
						<motion.span
							className={cn(
								'font-bold',
								currentFileSize < initialFileSize
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

				{!!optimizationStats.length && (
					<>
						<CardContent className="p-6">
							<div className="space-y-6">
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
												<span className="text-emerald-400">
													{opt.reduction}%
												</span>
											</motion.li>
										))}
									</ul>
								</motion.div>
							</div>
						</CardContent>

						<Separator />
					</>
				)}

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
									initial: initialVerticesTotal,
									current: currentVerticesTotal
								}}
								primitives={{
									initial: initialPrimitivesTotal,
									current: currentPrimitivesTotal
								}}
								textures={{
									initial: initialTexturesSizeTotal,
									current: currentTexturesSizeTotal
								}}
							/>
						</AccordionContent>
					</AccordionItem>
				</Accordion>
			</div>
			<div className="bg-muted/50">
				<Button
					variant="ghost"
					className="w-full rounded-none border-t"
					onClick={handleOptimizeClick}
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
		</div>
	)
}

export default OptimizeSidebarContent
