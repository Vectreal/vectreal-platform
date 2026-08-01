import { motion } from 'framer-motion'

import { EmbedOptionsPanel } from '../../../../embed/embed-options-panel'
import { itemVariants } from '../../animation'

import type { FC } from 'react'

interface EmbedOptionsProps {
	sceneId?: string
	projectId?: string
}

export const EmbedOptions: FC<EmbedOptionsProps> = ({ sceneId, projectId }) => {
	return (
		<motion.div variants={itemVariants} className="space-y-3 pb-4">
			<EmbedOptionsPanel sceneId={sceneId} projectId={projectId} />
		</motion.div>
	)
}
