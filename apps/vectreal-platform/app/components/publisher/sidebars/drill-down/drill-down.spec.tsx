// @vitest-environment jsdom
/**
 * The drill-down stack: triggers push, the back row and Escape pop, and focus
 * follows the reader in both directions so a keyboard user is never left on a
 * button that has just been unmounted.
 */
import { fireEvent, render, screen } from '@testing-library/react'
import { useLayoutEffect, useRef, useState } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { DrillDown, DrillDownTrigger, DrillDownView } from './drill-down'

function Harness({
	initialPath = [],
	onPathChange
}: {
	initialPath?: string[]
	onPathChange?: (path: string[]) => void
}) {
	const [path, setPath] = useState(initialPath)
	return (
		<DrillDown
			path={path}
			rootTitle="Hotspots"
			onPathChange={(next) => {
				onPathChange?.(next)
				setPath(next)
			}}
		>
			<DrillDownView id="root">
				<DrillDownTrigger to="content" label="Content" summary="Front grille" />
			</DrillDownView>
			<DrillDownView id="content" title="Content">
				<label>
					Marker name
					<input />
				</label>
				<DrillDownTrigger to="link" label="Link" />
			</DrillDownView>
			<DrillDownView id="link" title="Link">
				<p>link view</p>
			</DrillDownView>
		</DrillDown>
	)
}

