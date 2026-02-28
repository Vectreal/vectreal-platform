import { motion } from 'framer-motion'
import { useAtom } from 'jotai'
import { useEffect, useState, type FC } from 'react'

import { BasicCard } from '../../../../../components/layout-components'
import { sceneMetaAtom } from '../../../../../lib/stores/publisher-config-store'

export const ScenePreview: FC = () => {
	const [isLoading, setIsLoading] = useState(true)
	const [sceneMeta] = useAtom(sceneMetaAtom)
	const thumbnailUrl = sceneMeta.thumbnailUrl

	useEffect(() => {
		// Simulate loading of preview
		const timer = setTimeout(() => {
			setIsLoading(false)
		}, 800)

		return () => clearTimeout(timer)
	}, [])

	return (
		<div className="p-4">
			<motion.div
				initial={{ opacity: 0, y: 10 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ duration: 0.4 }}
			>
				<BasicCard highlight={false} cardClassNames="py-0! overflow-clip">
					<div className="relative aspect-video w-full">
						{isLoading ? (
							<div className="absolute inset-0 flex items-center justify-center">
								<div className="border-accent h-8 w-8 animate-spin rounded-full border-b-2"></div>
							</div>
						) : (
							<div className="absolute inset-0 flex items-center justify-center bg-gradient-to-tr from-zinc-900/20 to-zinc-900/5">
								<img
									src={thumbnailUrl || ''}
									alt="Scene Preview"
									className="h-full w-full object-cover"
									loading="lazy"
								/>
							</div>
						)}
					</div>
				</BasicCard>
				<div className="text-muted-foreground mt-4 text-xs">
					Preview of how your scene will appear when published
				</div>
			</motion.div>
		</div>
	)
}
