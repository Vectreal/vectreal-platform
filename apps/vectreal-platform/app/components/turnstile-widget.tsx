import {
	Turnstile,
	type TurnstileInstance
} from '@marsidev/react-turnstile'
import { useRef } from 'react'

interface TurnstileWidgetProps {
	siteKey: string
	onSuccess: (token: string) => void
	onError?: () => void
}

export function TurnstileWidget({
	siteKey,
	onSuccess,
	onError
}: TurnstileWidgetProps) {
	const turnstileRef = useRef<TurnstileInstance>(null)

	if (!siteKey) {
		return null
	}

	const handleError = () => {
		onError?.()
		turnstileRef.current?.reset()
	}

	return (
		<Turnstile
			ref={turnstileRef}
			siteKey={siteKey}
			onSuccess={onSuccess}
			onError={handleError}
			onExpire={handleError}
		/>
	)
}