describe('DrillDown', () => {
	it('opens a group and moves focus to its heading', async () => {
		render(<Harness />)

		fireEvent.click(screen.getByRole('button', { name: /Content/ }))

		const heading = await screen.findByRole('heading', { name: 'Content' })
		expect(document.activeElement).toBe(heading)
	})

	/**
	 * The root stays on screen while it slides out, and it must leave as it
	 * was: a back row appearing on it shifted the whole panel before the
	 * slide began.
	 */
	it('keeps the leaving view as it was opened', async () => {
		render(<Harness />)

		fireEvent.click(screen.getByRole('button', { name: /Content/ }))

		expect(screen.getByRole('button', { name: /Content/ })).toBeTruthy()
		expect(screen.queryByRole('button', { name: /^Back to/ })).toBeNull()
		await screen.findByRole('heading', { name: 'Content' })
	})

	it('goes back to the trigger it came from', async () => {
		render(<Harness />)
		fireEvent.click(screen.getByRole('button', { name: /Content/ }))
		await screen.findByRole('heading', { name: 'Content' })

		fireEvent.click(screen.getByRole('button', { name: 'Back to Hotspots' }))

		const trigger = await screen.findByRole('button', { name: /Content/ })
		expect(document.activeElement).toBe(trigger)
	})

	it('names the parent view in the back button two levels down', async () => {
		render(<Harness initialPath={['content', 'link']} />)

		expect(
			await screen.findByRole('button', { name: 'Back to Content' })
		).toBeTruthy()
	})

	it('pops one level on Escape', async () => {
		const onPathChange = vi.fn()
		render(
			<Harness initialPath={['content', 'link']} onPathChange={onPathChange} />
		)

		fireEvent.keyDown(await screen.findByText('link view'), { key: 'Escape' })

		expect(onPathChange).toHaveBeenCalledWith(['content'])
	})

	it('leaves Escape to a field that is being edited', async () => {
		const onPathChange = vi.fn()
		render(<Harness initialPath={['content']} onPathChange={onPathChange} />)

		fireEvent.keyDown(await screen.findByLabelText('Marker name'), {
			key: 'Escape'
		})

		expect(onPathChange).not.toHaveBeenCalled()
	})

	/**
	 * One row per camera opens the same "camera" view, so the view id cannot
	 * say which row to go back to. The row's own key does.
	 */
	it('goes back to the exact row when several open the same view', async () => {
		function Rows() {
			const [path, setPath] = useState<string[]>([])
			return (
				<DrillDown path={path} onPathChange={setPath} rootTitle="Camera">
					<DrillDownView id="root">
						<DrillDownTrigger to="camera" focusKey="camera:a" label="Front" />
						<DrillDownTrigger to="camera" focusKey="camera:b" label="Side" />
					</DrillDownView>
					<DrillDownView id="camera" title="Camera settings">
						<p>settings</p>
					</DrillDownView>
				</DrillDown>
			)
		}
		render(<Rows />)

		fireEvent.click(screen.getByRole('button', { name: /Side/ }))
		await screen.findByRole('heading', { name: 'Camera settings' })
		fireEvent.click(screen.getByRole('button', { name: 'Back to Camera' }))

		const side = await screen.findByRole('button', { name: /Side/ })
		expect(document.activeElement).toBe(side)
	})

	/**
	 * A panel can change the path itself rather than through a trigger: Add
	 * selects the new marker, Delete returns to the list. The control that was
	 * focused goes with the view it was in, and focus must not fall to the page.
	 */
	it('keeps focus in the panel when its own control changes the path', async () => {
		/*
		  Chrome blurs a focused element as it is removed, while it is still
		  connected; jsdom does not. The button reproduces Chrome, because that
		  blur is exactly what could be mistaken for focus leaving the panel.
		*/
		function AddButton({ onAdd }: { onAdd: () => void }) {
			const ref = useRef<HTMLButtonElement>(null)
			useLayoutEffect(() => {
				const button = ref.current
				return () => {
					button?.dispatchEvent(new FocusEvent('focusout', { bubbles: true }))
				}
			}, [])
			return (
				<button ref={ref} type="button" onClick={onAdd}>
					Add
				</button>
			)
		}
		function SelfNavigating() {
			const [path, setPath] = useState<string[]>([])
			return (
				<DrillDown path={path} onPathChange={setPath} rootTitle="Hotspots">
					<DrillDownView id="root">
						<AddButton onAdd={() => setPath(['marker'])} />
					</DrillDownView>
					<DrillDownView id="marker" title="New marker">
						<p>editor</p>
					</DrillDownView>
				</DrillDown>
			)
		}
		render(<SelfNavigating />)
		const add = screen.getByRole('button', { name: 'Add' })
		add.focus()

		fireEvent.click(add)

		const heading = await screen.findByRole('heading', { name: 'New marker' })
		expect(document.activeElement).toBe(heading)
	})

	/**
	 * Back at a root with no heading of its own, focus goes to the view, not
	 * to its first control: that can be a tooltip trigger, and a tooltip opens
	 * on focus.
	 */
	it('lands on the view itself when it has no heading to take focus', async () => {
		function DeleteFromView() {
			const [path, setPath] = useState<string[]>(['camera'])
			return (
				<DrillDown path={path} onPathChange={setPath} rootTitle="Camera">
					<DrillDownView id="root">
						<button type="button">About cameras</button>
					</DrillDownView>
					<DrillDownView id="camera" title="Front">
						<button type="button" onClick={() => setPath([])}>
							Delete
						</button>
					</DrillDownView>
				</DrillDown>
			)
		}
		render(<DeleteFromView />)
		const remove = await screen.findByRole('button', { name: 'Delete' })
		remove.focus()

		fireEvent.click(remove)

		const about = await screen.findByRole('button', { name: 'About cameras' })
		expect(document.activeElement).toBe(about.closest('section'))
	})

	it('leaves focus where it is when the path changes from outside the panel', async () => {
		function Outside() {
			const [path, setPath] = useState<string[]>([])
			return (
				<>
					<button type="button" onClick={() => setPath(['content'])}>
						Canvas
					</button>
					<DrillDown path={path} onPathChange={setPath} rootTitle="Hotspots">
						<DrillDownView id="root">
							<p>list</p>
						</DrillDownView>
						<DrillDownView id="content" title="Content">
							<p>editor</p>
						</DrillDownView>
					</DrillDown>
				</>
			)
		}
		render(<Outside />)
		const canvas = screen.getByRole('button', { name: 'Canvas' })
		canvas.focus()

		fireEvent.click(canvas)

		await screen.findByRole('heading', { name: 'Content' })
		expect(document.activeElement).toBe(canvas)
	})

	/**
	 * Deleting a row removes the focused button without changing the path, so
	 * focus falls to the page. A later path change from the canvas must not
	 * read that as focus lost to navigation and pull it into the panel.
	 */
	it('leaves focus alone after a removal the path did not cause', async () => {
		function RemovedRow() {
			const [path, setPath] = useState<string[]>([])
			const [hasRow, setHasRow] = useState(true)
			return (
				<>
					<button
						type="button"
						tabIndex={-1}
						onClick={() => setPath(['content'])}
					>
						Canvas
					</button>
					<DrillDown path={path} onPathChange={setPath} rootTitle="Hotspots">
						<DrillDownView id="root">
							{hasRow && (
								<button type="button" onClick={() => setHasRow(false)}>
									Delete
								</button>
							)}
						</DrillDownView>
						<DrillDownView id="content" title="Content">
							<p>editor</p>
						</DrillDownView>
					</DrillDown>
				</>
			)
		}
		render(<RemovedRow />)
		const remove = screen.getByRole('button', { name: 'Delete' })
		remove.focus()
		fireEvent.click(remove)
		expect(document.activeElement).toBe(document.body)

		// A click on the 3D canvas does not take focus, so neither does this.
		fireEvent.click(screen.getByRole('button', { name: 'Canvas' }))

		await screen.findByRole('heading', { name: 'Content' })
		expect(document.activeElement).toBe(document.body)
	})

	it('does nothing on Escape at the root, so the sidebar can close', () => {
		const onPathChange = vi.fn()
		render(<Harness onPathChange={onPathChange} />)

		fireEvent.keyDown(screen.getByRole('button', { name: /Content/ }), {
			key: 'Escape'
		})

		expect(onPathChange).not.toHaveBeenCalled()
	})
})
