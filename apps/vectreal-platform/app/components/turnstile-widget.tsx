import { Turnstile, type TurnstileInstance } from '@marsidev/react-turnstile'
import { useEffect, useRef } from 'react'

interface TurnstileWidgetProps {
	siteKey: string
	onSuccess: (token: string) => void
	onError?: () => void
	resetNonce?: number
}

export function TurnstileWidget({
	siteKey,
	onSuccess,
	onError,
	resetNonce = 0
}: TurnstileWidgetProps) {
	const turnstileRef = useRef<TurnstileInstance>(null)

	useEffect(() => {
		if (resetNonce === 0) {
			return
		}

		turnstileRef.current?.reset()
	}, [resetNonce])

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
