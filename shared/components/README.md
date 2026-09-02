# @shared/components

Shared React UI and hooks used by the Vectreal platform workspace.

This package primarily re-exports shadcn-based UI primitives with project-specific styling and conventions.

## What is exported

### Hooks

- `useAcceptPattern(isMobileDefault?)`
- `useIsMobile(initial?)`

### UI

The package re-exports UI modules from `shared/components/src/ui/*`, including:

- Form and input components (`button`, `input`, `textarea`, `select`, `form`, `checkbox`)
- Overlay components (`dialog`, `sheet`, `drawer`, `popover`, `tooltip`, `dropdown-menu`)
- Layout/navigation components (`sidebar`, `tabs`, `breadcrumb`, `navigation-menu`, `card`)
- Data/feedback components (`table`, `progress`, `skeleton`, `sonner`, `alert`)

### Motion

`@shared/components/motion` is a separate entry point holding the shared Framer Motion
vocabulary: the `fadeUp`, `fadeIn`, `scaleIn`, `slideReveal` and `staggerContainer`
variants, the `springConfig` and `cinematicConfig` transitions, and the
`useInViewAnimation` hook.

## Usage

```tsx
import {
	Button,
	Dialog,
	DialogContent,
	DialogTrigger
} from '@shared/components'

export function Example() {
	return (
		<Dialog>
			<DialogTrigger asChild>
				<Button>Open</Button>
			</DialogTrigger>
			<DialogContent>Shared dialog content</DialogContent>
		</Dialog>
	)
}
```

```tsx
import { useAcceptPattern } from '@shared/components'

function UploadInput() {
	const accept = useAcceptPattern()
	return <input type="file" accept={accept} />
}
```

## Notes

- Components are intended for internal platform consistency and may evolve with the design system.
- For exact prop surfaces, use TypeScript types from the exported components.

## License

AGPL-3.0-only, covered by the repository-root [LICENSE.md](../../LICENSE.md).
