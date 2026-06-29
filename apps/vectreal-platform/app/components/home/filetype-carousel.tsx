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
		<section className="overflow-hidden">
			<div className="w-full">
				<div className="relative flex w-full gap-4 overflow-hidden px-2">
					{/* Gradient overlay */}
					<div className="from-background to-background pointer-events-none absolute bottom-0 left-0 z-10 h-[6.5rem] w-full bg-gradient-to-r via-transparent via-50%"></div>

					<motion.div
						className="flex gap-4 whitespace-nowrap"
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
								className="bg-surface-1 border-surface-border flex h-[6.5rem] !w-auto flex-col justify-center rounded-2xl border px-6 py-2"
							>
								<p className="whitespace-nowrap text-lg font-medium">
									{fileType.name}
								</p>
								<p className="text-muted-foreground whitespace-nowrap text-sm">
									{fileType.description}
								</p>
							</Card>
						))}
					</motion.div>
				</div>
			</div>
		</section>
	)
}

export default FiletypeCarousel
