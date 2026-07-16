import type { User } from '@supabase/supabase-js'

export interface NavItem {
	label: string
	to: string
	icon: React.ReactNode
	external?: boolean
}

export interface NavigationProps {
	user: User | null
	isMobileRequest?: boolean
}
