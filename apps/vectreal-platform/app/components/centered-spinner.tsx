import { LoadingSpinner } from '@shared/components/ui/loading-spinner'
import { SpinnerWrapper } from '@shared/components/ui/spinner-wrapper'
import { motion } from 'framer-motion'
import { PropsWithChildren } from 'react'

interface CenteredSpinnerProps extends PropsWithChildren {
	text?: string
	className?: string
}

const CenteredSpinner = ({
	children,
	className,
	text = 'Loading...'
}: CenteredSpinnerProps) => {
	return (
		<SpinnerWrapper className={className}>
			<LoadingSpinner />
			<motion.span
				key="loading-text"
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
