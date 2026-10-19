import * as React from 'react'

import { ModelIntakeConfirmationEmail } from './model-intake-confirmation'

export default function ModelIntakeConfirmationPreview() {
	return (
		<ModelIntakeConfirmationEmail
			locale="de"
			displayName="Erika Mustermann"
			referenceCode="VCTR-3F9A12BC"
		/>
	)
}
