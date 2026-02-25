import { VectrealLogoAnimated } from '@shared/components/assets/icons/vectreal-logo-animated'
import { useIsMobile } from '@shared/components/hooks/use-mobile'
import {
	Avatar,
	AvatarFallback,
	AvatarImage
} from '@shared/components/ui/avatar'
import { Button } from '@shared/components/ui/button'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger
} from '@shared/components/ui/dropdown-menu'
import { User } from '@supabase/supabase-js'
import { AnimatePresence, motion } from 'framer-motion'
import { ListTreeIcon, Rocket } from 'lucide-react'
import { PropsWithChildren } from 'react'
import { Link, useFetcher, useLocation, useNavigate } from 'react-router'

interface NavigationProps {
	user: User | null
	isMobile: boolean
}

/**
 * UserMenu renders the user avatar and dropdown menu.
 */
function UserMenu({ user, onLogout }: { user: User; onLogout: () => void }) {
	const navigate = useNavigate()
	const userImageSrc = user?.user_metadata?.avatar_url || ''
	const userInitial = user.user_metadata?.full_name?.charAt(0) || 'U'

	async function handleMenuItemClick(to = '/dashboard') {
		await navigate(to, { viewTransition: true })
	}

	return (
		<DropdownMenu modal={false}>
			<DropdownMenuTrigger aria-label="Open user menu">
				<Avatar className="h-8 w-8 rounded-lg">
					<AvatarImage
						className="rounded-lg"
						src={userImageSrc}
						alt={user.user_metadata?.full_name || 'User Avatar'}
					/>
					<AvatarFallback className="rounded-lg">{userInitial}</AvatarFallback>
				</Avatar>
			</DropdownMenuTrigger>
			<DropdownMenuContent side="bottom" className="mr-4 min-w-64 capitalize">
				<DropdownMenuLabel>
					Hey, {user.user_metadata?.full_name.split(' ').at(0) || user.email}!
				</DropdownMenuLabel>
				<DropdownMenuSeparator />
				<DropdownMenuItem onClick={() => handleMenuItemClick('/publisher')}>
					Publisher
				</DropdownMenuItem>
				<DropdownMenuSeparator />

				<DropdownMenuItem onClick={() => handleMenuItemClick('/dashboard')}>
					Dashboard
				</DropdownMenuItem>
				<DropdownMenuItem
					onClick={() => handleMenuItemClick('/dashboard/projects')}
				>
					Projects
				</DropdownMenuItem>
				<DropdownMenuItem
					onClick={() => handleMenuItemClick('/dashboard/organizations')}
				>
					Organizations
				</DropdownMenuItem>
				<DropdownMenuItem
					onClick={() => handleMenuItemClick('/dashboard/settings')}
				>
					Settings
				</DropdownMenuItem>
				<DropdownMenuSeparator />
				<DropdownMenuItem onClick={onLogout}>Log Out</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	)
}

const FloatPillContainer = ({ children }: PropsWithChildren) => {
	return (
		<div className="bg-background/50 flex w-fit items-center justify-between rounded-3xl p-2 shadow-2xl backdrop-blur-2xl">
			{children}
		</div>
	)
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

	const { submit } = useFetcher()

	async function handleLogout() {
		await submit(null, {
			method: 'get',
			action: '/auth/logout'
		})
	}

	return (
		<nav
			className="fixed top-0 right-0 left-0 z-50 flex justify-between p-2"
			aria-label="Main navigation"
		>
			<FloatPillContainer>
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
			</FloatPillContainer>

			<FloatPillContainer>
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
									Sign In
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
									Visit Publisher
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
			</FloatPillContainer>
		</nav>
	)
}
