import { render } from '@react-email/render'
import { describe, expect, it } from 'vitest'

import { ModelIntakeConfirmationEmail } from './model-intake-confirmation'
import { ModelIntakeInternalEmail } from './model-intake-internal'
import { MODEL_INTAKE_COPY } from '../../../constants/product-copy'

describe('model intake emails', () => {
	it.each(['en', 'de'] as const)(
		'confirms in the language the form was sent in (%s)',
		async (locale) => {
			const text = await render(
				<ModelIntakeConfirmationEmail
					locale={locale}
					displayName="Erika"
					referenceCode="VCTR-1234ABCD"
				/>,
				{ plainText: true }
			)
			const copy = MODEL_INTAKE_COPY[locale].confirmationEmail
			expect(text).toContain(copy.greeting('Erika'))
			expect(text).toContain(copy.body)
			expect(text).toContain('VCTR-1234ABCD')
			expect(text).toContain(copy.deletion)
		}
	)

	it('gives the inbox every detail and a link per photo', async () => {
		const text = await render(
			<ModelIntakeInternalEmail
				referenceCode="VCTR-1234ABCD"
				name="Erika"
				email="erika@brand.de"
				company="Brand GmbH"
				productType="Something else"
				needsReview
				size="H 12 cm"
				batch="2026-10-30-brands"
				locale="de"
				message=""
				photoUrls={['https://a', 'https://b', 'https://c']}
				intakePageUrl="https://vectreal.com/dashboard/intake"
			/>,
			{ plainText: true }
		)
		expect(text).toContain('erika@brand.de')
		expect(text).toContain('Something else (review first)')
		expect(text).toContain('2026-10-30-brands')
		expect(text.match(/Photo \d/g)).toEqual(['Photo 1', 'Photo 2', 'Photo 3'])
	})
})
