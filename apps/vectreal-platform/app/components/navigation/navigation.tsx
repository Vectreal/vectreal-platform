import { VectrealLogoAnimated } from '@vctrl-ui/assets/icons/vectreal-logo-animated'
import { cn } from '@vctrl-ui/utils'
import { motion } from 'framer-motion'
import { Link } from 'react-router'

const navVariants = {
	full: {
		margin: 0,
		borderRadius: '0px'
	},
	float: {
		margin: '1rem 0.75rem 0 0.75rem',
		borderRadius: '25px'
	}
}

interface Props {
	isHomePage: boolean
	mode?: 'full' | 'float'
}

const Navigation = ({ isHomePage, mode }: Props) => {
	return (
		<motion.nav
			layout="size"
			variants={navVariants}
			transition={{ duration: 0.5, ease: 'easeOut' }}
			initial={isHomePage ? 'float' : 'full'}
			animate={mode === 'float' ? 'float' : 'full'}
			className={cn(
				'from-muted/75 to-muted/75 fled fixed top-0 right-0 left-0 z-50 h-10 items-center justify-center bg-linear-to-r p-2 px-4 shadow-md backdrop-blur-lg transition-colors md:h-12',
				mode === 'float'
					? 'via-accent/5 border-accent/25 border'
					: 'via-muted/50 border-muted/50 border-b'
			)}
		>
			<Link to="/" className="flex h-full items-center" viewTransition>
				<VectrealLogoAnimated
					className="text-muted-foreground h-5 md:h-6"
					colored={mode === 'float'}
					small={mode !== 'float'}
				/>
			</Link>
		</motion.nav>
	)
}

export default Navigation
