import * as React from 'react'

import { ModelIntakeInternalEmail } from './model-intake-internal'

export default function ModelIntakeInternalPreview() {
	return (
		<ModelIntakeInternalEmail
			referenceCode="VCTR-3F9A12BC"
			name="Erika Mustermann"
			email="erika@brand.de"
			company="Brand GmbH"
			productType="Shoes"
			needsReview={false}
			size="H 12 cm x W 30.5 cm"
			batch="2026-10-30-brands"
			locale="de"
			message="Matte black, with the logo on the heel."
			photoUrls={[
				'https://example.com/1',
				'https://example.com/2',
				'https://example.com/3'
			]}
			intakePageUrl="https://vectreal.com/dashboard/intake"
		/>
	)
}
