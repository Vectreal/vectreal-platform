import { Button } from '@shared/components/ui/button'
import { Input } from '@shared/components/ui/input'
import { useId } from 'react'
import { Form } from 'react-router'

interface Props {
	/** What the field starts with: the link that was refused, so it can be fixed. */
	defaultValue?: string
	/** Why the link in the address was refused, said under the field. */
	error?: string
}

/**
 * Where a link is pasted.
 *
 * A plain GET form on `src`, so the browser encodes the link into the query
 * itself. A link pasted with its own `?` and `&` arrives whole, which a
 * hand-built `/view?src=` link only does when its author encoded it, and the
 * form works before the page's script has loaded.
 *
 * Keyed by the caller on the link, so navigating to a new one resets the field.
 */
export function ViewLinkForm({ defaultValue, error }: Props) {
	const errorId = useId()

	return (
		<Form
			method="get"
			action="/view"
			className="flex w-full max-w-2xl flex-col gap-2 sm:flex-row"
		>
			<Input
				type="url"
				name="src"
				required
				defaultValue={defaultValue}
				placeholder="https://example.com/model.glb"
				aria-label="Link to a 3D model file"
				aria-invalid={error ? true : undefined}
				aria-describedby={error ? errorId : undefined}
				autoComplete="off"
				spellCheck={false}
				className="sm:flex-1"
			/>
			<Button type="submit">Open</Button>
			{error && (
				<p
					id={errorId}
					role="alert"
					className="text-body-sm text-destructive sm:basis-full"
				>
					{error}
				</p>
			)}
		</Form>
	)
}
