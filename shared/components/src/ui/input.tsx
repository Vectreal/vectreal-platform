import { cn } from '@shared/utils'
import * as React from 'react'

/*
  Controls share one radius, and it is the base knob.

  `input`, `textarea`, `button` and `select` each hard-coded `rounded-xl`
  (20px) - and `select` used `rounded-lg` for its content and `rounded-xl` for
  its trigger, so a select did not even agree with itself. With no single
  control radius to inherit, call sites started patching their own on, which is
  how a text field ended up curving faster than the panel around it.

  `rounded-lg` is `--radius` itself, the one knob the scale derives from, and
  what `badge` already used.
*/
function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
	return (
		<input
			type={type}
			data-slot="input"
			className={cn(
				'file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input flex h-9 w-full min-w-0 rounded-lg border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
				'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
				'aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive',
				className
			)}
			{...props}
		/>
	)
}

export { Input }
