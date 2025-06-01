import { User } from '@supabase/supabase-js'
import { VectrealLogoAnimated } from '@vctrl-ui/assets/icons/vectreal-logo-animated'
import { Button } from '@vctrl-ui/ui/button'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger
} from '@vctrl-ui/ui/dropdown-menu'
import { cn } from '@vctrl-ui/utils'
import { AnimatePresence, motion, Variants } from 'framer-motion'
import { Sparkles } from 'lucide-react'
import { Link, useFetcher } from 'react-router'

const navVariants: Variants = {
	full: {
		margin: 0,
		borderBottomWidth: 1
	},
	float: {
		margin: '1rem 0.75rem 0 0.75rem',
		borderBottomWidth: 0
	}
}

const floatyNavVariants: Variants = {
	float: {
		borderRadius: '1rem',
		boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
		background: 'var(--background)',
		border: '1px solid var(--border)'
	},
	full: {
		borderRadius: '0',
		boxShadow: 'none',
		background: 'transparent',
		border: 'none'
	}
}

interface Props {
	pathname: string
	mode?: 'full' | 'float'
	user: User | null
}

export const Navigation = ({ mode, pathname, user }: Props) => {
	const isFloating = mode === 'float'
	const isSigninPage =
		pathname.startsWith('/sign-up') || pathname.startsWith('/sign-in')
	const isPublisherPage = pathname.startsWith('/publisher')

	const userImageSrc = user?.user_metadata?.avatar_url || ''

	const { submit } = useFetcher()

	async function handleLogout() {
		await submit(null, {
			method: 'get',
			action: '/auth/logout'
		})
	}

	return (
		<motion.nav
			layout="size"
			variants={navVariants}
			transition={{ duration: 0.5, ease: 'easeOut' }}
			initial={mode ? 'float' : 'full'}
			animate={isFloating ? 'float' : 'full'}
			className={cn(
				'bg-muted/40 fixed top-0 right-0 left-0 z-50 flex h-10 items-center justify-between px-4 md:h-12',
				isFloating
					? 'border-transparent bg-transparent'
					: 'border-accent/20 backdrop-blur-2xl'
			)}
		>
			<Link to="/" className="flex h-full items-center" viewTransition>
				<VectrealLogoAnimated
					className="text-muted-foreground h-5 md:h-6"
					colored={isFloating}
					small={mode !== 'float'}
				/>
			</Link>
			<motion.div
				variants={floatyNavVariants}
				transition={{ duration: 0.5, ease: 'easeOut' }}
				initial={mode ? 'float' : 'full'}
				animate={isFloating ? 'float' : 'full'}
				className={cn(
					'flex h-full items-center justify-center gap-2 p-2 px-1',
					isFloating && 'backdrop-blur-lg'
				)}
			>
				<AnimatePresence initial={false}>
					{!isSigninPage && !user && (
						<motion.div
							initial={{ opacity: 0, width: 0 }}
							animate={{ opacity: 1, width: 'auto' }}
							exit={{ opacity: 0, width: 0 }}
							transition={{ duration: 0.3, ease: 'easeInOut' }}
							className="overflow-hidden"
							key="sign-in-button"
						>
							<Link viewTransition to="/sign-up">
								<Button
									variant="ghost"
									className={cn(isFloating && 'rounded-lg')}
								>
									Sign Up For Free
								</Button>
							</Link>
						</motion.div>
					)}
					{!isPublisherPage && (
						<motion.div
							initial={{ opacity: 0, width: 0 }}
							animate={{ opacity: 1, width: 'auto' }}
							exit={{ opacity: 0, width: 0 }}
							transition={{ duration: 0.3, ease: 'easeInOut' }}
							className="overflow-hidden"
							key="publisher-button"
						>
							<Link viewTransition to="/publisher">
								<Button
									variant="ghost"
									className={cn(isFloating && 'rounded-lg')}
								>
									Go to Publisher
									<Sparkles />
								</Button>
							</Link>
						</motion.div>
					)}
					{user && (
						<DropdownMenu modal={false}>
							<DropdownMenuTrigger className="mr-1">
								{userImageSrc ? (
									<img
										src={userImageSrc}
										alt="User Avatar"
										className="border-muted h-8 w-8 rounded-lg border object-cover"
									/>
								) : (
									<div className="bg-muted flex h-8 w-8 items-center justify-center rounded-lg">
										{user.email?.charAt(0).toUpperCase() || '?'}
									</div>
								)}
							</DropdownMenuTrigger>
							<DropdownMenuContent
								side="bottom"
								className={cn('mt-2 min-w-64', isFloating ? 'mr-8' : 'mr-4')}
							>
								<DropdownMenuLabel>My Account</DropdownMenuLabel>
								<DropdownMenuSeparator />
								<DropdownMenuItem>Profile</DropdownMenuItem>
								<DropdownMenuItem>Billing</DropdownMenuItem>
								<DropdownMenuItem>Team</DropdownMenuItem>
								<DropdownMenuItem>Subscription</DropdownMenuItem>
								<DropdownMenuSeparator />
								<DropdownMenuItem onClick={handleLogout}>
									Log Out
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					)}
				</AnimatePresence>
			</motion.div>
		</motion.nav>
	)
}
