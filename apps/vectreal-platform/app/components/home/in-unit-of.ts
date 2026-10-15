/** A byte count in the unit its total is shown in, so a counter never switches from MB to KB as it lands. */
export function inUnitOf(bytes: number, total: number) {
	return total >= 1_048_576
		? { value: (bytes / 1_048_576).toFixed(1), unit: 'MB' }
		: { value: String(Math.round(bytes / 1024)), unit: 'KB' }
}
