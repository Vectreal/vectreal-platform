import { usePostHog } from '@posthog/react'
import { VectrealLogoAnimated } from '@shared/components/assets/icons/vectreal-logo-animated'
import { useIsMobile } from '@shared/components/hooks/use-mobile'
import { Button } from '@shared/components/ui/button'
import { User } from '@supabase/supabase-js'
import { AnimatePresence, motion } from 'framer-motion'
import { BookOpen, ListTreeIcon, LogIn, Rocket } from 'lucide-react'
import { Link, useFetcher, useLocation } from 'react-router'

import { FloatingPillWrapper } from './layout-components'
import { UserMenu } from './user-menu'

interface NavigationProps {
	user: User | null
	isMobile: boolean
}

/**
 * Navigation is the main navigation bar for the app shell.
 */
export const Navigation = ({ user }: NavigationProps) => {
	const { pathname } = useLocation()
	const isMobile = useIsMobile()
	const isSigninPage =
		pathname.startsWith('/sign-up') || pathname.startsWith('/sign-in')
	const isPublisherPage = pathname.startsWith('/publisher')
	const isDocsPage = pathname.startsWith('/docs')

	const { submit } = useFetcher()
	const posthog = usePostHog()

	async function handleLogout() {
		posthog?.reset()
		await submit(null, {
			method: 'post',
			action: '/auth/logout'
		})
	}

	return (
		<nav
			className="fixed top-0 right-0 left-0 z-50 flex justify-between p-2"
			aria-label="Main navigation"
		>
			<FloatingPillWrapper>
				<Link
					to="/"
					className="flex h-full items-center px-4"
					viewTransition
					aria-label="Home"
				>
					<VectrealLogoAnimated
						className="text-muted-foreground h-5 md:h-7"
						colored
						// small
					/>
				</Link>
			</FloatingPillWrapper>

			<FloatingPillWrapper>
				<AnimatePresence initial={false}>
					{!isSigninPage && !user && (
						<motion.div
							initial={{ opacity: 0, width: 0 }}
							animate={{ opacity: 1, width: 'auto' }}
							exit={{ opacity: 0, width: 0 }}
							transition={{ duration: 0.3, ease: 'easeInOut' }}
							className="mr-2 overflow-hidden"
							key="sign-in-button"
						>
							<Button asChild variant="ghost" size="sm">
								<Link viewTransition to="/sign-up" aria-label="Sign up">
									<LogIn />
									Sign In
								</Link>
							</Button>
						</motion.div>
					)}
					{!isMobile && !isDocsPage && (
						<motion.div
							initial={{ opacity: 0, width: 0 }}
							animate={{ opacity: 1, width: 'auto' }}
							exit={{ opacity: 0, width: 0 }}
							transition={{ duration: 0.3, ease: 'easeInOut' }}
							className="mr-2 overflow-hidden"
							key="docs-button"
						>
							<Button asChild variant="ghost" size="sm">
								<Link
									viewTransition
									to="/docs"
									aria-label="Read the documentation"
								>
									<BookOpen />
									Docs
								</Link>
							</Button>
						</motion.div>
					)}
					{!isPublisherPage && (
						<motion.div
							initial={{ opacity: 0, width: 0 }}
							animate={{ opacity: 1, width: 'auto' }}
							exit={{ opacity: 0, width: 0 }}
							transition={{ duration: 0.3, ease: 'easeInOut' }}
							className="mr-2 overflow-hidden"
							key="publisher-button"
						>
							<Button asChild variant="ghost" size="sm">
								<Link
									viewTransition
									to="/publisher"
									aria-label="Go to Publisher"
								>
									<Rocket />
									Start Publishing
								</Link>
							</Button>
						</motion.div>
					)}
					{!isMobile && user && (
						<motion.div
							initial={{ opacity: 0, width: 0 }}
							animate={{ opacity: 1, width: 'auto' }}
							exit={{ opacity: 0, width: 0 }}
							transition={{ duration: 0.3, ease: 'easeInOut' }}
							className="mr-2 overflow-hidden"
							key="dashboard-button"
						>
							<Button asChild variant="ghost" size="sm">
								<Link
									viewTransition
									to="/dashboard"
									aria-label="Go to Dashboard"
								>
									<ListTreeIcon />
									Dashboard
								</Link>
							</Button>
						</motion.div>
					)}

					{user && <UserMenu user={user} onLogout={handleLogout} />}
				</AnimatePresence>
			</FloatingPillWrapper>
		</nav>
	)
}
