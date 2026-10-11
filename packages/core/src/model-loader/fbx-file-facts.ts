/* vectreal-core | @vctrl/core
Copyright (C) 2024 Moritz Becker

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <http://www.gnu.org/licenses/>. */

/**
 * The few things an FBX states that `FBXLoader` acts on and then discards,
 * read straight from the file.
 *
 * WHY READ THE FILE A SECOND TIME. The FBX bridge has to correct what the
 * loader did with these, and the loader keeps no record of them: it turns a
 * Z-up scene upright without saying so, and it treats a constraint's target as
 * a child of the thing it constrains. Reading them back off the parsed objects
 * is guesswork - a root already turned -90 degrees looks the same either way -
 * so they are read where they are stated. Two records only, never the
 * geometry: the binary walk jumps over every record it does not need by its
 * end offset, so a large file costs a few dozen reads.
 */

/** One `C` record: `child` is connected to `parent`, through `property` for `OP`. */
export interface FbxConnection {
	child: number
	parent: number
	/** The property an `OP` connection targets, such as `LookAtProperty`. */
	property?: string
}

export interface FbxFacts {
	/** `GlobalSettings.UpAxis`: 1 is Y-up, 2 is Z-up. */
	upAxis?: number
	connections: FbxConnection[]
}

/**
 * Package-internal, like the bridge that reads it; the barrel does not
 * re-export it.
 */
export function readFbxFacts(bytes: Uint8Array): FbxFacts {
	return startsWith(bytes, BINARY_MAGIC) ? readBinary(bytes) : readText(bytes)
}

/*
  The ASCII spelling is line-based, and these two shapes are what every writer
  emits and what the loader's own text parser reads:
    P: "UpAxis", "int", "Integer", "",2
    C: "OP",7003,7001, "LookAtProperty"
  The quote before `UpAxis` keeps `OriginalUpAxis` from matching.
*/
function readText(bytes: Uint8Array): FbxFacts {
	const text = new TextDecoder().decode(bytes)

	const upAxis = /"UpAxis",\s*"int",\s*"Integer",\s*"[^"]*",\s*(-?\d+)/.exec(
		text
	)

	const connections: FbxConnection[] = []
	for (const match of text.matchAll(
		/C:\s*"O[OP]",\s*(-?\d+),\s*(-?\d+)(?:,\s*"([^"]*)")?/g
	)) {
		connections.push({
			child: Number(match[1]),
			parent: Number(match[2]),
			...(match[3] ? { property: match[3] } : {})
		})
	}

	return { upAxis: upAxis ? Number(upAxis[1]) : undefined, connections }
}

/**
 * The binary spelling: a 27-byte header carrying the version at 23, then
 * records of `endOffset, propertyCount, propertyListLength, nameLength, name,
 * properties, children`. From 7500 the three leading counts are 64-bit, which
 * is what Maya and 3ds Max have written since 2020; Blender still writes 7400.
 * A record whose end offset is zero closes a list.
 */
function readBinary(bytes: Uint8Array): FbxFacts {
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
	const wide = view.getUint32(23, true) >= 7500
	const facts: FbxFacts = { connections: [] }

	for (const top of records(view, 27, bytes.byteLength, wide)) {
		if (top.name === 'GlobalSettings') {
			for (const child of records(view, top.childrenAt, top.end, wide)) {
				if (child.name !== 'Properties70') continue
				for (const p of records(view, child.childrenAt, child.end, wide)) {
					const [name, , , , value] = properties(view, p)
					if (name === 'UpAxis' && typeof value === 'number') {
						facts.upAxis = value
					}
				}
			}
		} else if (top.name === 'Connections') {
			for (const c of records(view, top.childrenAt, top.end, wide)) {
				const [, child, parent, property] = properties(view, c)
				if (typeof child !== 'number' || typeof parent !== 'number') continue
				facts.connections.push({
					child,
					parent,
					...(typeof property === 'string' ? { property } : {})
				})
			}
		}
	}

	return facts
}

interface FbxRecord {
	name: string
	propertyCount: number
	propertiesAt: number
	childrenAt: number
	end: number
}

function* records(
	view: DataView,
	from: number,
	to: number,
	wide: boolean
): Generator<FbxRecord> {
	const countSize = wide ? 8 : 4
	const headerSize = countSize * 3 + 1
	let at = from

	while (at + headerSize <= to) {
		const end = readCount(view, at, wide)
		/* The null record that closes a list; also the start of the footer. */
		if (end === 0 || end <= at || end > view.byteLength) return

		const propertyCount = readCount(view, at + countSize, wide)
		const propertyListLength = readCount(view, at + countSize * 2, wide)
		const nameLength = view.getUint8(at + countSize * 3)
		const propertiesAt = at + headerSize + nameLength

		yield {
			name: new TextDecoder().decode(
				new Uint8Array(
					view.buffer,
					view.byteOffset + at + headerSize,
					nameLength
				)
			),
			propertyCount,
			propertiesAt,
			childrenAt: propertiesAt + propertyListLength,
			end
		}

		at = end
	}
}

function readCount(view: DataView, at: number, wide: boolean): number {
	return wide ? Number(view.getBigUint64(at, true)) : view.getUint32(at, true)
}

/**
 * A record's properties as numbers and strings. Arrays and raw bytes are
 * stepped over rather than decoded: neither record read here carries one, and
 * a compressed array would need inflating to read at all.
 */
function properties(
	view: DataView,
	record: FbxRecord
): Array<number | string | undefined> {
	const out: Array<number | string | undefined> = []
	let at = record.propertiesAt

	for (let i = 0; i < record.propertyCount && at < record.childrenAt; i += 1) {
		const type = String.fromCharCode(view.getUint8(at))
		at += 1

		switch (type) {
			case 'Y':
				out.push(view.getInt16(at, true))
				at += 2
				break
			case 'C':
				out.push(view.getUint8(at))
				at += 1
				break
			case 'I':
				out.push(view.getInt32(at, true))
				at += 4
				break
			case 'F':
				out.push(view.getFloat32(at, true))
				at += 4
				break
			case 'D':
				out.push(view.getFloat64(at, true))
				at += 8
				break
			case 'L':
				out.push(Number(view.getBigInt64(at, true)))
				at += 8
				break
			case 'S':
			case 'R': {
				const length = view.getUint32(at, true)
				out.push(
					type === 'S'
						? new TextDecoder().decode(
								new Uint8Array(view.buffer, view.byteOffset + at + 4, length)
							)
						: undefined
				)
				at += 4 + length
				break
			}
			default:
				/* An array: count, encoding, then its stored length in bytes. */
				out.push(undefined)
				at += 12 + view.getUint32(at + 8, true)
		}
	}

	return out
}

const BINARY_MAGIC = new TextEncoder().encode('Kaydara FBX Binary  \0')

function startsWith(bytes: Uint8Array, prefix: Uint8Array): boolean {
	return prefix.every((byte, i) => bytes[i] === byte)
}
