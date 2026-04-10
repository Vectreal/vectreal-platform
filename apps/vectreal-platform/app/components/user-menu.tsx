import { Button } from '@shared/components'
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
import { useEffect, useState } from 'react'
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
	const [isClientMounted, setIsClientMounted] = useState(false)
	const userImageSrc = user?.user_metadata?.avatar_url || ''
	const userInitial = user.user_metadata?.full_name?.charAt(0) || 'U'

	useEffect(() => {
		setIsClientMounted(true)
	}, [])

	async function handleMenuItemClick(to = '/dashboard') {
		await navigate(to, { viewTransition: true })
	}

	const avatar = (
		<Avatar
			className={cn(
				'rounded-lg',
				{
					'h-7 w-7 rounded-lg': size === 'sm',
					'h-8 w-8': size === 'md' || !size
				},
				className
			)}
		>
			<AvatarImage
				className={cn('rounded-lg', {
					'rounded-lg': size === 'sm'
				})}
				src={userImageSrc}
				alt={user.user_metadata?.full_name || 'User Avatar'}
			/>
			<AvatarFallback
				className={cn('rounded-lg', { 'rounded-lg': size === 'sm' })}
			>
				{userInitial}
			</AvatarFallback>
		</Avatar>
	)

	if (!isClientMounted) {
		return (
			<Button
				size="icon"
				variant="secondary"
				type="button"
				aria-label="Open user menu"
				disabled
			>
				{avatar}
			</Button>
		)
	}

	return (
		<DropdownMenu modal={false}>
			<DropdownMenuTrigger asChild aria-label="Open user menu">
				<Button size="icon" variant="secondary" type="button">
					{avatar}
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent side="bottom" className="ml-4 min-w-64 capitalize">
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
