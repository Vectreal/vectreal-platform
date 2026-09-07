import { createRef } from 'react'

import HotspotPopover from './hotspot-popover'

import type { Meta, StoryObj } from '@storybook/react-vite'

/**
 * A real destination, deliberately.
 *
 * The label is the URL's own host rather than a second author-supplied field,
 * so a fictional host in a story is a small lie told twice: it shows a link
 * nobody can follow, and it shows a label for a site that does not exist.
 */
const link = {
	href: 'https://vectreal.com/docs/packages/viewer',
	label: 'vectreal.com'
}

/**
 * The card a marker opens, on its own.
 *
 * Rendered without a canvas, and that is the point rather than a shortcut. In
 * the viewer this card only exists after a click, and nothing in a snapshot
 * clicks anything, so the viewer stories catch markers and never the thing they
 * open - which is how the card came to ship with no visual coverage at all.
 *
 * It is reachable this way because it is presentational: `HotspotMarker`
 * measures, decides the placement and hands the answer down, because the hooks
 * that do the measuring cannot run inside drei's `Html`.
 *
 * These get both themes, unlike the viewer stories that opt out to avoid
 * mounting two WebGL canvases. The card is built on the same surface tokens as
 * the rest of the design system, so a token that resolves differently in dark
 * is exactly the regression worth catching here.
 */
const meta = {
	title: 'Viewer/Hotspot Popover',
	component: HotspotPopover,
	parameters: {
		layout: 'centered',
		/*
		  The workspace decorator renders every story twice and switches themes
		  with the app's `.dark` class. That is the wrong mechanism here: this
		  package's tokens hang off `.viewer` and are switched by `data-theme` on
		  that same element, so `.dark` moves nothing and both panes came out
		  identical - a card with no resolved background at all, showing the
		  backdrop straight through itself.
		*/
		dualTheme: false,
		viewerTheme: 'light'
	},
	args: {
		id: 'story-popover',
		title: 'Machined face',
		placement: { side: 'above', offsetX: 0 },
		// The real constant. Measured from the marker's centre, which is why it
		// has to clear half the hit box rather than being pure taste.
		gap: 22,
		cardRef: createRef<HTMLDivElement>(),
		onKeyDown: () => {},
		content: { body: null, link: null }
	},
	decorators: [
		/**
		 * A marker to hang off, a surface to sit on, and the token scope both
		 * need.
		 *
		 * `.viewer` is not decoration: every colour this card uses is declared
		 * there, so without it `--vctrl-bg` and `--vctrl-text` do not resolve and
		 * the card renders transparent with inherited text - which is how this
		 * story first shipped, looking plausible because the shadow still drew.
		 *
		 * The card is absolutely positioned against the nearest positioned
		 * ancestor and offset by the gap, so it also needs a point to hang off
		 * before any of its own geometry means anything. The dot is drawn at that
		 * point so a diff shows the spacing, not only the card.
		 *
		 * The mid-tone backdrop stands in for the model. This card is a near-white
		 * surface in light and a near-black one in dark, and it never appears over
		 * a blank page - on the story background each theme's card all but
		 * disappeared into it.
		 */
		(Story, context) => (
			<div
				className="viewer"
				data-theme={context.parameters.viewerTheme as 'light' | 'dark'}
			>
				<div className="flex h-[240px] w-[340px] items-center justify-center rounded-[0.75rem] bg-neutral-500">
					<div className="relative">
						<div className="absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-neutral-100 ring-1 ring-black/30" />
						<Story />
					</div>
				</div>
			</div>
		)
	]
} satisfies Meta<typeof HotspotPopover>

export default meta
type Story = StoryObj<typeof meta>

/** Prose alone. The common case, and the one with no camera to fly. */
export const BodyOnly: Story = {
	args: {
		content: {
			body: 'Cast in one piece, then machined flat so the two halves meet without a shim.',
			link: null
		}
	}
}

/**
 * A link alone, labelled with its own host.
 *
 * There is no second field for the anchor text, so the visible label cannot go
 * stale against where the link actually points.
 */
export const LinkOnly: Story = {
	args: { content: { body: null, link } }
}

/** Both, which is what a marker with something to say and somewhere to send you draws. */
export const BodyAndLink: Story = {
	args: {
		content: { body: 'The same joint, seen from the other side.', link }
	}
}

/**
 * Flipped below, as it is drawn for a marker too near the top of the canvas to
 * fit a card above it. The entry animation rises the other way in this state.
 */
export const Below: Story = {
	args: {
		placement: { side: 'below', offsetX: 0 },
		content: {
			body: 'Its card flips below, because there is no room for it above.',
			link
		}
	}
}

/**
 * Shifted horizontally, as it is for a marker near the left or right edge.
 * Centred on its marker the card would leave the canvas, so the resolver moves
 * it back by the overhang and no further.
 */
export const ShiftedFromTheEdge: Story = {
	args: {
		placement: { side: 'above', offsetX: 64 },
		content: {
			body: 'Nudged back from the edge it would otherwise hang over.',
			link
		}
	}
}

/**
 * At the width cap, which is where the wrapping and the link's truncation are
 * worth looking at. Author text runs to 2000 characters, so this is ordinary
 * rather than exceptional.
 */
export const LongBody: Story = {
	args: {
		content: {
			body: 'Cast in one piece, then machined flat so the two halves meet without a shim. The tolerance is held across the whole face rather than at the bolt circle alone, which is what lets the assembly seal without a gasket at working temperature.',
			link
		}
	}
}

/**
 * The same card on the viewer's dark surface.
 *
 * A story of its own rather than a second pane, because the theme is a property
 * of the `.viewer` element the card lives inside, and rendering the card twice
 * in one snapshot would put two elements carrying the same `id` in the document
 * - the id the marker's `aria-controls` points at.
 */
export const DarkSurface: Story = {
	parameters: { viewerTheme: 'dark' },
	args: {
		content: { body: 'The same joint, seen from the other side.', link }
	}
}
