import type { ModelIntakeLocale } from '../lib/domain/model-intake/model-intake-shared'

/**
 * The agency's confirmation of its client's OK, shown on agency letters only.
 * Its own module rather than `MODEL_INTAKE_COPY`, because `product-copy.ts`
 * reaches every marketing page and those routes sit at their JS budget.
 * Placeholder wording until Moritz approves it.
 */
export const MODEL_INTAKE_CLIENT_CONSENT_COPY: Record<
	ModelIntakeLocale,
	string
> = {
	en: 'My client agrees that I share these photos or data and that a 3D model of their product is made from them.',
	de: 'Mein Kunde ist einverstanden, dass ich die Fotos oder Daten teile und daraus ein 3D-Modell seines Produkts entsteht.'
}
