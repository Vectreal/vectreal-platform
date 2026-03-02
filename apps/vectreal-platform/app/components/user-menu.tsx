import {
	Avatar,
	AvatarFallback,
	AvatarImage
} from '@shared/components/ui/avatar'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger
} from '@shared/components/ui/dropdown-menu'
import { cn } from '@shared/utils'
import { User } from '@supabase/supabase-js'
import { useNavigate } from 'react-router'

interface UserMenuProps {
	user: User
	className?: string
	size?: 'sm' | 'md'
	onLogout: () => void
}

/**
 * UserMenu renders the user avatar and dropdown menu.
 */
export function UserMenu({
	user,
	size = 'md',
	className,
	onLogout
}: UserMenuProps) {
	const navigate = useNavigate()
	const userImageSrc = user?.user_metadata?.avatar_url || ''
	const userInitial = user.user_metadata?.full_name?.charAt(0) || 'U'

	async function handleMenuItemClick(to = '/dashboard') {
		await navigate(to, { viewTransition: true })
	}

	return (
		<DropdownMenu modal={false}>
			<DropdownMenuTrigger aria-label="Open user menu">
				<Avatar
					className={cn(
						'rounded-xl',
						{
							'h-7 w-7': size === 'sm',
							'h-8 w-8': size === 'md' || !size
						},
						className
					)}
				>
					<AvatarImage
						className="rounded-xl"
						src={userImageSrc}
						alt={user.user_metadata?.full_name || 'User Avatar'}
					/>
					<AvatarFallback className="rounded-xl">{userInitial}</AvatarFallback>
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
