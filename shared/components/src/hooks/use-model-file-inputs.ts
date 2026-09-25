import { useCallback, useRef, type ChangeEvent } from 'react'

/*
  `webkitdirectory` and `directory` are real attributes with no React typing.
  The augmentation lives here because it is global - declaring it in two
  components declared the same global twice, which is the shape that rots: the
  day one of them changes, the other silently disagrees.
*/
declare module 'react' {
	interface InputHTMLAttributes<T> extends HTMLAttributes<T> {
		directory?: string
		webkitdirectory?: string
	}
}

/**
 * The two file inputs a 3D model needs, and the handler they share.
 *
 * A model arrives in two shapes and one element cannot offer both:
 * `webkitdirectory` does not extend the dialog, it replaces it, so an input
 * carrying it shows a directory chooser and ignores `accept` entirely. The
 * publisher shipped for months with a "Choose Files" button that could only
 * open a folder, because it had one input and that input carried the attribute.
 *
 * WHAT THIS DELIBERATELY DOES NOT DO. It is not a shared drop zone. The two
 * surfaces that use it - the publisher's empty state and a converter page -
 * agree on the input mechanics and on almost nothing else: different callbacks,
 * different accept sources, different copy, different layout, one has a mobile
 * branch and a welcome panel, the other renders a viewer and its own loading
 * and error states. A component taking ten props to reconcile that
 * would be harder to read than either caller. So the part that is genuinely one
 * thing is one thing, and the rest stays written out.
 */
export function useModelFileInputs(onFiles: (files: File[]) => void) {
	const fileInputRef = useRef<HTMLInputElement>(null)
	const directoryInputRef = useRef<HTMLInputElement>(null)

	const handleChange = useCallback(
		(event: ChangeEvent<HTMLInputElement>) => {
			const files = Array.from(event.target.files ?? [])

			/*
			  Cleared so the same path can be chosen twice. A file input fires no
			  change event for an identical selection, so a retry after a failure -
			  a model over the size limit, a format the loader refuses - did nothing
			  at all.
			*/
			event.target.value = ''

			if (files.length === 0) return

			onFiles(files)
		},
		[onFiles]
	)

	return {
		fileInputRef,
		directoryInputRef,
		/** Spread onto both inputs. */
		inputProps: { onChange: handleChange },
		openFilePicker: () => fileInputRef.current?.click(),
		openDirectoryPicker: () => directoryInputRef.current?.click()
	}
}
