'use client'

import { Card } from '@shared/components/ui/card'
import { MODEL_FORMATS, type ModelFormatId } from '@vctrl/core/model-formats'
import { motion } from 'framer-motion'

/**
 * What each format is, for the one visitor in ten who does not already know.
 *
 * Keyed by format id so the carousel cannot advertise something the loader does
 * not read, and cannot omit something it does. Both happened: `.FBX` and `.OBJ`
 * were filed as false claims for years and are true now, while STL - which has
 * loaded since this changeset - was missing, and `DRACO` sat in the list as a
 * sixth format although it is a compression scheme applied to glTF.
 */
const FORMAT_DESCRIPTIONS: Record<ModelFormatId, string> = {
	glb: 'glTF Binary format',
	gltf: 'GL Transmission Format',
	usdz: 'Universal Scene Description format',
	stl: 'Stereolithography format',
	fbx: 'Autodesk FBX format',
	obj: 'Wavefront Object format'
}

const fileTypes = MODEL_FORMATS.filter((format) => format.canImport).map(
	(format) => ({
		name: `.${format.label.toUpperCase()}`,
		description: FORMAT_DESCRIPTIONS[format.id]
	})
)

// Doubling the content array for seamless looping
const loopedFileTypes = [...fileTypes, ...fileTypes]

const FiletypeCarousel = () => {
	return (
		<section className="relative overflow-hidden">
			{/* Edge-only fade masks */}
			<div className="from-background pointer-events-none absolute inset-y-0 left-0 z-10 w-24 bg-linear-to-r to-transparent" />
			<div className="from-background pointer-events-none absolute inset-y-0 right-0 z-10 w-24 bg-linear-to-l to-transparent" />

			<motion.div
				className="flex w-max gap-4"
				initial={{ x: '0%' }}
				animate={{ x: '-50%' }}
				transition={{
					repeat: Infinity,
					duration: 30,
					ease: 'linear'
				}}
			>
				{loopedFileTypes.map((fileType, index) => (
					<Card
						key={index}
						className="bg-surface-1 border-surface-border flex h-24 min-w-56 shrink-0 flex-col justify-center rounded-2xl border px-6 py-2"
					>
						<p className="text-lg font-medium whitespace-nowrap">
							{fileType.name}
						</p>
						<p className="text-muted-foreground text-sm whitespace-nowrap">
							{fileType.description}
						</p>
					</Card>
				))}
			</motion.div>
		</section>
	)
}

export default FiletypeCarousel
