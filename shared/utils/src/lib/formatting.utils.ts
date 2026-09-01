/** Largest unit first would read backwards; index into this by power of 1024. */
const FILE_SIZE_UNITS = ['B', 'KB', 'MB', 'GB', 'TB'] as const

/**
 * A byte count as the product says it.
 *
 * The one implementation. There were three, and they disagreed on every axis
 * that shows: this one stopped at MB and rendered a 3 GiB scene as
 * "3072.00 MB", always at two decimals, with sizes under a kilobyte spelled
 * "512 bytes"; a copy in the scene detail route used adaptive precision and
 * B/KB/MB/GB; a third in `scene-asset-list-item.tsx` was fixed at one decimal
 * and indexed past its own unit array above a terabyte, yielding "1.0
 * undefined". The same scene could therefore report three different sizes on
 * one page.
 *
 * Precision is adaptive because a fixed one is wrong at both ends: two decimals
 * makes "3.00 KB" out of a number nobody needs that precisely, and zero makes
 * "4 MB" out of 4.4. Under 10, one decimal carries real information; from 10 to
 * 100 it is noise; at or above 100 even the integer part is more than the
 * reader wants.
 *
 * @param bytes Byte count. `null`, `undefined` and `NaN` render as a dash -
 * every call site had to handle "not measured" and two of the three did it by
 * hand.
 */
export const formatFileSize = (bytes: number | null | undefined): string => {
	if (bytes == null || Number.isNaN(bytes)) {
		return '-'
	}

	if (bytes === 0) {
		return '0 B'
	}

	/*
	  Clamped, which the copy in the asset list was not: `Math.log` keeps
	  climbing past the last unit, so a petabyte indexed off the end of the array
	  and formatted as `undefined`.
	*/
	const index = Math.min(
		Math.floor(Math.log(bytes) / Math.log(1024)),
		FILE_SIZE_UNITS.length - 1
	)
	const size = bytes / 1024 ** index

	const rendered =
		size >= 100 ? Math.round(size) : size.toFixed(size < 10 ? 1 : 0)

	return `${rendered} ${FILE_SIZE_UNITS[index]}`
}
