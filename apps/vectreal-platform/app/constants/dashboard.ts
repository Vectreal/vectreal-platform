import { DashboardView, TitleContent } from '../components/dashboard'

/**
 * Static title content for different dashboard views
 */
export const TITLE_CONTENT: Record<DashboardView, TitleContent> = {
	dashboard: {
		title: 'Dashboard',
		description: 'Welcome to your dashboard'
	},
	projects: {
		title: 'Projects',
		description: 'Manage your projects and workspace environments'
	},
	organizations: {
		title: 'Organizations',
		description: 'Manage your organizations and teams'
	},
	settings: {
		title: 'Settings',
		description: 'Manage your account settings and preferences'
	}
} as const
