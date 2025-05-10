import { PropsWithChildren } from 'react'

export const SpinnerWrapper = ({ children }: PropsWithChildren) => {
	return (
		<div className="flex h-full w-full items-center justify-center">
			{children}
		</div>
	)
}
