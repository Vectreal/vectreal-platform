import { LoadingSpinner } from '@shared/components/ui/loading-spinner'
import { SpinnerWrapper } from '@shared/components/ui/spinner-wrapper'
import { motion } from 'framer-motion'

const CenteredSpinner = () => {
	return (
		<SpinnerWrapper>
			<LoadingSpinner />
			<motion.p
				className="text-primary/75 font-light"
				initial={{ opacity: 0 }}
				animate={{ opacity: 1 }}
				exit={{ opacity: 0 }}
				transition={{ duration: 0.5 }}
			>
				Loading...
			</motion.p>
		</SpinnerWrapper>
	)
}

export default CenteredSpinner
