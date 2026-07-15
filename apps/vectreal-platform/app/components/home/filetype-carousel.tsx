'use client'

import { Card } from '@shared/components/ui/card'
import { motion } from 'framer-motion'

const fileTypes = [
	{ name: '.GLB', description: 'glTF Binary format' },
	{ name: '.GLTF', description: 'GL Transmission Format' },
	{ name: 'DRACO', description: 'glTF (with Draco compression)' },
	{ name: '.FBX', description: 'Autodesk FBX format' },
	{ name: '.OBJ', description: 'Wavefront Object format' },
	{ name: '.USDZ', description: 'Universal Scene Description format' }
]

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
