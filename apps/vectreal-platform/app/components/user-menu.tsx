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

import { CONVERT_INDEX_PATH } from '../lib/convert/convert-pairs'
import { ACCOUNT } from '../lib/navigation/site-map'

interface UserMenuProps {
	user: User
	className?: string
	size?: 'sm' | 'md'
	onLogout: () => void
	sceneDetailsHref?: string
}

/** What to greet the reader by: their first name, else their email. */
export const userFirstName = (user: User) =>
	user.user_metadata?.full_name?.split(' ').at(0) ||
	user.user_metadata?.name?.split(' ').at(0) ||
	user.email

export function UserAvatar({
	user,
	size = 'md',
	className
}: {
	user: User
	size?: 'sm' | 'md'
	className?: string
}) {
	return (
		<Avatar
			className={cn(
				'rounded-lg',
				size === 'sm' ? 'h-7 w-7' : 'h-8 w-8',
				className
			)}
		>
			<AvatarImage
				className="rounded-lg"
				src={user.user_metadata?.avatar_url || ''}
				alt={user.user_metadata?.full_name || 'User Avatar'}
			/>
			<AvatarFallback className="rounded-lg">
				{user.user_metadata?.full_name?.charAt(0) || 'U'}
			</AvatarFallback>
		</Avatar>
	)
}

/**
 * UserMenu renders the user avatar and dropdown menu.
 */
export function UserMenu({
	user,
	size = 'md',
	className,
	onLogout,
	sceneDetailsHref
}: UserMenuProps) {
	const navigate = useNavigate()
	const [isClientMounted, setIsClientMounted] = useState(false)

	useEffect(() => {
		setIsClientMounted(true)
	}, [])

	async function handleMenuItemClick(to = '/dashboard') {
		await navigate(to, { viewTransition: true })
	}

	const avatar = <UserAvatar user={user} size={size} className={className} />

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
				<DropdownMenuLabel>Hey, {userFirstName(user)}!</DropdownMenuLabel>
				<DropdownMenuSeparator />
				<DropdownMenuItem onClick={() => handleMenuItemClick('/publisher')}>
					Publisher
				</DropdownMenuItem>
				{/* Beside the publisher, because this group is the tools and the converters are one. */}
				<DropdownMenuItem
					onClick={() => handleMenuItemClick(CONVERT_INDEX_PATH)}
				>
					Converters
				</DropdownMenuItem>
				<DropdownMenuSeparator />

				{sceneDetailsHref ? (
					<DropdownMenuItem
						onClick={() => handleMenuItemClick(sceneDetailsHref)}
					>
						Scene Details
					</DropdownMenuItem>
				) : null}
				{ACCOUNT.map((link) => (
					<DropdownMenuItem
						key={link.to}
						onClick={() => handleMenuItemClick(link.to)}
					>
						{link.label}
					</DropdownMenuItem>
				))}
				<DropdownMenuSeparator />
				<DropdownMenuItem onClick={onLogout}>Log Out</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	)
}
