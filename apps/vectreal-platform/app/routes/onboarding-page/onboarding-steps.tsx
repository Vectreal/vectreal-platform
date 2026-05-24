/**
 * Step definitions and motion variants for the onboarding flow.
 *
 * Steps collect optional profile data that helps personalize the experience.
 * All fields are nullable - any step can be skipped.
 */

// ─── Profile data shape ───────────────────────────────────────────────────────

export interface OnboardingProfile {
	role: string | null
	useCase: string | null
	companyName: string | null
	referralSource: string | null
}

export type OnboardingProfileKey = keyof OnboardingProfile

// ─── Step types ───────────────────────────────────────────────────────────────

export interface PillOption {
	value: string
	label: string
}

interface BaseStep {
	id: number
	title: string
	tagline: string
	fieldKey: OnboardingProfileKey
}

export interface PillStep extends BaseStep {
	inputType: 'pills'
	options: ReadonlyArray<PillOption>
}

export interface TextStep extends BaseStep {
	inputType: 'text'
	placeholder: string
}

export type OnboardingStep = PillStep | TextStep

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
		title: 'Tell us about yourself.',
		tagline: 'This helps us tailor the experience for you.',
		fieldKey: 'role',
		inputType: 'pills',
		options: [
			{ value: 'developer', label: 'Developer' },
			{ value: 'designer', label: 'Designer' },
			{ value: '3d_artist', label: '3D Artist' },
			{ value: 'marketer', label: 'Marketer' },
			{ value: 'other', label: 'Other' }
		]
	},
	{
		id: 1,
		title: 'How are you planning to use Vectreal?',
		tagline: 'No wrong answers - just helps us prioritise what matters to you.',
		fieldKey: 'useCase',
		inputType: 'pills',
		options: [
			{ value: 'personal', label: 'Personal / Hobby' },
			{ value: 'small_business', label: 'Small Business' },
			{ value: 'agency_studio', label: 'Agency or Studio' },
			{ value: 'enterprise', label: 'Enterprise' }
		]
	},
	{
		id: 2,
		title: 'What\u2019s your team or company name?',
		tagline: 'Optional \u2014 skip if you\u2019re flying solo.',
		fieldKey: 'companyName',
		inputType: 'text',
		placeholder: 'Acme Inc.'
	},
	{
		id: 3,
		title: 'How did you hear about us?',
		tagline: 'We appreciate you finding us.',
		fieldKey: 'referralSource',
		inputType: 'pills',
		options: [
			{ value: 'social_media', label: 'Social Media' },
			{ value: 'word_of_mouth', label: 'Word of Mouth' },
			{ value: 'search', label: 'Search' },
			{ value: 'ad', label: 'Ad' },
			{ value: 'developer_community', label: 'Dev Community' },
			{ value: 'other', label: 'Other' }
		]
	}
]
