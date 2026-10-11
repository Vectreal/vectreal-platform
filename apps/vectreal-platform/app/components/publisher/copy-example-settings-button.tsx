import { Button } from '@shared/components/ui/button'
import { useAtomValue } from 'jotai/react'
import { Clipboard } from 'lucide-react'
import { toast } from 'sonner'

import { exampleSettingsSnippet } from '../../lib/samples/example-scenes'
import { sceneViewerSettingsAtom } from '../../lib/stores/scene-settings-store'

/**
 * Dev only: copies the scene's settings in the shape an `EXAMPLE_SCENES` entry
 * takes, so an example for an article or a docs page is set up here, by eye,
 * rather than written out by hand.
 *
 * The caller renders it under `import.meta.env.DEV`, which a production build
 * replaces with `false`, so it never renders there.
 */
export function CopyExampleSettingsButton() {
	const settings = useAtomValue(sceneViewerSettingsAtom)

	return (
		<Button
			variant="ghost"
			size="sm"
			onClick={async () => {
				await navigator.clipboard.writeText(exampleSettingsSnippet(settings))
				toast.success('Example settings copied')
			}}
		>
			<Clipboard className="h-3.5 w-3.5" />
			Copy as example
		</Button>
	)
}
