import type { ModelIntakeLocale } from '../lib/domain/model-intake/model-intake-shared'

/**
 * The letter funnel's own header and footer (`IntakeHeader`, `IntakeFooter`).
 * Its own module rather than `MODEL_INTAKE_COPY`, because the nav layout
 * renders them and every route below it would otherwise load the form's copy.
 */
export const MODEL_INTAKE_CHROME_COPY: Record<
	ModelIntakeLocale,
	{
		/** Switches to the other language; the letter code and batch are kept. */
		languageLink: string
		home: string
		imprint: string
		privacy: string
		cookies: string
	}
> = {
	en: {
		languageLink: 'Deutsch',
		home: 'Vectreal home',
		imprint: 'Imprint',
		privacy: 'Privacy',
		cookies: 'Cookie settings'
	},
	de: {
		languageLink: 'English',
		home: 'Vectreal Startseite',
		imprint: 'Impressum',
		privacy: 'Datenschutz',
		cookies: 'Cookie-Einstellungen'
	}
}
