import { LoadingSpinner } from '@shared/components/ui/loading-spinner'
import { SpinnerWrapper } from '@shared/components/ui/spinner-wrapper'
import { motion } from 'framer-motion'
import { PropsWithChildren, useId } from 'react'

interface CenteredSpinnerProps extends PropsWithChildren {
	text?: string
}

const CenteredSpinner = ({
	children,
	text = 'Loading...'
}: CenteredSpinnerProps) => {
	const id = useId()
	return (
		<SpinnerWrapper>
			<LoadingSpinner />
			<motion.span
				key="centered-spinner-text"
				layoutId={id}
				className="text-primary/75 text-center font-light"
				initial={{ opacity: 0 }}
				animate={{ opacity: 1 }}
				exit={{ opacity: 0 }}
				transition={{ duration: 0.5 }}
			>
				{children ?? text}
			</motion.span>
		</SpinnerWrapper>
	)
}

export default CenteredSpinner
