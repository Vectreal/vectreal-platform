import * as React from 'react'

import { Calendar } from './calendar'

import type { Meta, StoryObj } from '@storybook/react-vite'
import type { DateRange } from 'react-day-picker'

/**
 * `Calendar` wraps `react-day-picker`. It had no visual coverage, and its
 * `classNames` map was still keyed for the pre-v9 DOM (`caption`, `head_cell`,
 * `row`, `cell`, `day_selected`) long after the library had renamed those
 * elements - so most of the styling below was silently inert. These stories
 * pin the states that regress quietly when the library restructures its DOM.
 *
 * Every story fixes `defaultMonth` and its dates, so Chromatic diffs stay
 * stable instead of shifting with the current date.
 */
const meta = {
	title: 'Components/Calendar',
	component: Calendar,
	tags: ['autodocs'],
	parameters: {
		// `today` styling is a real state worth seeing, but a live clock makes
		// the snapshot move. Pin it to a date inside the displayed month.
		chromatic: { diffThreshold: 0.2 }
	}
} satisfies Meta<typeof Calendar>

export default meta
type Story = StoryObj<typeof meta>

const MONTH = new Date(2026, 4, 1)

/** Single-date selection - the default mode, with one day selected. */
export const Default: Story = {
	render: () => (
		<Calendar
			mode="single"
			defaultMonth={MONTH}
			today={new Date(2026, 4, 14)}
			selected={new Date(2026, 4, 12)}
		/>
	)
}

/**
 * Range selection. `range_start`, `range_middle` and `range_end` are separate
 * class keys applied to the day cell; if the band renders flat or the end caps
 * lose their rounding, this is where it shows.
 */
export const Range: Story = {
	render: () => {
		const selected: DateRange = {
			from: new Date(2026, 4, 8),
			to: new Date(2026, 4, 19)
		}

		return (
			<Calendar
				mode="range"
				defaultMonth={MONTH}
				today={new Date(2026, 4, 14)}
				selected={selected}
			/>
		)
	}
}

/**
 * Disabled days alongside outside days. Both dim their button, and they must
 * stay distinguishable from a plain unselected day.
 */
export const DisabledAndOutsideDays: Story = {
	render: () => (
		<Calendar
			mode="single"
			defaultMonth={MONTH}
			today={new Date(2026, 4, 14)}
			showOutsideDays
			disabled={[
				{ from: new Date(2026, 4, 1), to: new Date(2026, 4, 6) },
				new Date(2026, 4, 21)
			]}
		/>
	)
}

/** Two months side by side - exercises the `months` / `month` layout keys. */
export const TwoMonths: Story = {
	render: () => (
		<Calendar
			mode="range"
			numberOfMonths={2}
			defaultMonth={MONTH}
			today={new Date(2026, 4, 14)}
			selected={{ from: new Date(2026, 4, 26), to: new Date(2026, 5, 3) }}
		/>
	)
}

/** Interactive, to confirm selection and month navigation still work. */
export const Interactive: Story = {
	render: function InteractiveCalendar() {
		const [selected, setSelected] = React.useState<Date | undefined>(
			new Date(2026, 4, 12)
		)

		return (
			<Calendar
				mode="single"
				defaultMonth={MONTH}
				today={new Date(2026, 4, 14)}
				selected={selected}
				onSelect={setSelected}
			/>
		)
	}
}
