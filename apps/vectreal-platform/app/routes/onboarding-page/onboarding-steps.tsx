/**
 * Step data, types, and motion variants for the onboarding page.
 */
import { Code2, Compass, Globe, Layers } from 'lucide-react'

import {
	DashboardVisual,
	PublishVisual,
	UploadVisual,
	WelcomeVisual
} from './onboarding-visuals'

import type { LucideIcon } from 'lucide-react'
import type { ComponentType } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DocLink {
	label: string
	to: string
	description: string
	icon: LucideIcon
}

export interface OnboardingStep {
	id: number
	title: string
	tagline: string
	docLink: DocLink
	Visual: ComponentType
}

// ─── Motion variants ──────────────────────────────────────────────────────────

export const CONTENT_VARIANTS = {
	enter: (dir: number) => ({
		x: dir > 0 ? 48 : -48,
		opacity: 0
	}),
	center: {
		x: 0,
		opacity: 1,
		transition: {
			x: { type: 'spring', stiffness: 260, damping: 28 },
			opacity: { duration: 0.22 }
		}
	},
	exit: (dir: number) => ({
		x: dir > 0 ? -48 : 48,
		opacity: 0,
		transition: {
			x: { type: 'spring', stiffness: 260, damping: 28 },
			opacity: { duration: 0.18 }
		}
	})
} as const

export const VISUAL_VARIANTS = {
	enter: { scale: 1.02, opacity: 0 },
	center: {
		scale: 1,
		opacity: 1,
		transition: {
			duration: 0.35,
			ease: [0.16, 1, 0.3, 1] as [number, number, number, number]
		}
	},
	exit: {
		scale: 0.97,
		opacity: 0,
		transition: { duration: 0.25 }
	}
} as const

// ─── Steps data ───────────────────────────────────────────────────────────────

export const STEPS: OnboardingStep[] = [
	{
		id: 0,
		title: 'Welcome to Vectreal',
		tagline:
			'An open platform for preparing, managing, and publishing 3D content for the web — built for creators.',
		docLink: {
			label: 'Quick start guide',
			to: '/docs/getting-started/first-model',
			description: 'Up and running in 5 minutes',
			icon: Compass
		},
		Visual: WelcomeVisual
	},
	{
		id: 1,
		title: 'Meet the Publisher',
		tagline:
			'The Publisher is your 3D canvas. Drag any model file onto it — GLB, glTF, OBJ, USDZ or FBX — and start editing.',
		docLink: {
			label: 'Publisher overview',
			to: '/docs/guides/upload',
			description: 'Drag, drop, and edit 3D models',
			icon: Layers
		},
		Visual: UploadVisual
	},
	{
		id: 2,
		title: 'Publish to the Web',
		tagline:
			'One click delivers your scene to our global CDN. Embed it anywhere with the generated iframe or script snippet.',
		docLink: {
			label: 'Optimize guide',
			to: '/docs/guides/optimize',
			description: 'Tune quality before pushing live',
			icon: Globe
		},
		Visual: PublishVisual
	},
	{
		id: 3,
		title: 'Your Dashboard',
		tagline:
			'Manage every scene and project from a single place. Invite teammates, track analytics, and keep everything organised.',
		docLink: {
			label: 'Embed options',
			to: '/docs/guides/publish-embed',
			description: 'iframe, script, and link formats',
			icon: Code2
		},
		Visual: DashboardVisual
	}
]
