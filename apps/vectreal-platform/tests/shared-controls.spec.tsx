// @vitest-environment jsdom
/**
 * The shared control primitives every surface now uses: `Slider` and `Toggle`.
 *
 * They live in `shared/components`, which has no test project of its own, so
 * their behaviour is pinned here, where the app that depends on them runs.
 */
import { ChoiceList } from '@shared/components/ui/choice-list'
import { Slider } from '@shared/components/ui/slider'
import { Toggle } from '@shared/components/ui/toggle'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { Eye } from 'lucide-react'
import { useState } from 'react'
import { beforeAll, describe, expect, it, vi } from 'vitest'

beforeAll(() => {
	// Radix Slider measures its thumb with a ResizeObserver, which jsdom does
	// not implement.
	globalThis.ResizeObserver = class {
		observe() {}
		unobserve() {}
		disconnect() {}
	}
})

function ControlledSlider({
	initial,
	onChange
}: {
	initial: number
	onChange?: (value: number) => void
}) {
	const [value, setValue] = useState(initial)
	return (
		<Slider
			label="Intensity"
			min={0}
			max={5}
			step={0.05}
			presets={[{ value: 1, label: 'Normal' }]}
			value={value}
			onValueChange={(next) => {
				onChange?.(next)
				setValue(next)
			}}
		/>
	)
}

describe('Slider', () => {
	/**
	 * The bar runs over a normalized 0-1 position so a mapping can stretch it,
	 * which left to Radix would make an arrow press move a thousandth of the
	 * bar. It has to step by the value's own `step`.
	 */
	it('steps by `step` in value space, ten at a time with Shift', () => {
		const onChange = vi.fn()
		render(<ControlledSlider initial={1} onChange={onChange} />)
		const thumb = screen.getByRole('slider', { name: 'Intensity' })

		fireEvent.keyDown(thumb, { key: 'ArrowRight' })
		expect(onChange).toHaveBeenLastCalledWith(1.05)

		fireEvent.keyDown(thumb, { key: 'ArrowLeft', shiftKey: true })
		expect(onChange).toHaveBeenLastCalledWith(0.55)
	})

	it('names the preset the value sits on', () => {
		render(<ControlledSlider initial={1} />)

		expect(
			screen
				.getByRole('slider', { name: 'Intensity' })
				.getAttribute('aria-valuetext')
		).toBe('Normal · 1.00')
	})

	it('takes a typed value on Enter, rounded to the step and clamped', () => {
		const onChange = vi.fn()
		render(<ControlledSlider initial={1} onChange={onChange} />)

		fireEvent.keyDown(screen.getByRole('slider', { name: 'Intensity' }), {
			key: 'Enter'
		})
		const field = screen.getByLabelText('Intensity value')
		fireEvent.change(field, { target: { value: '2.33' } })
		fireEvent.keyDown(field, { key: 'Enter' })

		expect(onChange).toHaveBeenLastCalledWith(2.35)
		expect(screen.queryByLabelText('Intensity value')).toBeNull()

		fireEvent.keyDown(screen.getByRole('slider', { name: 'Intensity' }), {
			key: 'Enter'
		})
		const again = screen.getByLabelText('Intensity value')
		fireEvent.change(again, { target: { value: '99' } })
		fireEvent.keyDown(again, { key: 'Enter' })

		expect(onChange).toHaveBeenLastCalledWith(5)
	})

	it('puts the value back when the entry is abandoned with Escape', () => {
		const onChange = vi.fn()
		render(<ControlledSlider initial={1} onChange={onChange} />)

		fireEvent.keyDown(screen.getByRole('slider', { name: 'Intensity' }), {
			key: 'Enter'
		})
		const field = screen.getByLabelText('Intensity value')
		// Focused, as it is in a browser: leaving the field on Escape blurs it,
		// and the blur must not commit what Escape just threw away.
		field.focus()
		fireEvent.change(field, { target: { value: '4' } })
		fireEvent.keyDown(field, { key: 'Escape' })

		expect(onChange).toHaveBeenLastCalledWith(1)
	})

	it('commits on leaving the field and lets focus go where it was sent', () => {
		const onChange = vi.fn()
		render(
			<>
				<ControlledSlider initial={1} onChange={onChange} />
				<input aria-label="Elsewhere" />
			</>
		)
		const thumb = screen.getByRole('slider', { name: 'Intensity' })

		fireEvent.keyDown(thumb, { key: 'Enter' })
		const field = screen.getByLabelText('Intensity value')
		field.focus()
		fireEvent.change(field, { target: { value: '3' } })
		/*
		  Spied rather than read from `activeElement`: Chrome lets a focus() made
		  inside a blur handler win over the focus that caused the blur, and jsdom
		  does not, so here the thumb would lose the race it wins in a browser.
		*/
		const focusThumb = vi.spyOn(thumb, 'focus')
		screen.getByLabelText('Elsewhere').focus()

		expect(onChange).toHaveBeenLastCalledWith(3)
		expect(focusThumb).not.toHaveBeenCalled()
	})
})

