import { Toaster as Sonner, ToasterProps } from 'sonner'

const Toaster = ({ ...props }: ToasterProps) => {
	return (
		<Sonner
			theme="dark"
			// Centered horizontally so notifications read the same regardless of
			// which side of the screen the current surface occupies, and inset by
			// the same 12px the publisher's floating surfaces use so a toast lines
			// up with whatever it appears beside. Overridable per call site.
			position="bottom-center"
			offset={12}
			mobileOffset={12}
			className="toaster group"
			style={
				{
					'--normal-bg': 'var(--popover)',
					'--normal-text': 'var(--popover-foreground)',
					'--normal-border': 'var(--border)'
				} as React.CSSProperties
			}
			{...props}
		/>
	)
}

export { Toaster }
