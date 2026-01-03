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
		<section className="overflow-hidden py-16">
			<div className="mx-auto w-full max-w-5xl px-4">
				<h3 className="mb-8 text-center">
					We offer a wide variety of file types and cloud integrations
				</h3>
			</div>

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
								className="bg-muted/50 flex h-[6.5rem] !w-auto flex-col justify-center border-none px-4 py-2"
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
				</div>
			</div>
		</section>
	)
}

export default FiletypeCarousel
