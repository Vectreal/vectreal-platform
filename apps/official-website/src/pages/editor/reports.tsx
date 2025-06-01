import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
	ArrowRightIcon,
	CheckIcon,
	CubeIcon,
	DashIcon,
	FileIcon,
	LayersIcon
} from '@radix-ui/react-icons'
import { Separator } from '@radix-ui/react-menubar'

import { useModelContext } from '@vctrl/hooks/use-load-model'
import { cn } from '@vctrl/@vctrl-ui/utils'
import {
	Card,
	CardContent,
	CardFooter,
	CardHeader
} from '@vctrl/shared/components'

import CloseButton from '../../components/modal-close-button'

/**
 * Format the file size for display.
 *
 * @param bytes - The size in bytes.
 * @returns A human-readable file size string.
 */
const formatFileSize = (bytes: number): string => {
	if (bytes >= 1024 * 1024) {
		return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
	} else if (bytes >= 1024) {
		return `${(bytes / 1024).toFixed(2)} KB`
	} else {
		return `${bytes} bytes`
	}
}

interface ReportsProps {
	show: boolean
	setShow: (showReports: boolean) => void
}

/**
 * A component to display the size and optimization reports.
 *
 * @param show - Whether or not to show the reports.
 * @param setShow - A function to set whether or not to show the reports.
 * @returns A JSX element that displays the size savings.
 */
const Reports = ({ show, setShow }: ReportsProps) => {
	const { optimize, on, off } = useModelContext()
	const { report, getSize, reset: resetOptimize } = optimize

	const [size, setSize] = useState<ReturnType<typeof getSize> | null>(null)
	const [initialCaptured, setInitialCaptured] = useState(false)
	const initialReports = useRef<{
		report: typeof report
		size: typeof size
	} | null>(null)

	/**
	 * Reset function to reset all optimization state.
	 */
	const reset = useCallback(() => {
		setSize(null)
		setShow(false)
		setInitialCaptured(false)
		resetOptimize()
		initialReports.current = null
	}, [setShow, resetOptimize])

	useEffect(() => {
		// Update the current size whenever the report changes
		setSize(getSize())
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
			reset()
		}
	}, [off, on, reset])

	if (!report) {
		return null
	}

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
	const optimizations = Object.entries(percentageImprovements).reduce(
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
		<AnimatePresence>
			{show && (
				<motion.div
					key={'optimization'}
					initial={{ opacity: 0, transform: `scale(0.95) translateY(-50%)` }}
					animate={{ opacity: 1, transform: `scale(1) translateY(-50%)` }}
					exit={{ opacity: 0, transform: `scale(0.95) translateY(-50%)` }}
					transition={{ duration: 0.2 }}
					className="fixed top-1/2 right-0 m-4"
				>
					<Card className="relative my-auto h-full w-full max-w-2xl overflow-hidden text-white">
						<CloseButton title="Close report" onClick={() => setShow(false)} />
						<CardHeader className="p-6">
							<div className="flex items-center justify-between gap-2">
								<div className="flex items-center space-x-4">
									<div>
										<h3 className="text-lg font-semibold">
											<motion.span
												className={cn(
													'font-bold',
													currentFileSize < initialFileSize
														? 'text-emerald-400'
														: 'text-gray-400'
												)}
												initial={{ opacity: 0, y: -20 }}
												animate={{ opacity: 1, y: 0 }}
												transition={{ delay: 0.1, duration: 0.5 }}
											>
												{percentageImprovements.totalSize}%
											</motion.span>{' '}
											Scene Optimization
										</h3>
										<p className="text-sm text-zinc-400">Enhancement summary</p>
									</div>
								</div>
							</div>
						</CardHeader>
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
										{optimizations.length > 0 ? (
											<>
												<CheckIcon className="mr-2 h-4 w-4 text-emerald-400" />
												Optimizations Applied
											</>
										) : (
											<>
												<DashIcon className="mr-2 h-4 w-4 text-gray-400" />
												No optimizations applied yet
											</>
										)}
									</h4>
									<ul className="space-y-2">
										{optimizations.map((opt, index) => (
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
						<Separator className="bg-zinc-700" />
						<CardFooter className="p-6">
							<div className="w-full space-y-4">
								<h4 className="text-lg font-semibold">Scene Overview</h4>
								<div className="grid grid-cols-2 gap-4">
									<div className="flex items-center space-x-2">
										<LayersIcon className="h-5 w-5 text-zinc-400" />
										<div>
											<p className="text-sm font-medium">Vertex Count</p>
											<p className="text-xs text-zinc-400">
												{initialVerticesTotal.toLocaleString()} →{' '}
												{currentVerticesTotal.toLocaleString()}
											</p>
										</div>
									</div>

									<div className="flex items-center space-x-2">
										<CubeIcon className="h-5 w-5 text-zinc-400" />
										<div>
											<p className="text-sm font-medium">GL Primitives</p>
											<p className="text-xs text-zinc-400">
												{initialPrimitivesTotal.toLocaleString()} →{' '}
												{currentPrimitivesTotal.toLocaleString()}
											</p>
										</div>
									</div>
									<div className="flex items-center space-x-2">
										<FileIcon className="h-5 w-5 text-zinc-400" />
										<div>
											<p className="text-sm font-medium">Textures Size</p>
											<p className="text-xs text-zinc-400">
												{formatFileSize(initialTexturesSizeTotal)} →{' '}
												{formatFileSize(currentTexturesSizeTotal)}
											</p>
										</div>
									</div>
								</div>
							</div>
						</CardFooter>
					</Card>
				</motion.div>
			)}
		</AnimatePresence>
	)
}

export default Reports