describe('Toggle', () => {
	it('is a switch named by its label in the tile layout', () => {
		const onCheckedChange = vi.fn()
		render(
			<Toggle
				layout="tile"
				label="Visible"
				icon={<Eye />}
				checked={false}
				onCheckedChange={onCheckedChange}
			/>
		)

		const toggle = screen.getByRole('switch', { name: 'Visible' })
		expect(toggle.getAttribute('aria-checked')).toBe('false')

		fireEvent.click(toggle)
		expect(onCheckedChange).toHaveBeenCalledWith(true)
	})

	it('is a switch named by its label and described by its sentence in the row layout', () => {
		render(
			<Toggle
				label="Analytics"
				description="Helps us understand which features are used."
				checked
				onCheckedChange={() => undefined}
			/>
		)

		const toggle = screen.getByRole('switch', { name: 'Analytics' })
		expect(toggle.getAttribute('aria-checked')).toBe('true')
		expect(
			document.getElementById(toggle.getAttribute('aria-describedby') ?? '')
				?.textContent
		).toBe('Helps us understand which features are used.')
	})
})

describe('ChoiceList', () => {
	const OPTIONS = [
		{ value: 'glb', label: 'GLB', detail: 'One binary file.' },
		{ value: 'gltf', label: 'GLTF', detail: 'JSON beside its assets.' }
	] as const

	function Controlled() {
		const [value, setValue] = useState<'glb' | 'gltf'>('glb')
		return (
			<ChoiceList
				aria-label="Export format"
				options={OPTIONS}
				value={value}
				onValueChange={setValue}
			/>
		)
	}

	it('is a named group of pressable rows', () => {
		render(<Controlled />)

		expect(screen.getByRole('group', { name: 'Export format' })).toBeTruthy()
		expect(
			screen.getByRole('button', { name: /GLB/ }).getAttribute('aria-pressed')
		).toBe('true')
	})

	/**
	 * Choosing can rewrite settings (a preset replaces every optimization step),
	 * so moving through the rows from the keyboard must not choose any of them.
	 */
	it('chooses nothing while the keyboard moves between rows', () => {
		const onValueChange = vi.fn()
		render(
			<ChoiceList
				aria-label="Export format"
				options={OPTIONS}
				value={undefined}
				onValueChange={onValueChange}
			/>
		)
		const first = screen.getByRole('button', { name: /GLB/ })
		first.focus()

		fireEvent.keyDown(first, { key: 'ArrowDown' })
		fireEvent.keyDown(document.activeElement ?? first, { key: 'ArrowDown' })

		expect(onValueChange).not.toHaveBeenCalled()
	})

	it('selects a row and shows only its detail', async () => {
		render(<Controlled />)

		fireEvent.click(screen.getByRole('button', { name: /GLTF/ }))

		expect(
			screen.getByRole('button', { name: /GLTF/ }).getAttribute('aria-pressed')
		).toBe('true')
		expect(await screen.findByText('JSON beside its assets.')).toBeTruthy()
		await waitFor(() =>
			expect(screen.queryByText('One binary file.')).toBeNull()
		)
	})
})
