import { OptimizationInfo } from '@vctrl/hooks/use-optimize-model'
import { Eye, Grid, Image, Layers, Settings2, Zap } from 'lucide-react'

export type OptimizationStat = {
	name: 'vertices' | 'primitives' | 'mesh' | 'texture' | 'scene'
	unit: 'size' | 'count'
	reduction: number
}

// Helper function to format optimization names for display
export const formatOptimizationName = (optimization: string): string => {
	// Convert to title case and handle special cases
	return optimization
		.split(' ')
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join(' ')
}

// Helper function to get optimization icon
export const getOptimizationIcon = (optimization: string) => {
	const iconMap: Record<
		string,
		React.ComponentType<{ className?: string; size?: number }>
	> = {
		simplification: Layers,
		'texture compression': Image,
		'basic texture optimization': Image,
		quantization: Grid,
		deduplication: Zap,
		'normals optimization': Eye
	}

	const IconComponent = iconMap[optimization.toLowerCase()] || Settings2
	return IconComponent
}

// Helper function to get optimization details
export const getOptimizationDetails = (
	optimization: string
): { description: string; benefit: string } => {
	const details: Record<string, { description: string; benefit: string }> = {
		simplification: {
			description: 'Reduced polygon count while preserving shape',
			benefit: 'Faster rendering and smaller file size'
		},
		'texture compression': {
			description: 'Compressed and optimized texture files',
			benefit: 'Reduced memory usage and faster loading'
		},
		'basic texture optimization': {
			description: 'Applied basic texture cleanup and deduplication',
			benefit: 'Smaller file size with maintained quality'
		},
		quantization: {
			description: 'Reduced precision of vertex attributes',
			benefit: 'Smaller file size with minimal visual impact'
		},
		deduplication: {
			description: 'Removed duplicate vertices and resources',
			benefit: 'Eliminated redundancy for smaller files'
		},
		'normals optimization': {
			description: 'Recalculated and optimized normal vectors',
			benefit: 'Improved lighting with reduced data'
		}
	}

	return (
		details[optimization.toLowerCase()] || {
			description: 'Applied optimization technique',
			benefit: 'Improved performance and efficiency'
		}
	)
}

// Helper function to map optimization names to stat names for percentage display
export const getOptimizationStatMapping = (
	optimization: string
): ('vertices' | 'primitives' | 'mesh' | 'texture' | 'scene')[] => {
	const mappings: Record<
		string,
		('vertices' | 'primitives' | 'mesh' | 'texture' | 'scene')[]
	> = {
		simplification: ['vertices', 'primitives'],
		'texture compression': ['texture'],
		'basic texture optimization': ['texture'],
		quantization: ['vertices'],
		deduplication: ['mesh', 'texture'],
		'normals optimization': ['mesh']
	}

	return mappings[optimization.toLowerCase()] || []
}

export const calculateOptimizationStats = (
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
