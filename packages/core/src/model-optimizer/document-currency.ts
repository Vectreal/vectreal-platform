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
 * Which model ModelOptimizer holds and which document of it, and the check
 * every result passes before it may replace that document.
 */

/**
 * Thrown by an operation whose model was replaced while it ran. It changed
 * nothing; the optimizer holds the newer model.
 */
export class SupersededError extends Error {
	constructor(options?: ErrorOptions) {
		super('Superseded: a newer model was loaded while this ran.', options)
		this.name = 'SupersededError'
	}
}

/** The model and document an operation started on. */
export type Ticket = { generation: number; revision: number }

/**
 * Every load and `reset` claims a new model; `restoreSource` and
 * `replaceDocument` claim a new document of the same model. Operations await
 * between reading the optimizer's state and writing it, so each one commits
 * only if neither changed meanwhile: work still running for a previous model
 * or document, such as a step a caller timed out on, then throws
 * `SupersededError` and changes nothing.
 */
export class DocumentCurrency {
	private generation = 0
	private revision = 0
	/**
	 * The newest model that finished loading. While it trails `generation` a
	 * load is pending, and the document still held is the one that load is
	 * replacing, so no new work may start on it.
	 */
	private settledGeneration = 0

	/** The ticket for work starting now, refused while a load is pending. */
	currentTicket(): Ticket {
		if (this.settledGeneration !== this.generation) {
			throw new SupersededError()
		}
		return { generation: this.generation, revision: this.revision }
	}

	/** A new model: everything started on the previous one is moot. */
	claimModel(): Ticket {
		this.generation += 1
		this.revision += 1
		return { generation: this.generation, revision: this.revision }
	}

	/**
	 * A new document of the same model. Work started on the previous document
	 * is moot, and this claim is itself refused if a newer document or model is
	 * claimed before it commits.
	 */
	claimDocument(): Ticket {
		const { generation } = this.currentTicket()
		this.revision += 1
		return { generation, revision: this.revision }
	}

	/** The load holding `ticket` committed its model, so work may start on it. */
	settle(ticket: Ticket): void {
		this.ensureCurrent(ticket)
		this.settledGeneration = ticket.generation
	}

	isCurrent(ticket: Ticket): boolean {
		return (
			ticket.generation === this.generation && ticket.revision === this.revision
		)
	}

	/** Whether the model `ticket` was taken for is still held, in any document. */
	isCurrentModel(ticket: Ticket): boolean {
		return ticket.generation === this.generation
	}

	ensureCurrent(ticket: Ticket): void {
		if (!this.isCurrent(ticket)) throw new SupersededError()
	}
}

/**
 * Runs an operation `isStale` can retire, then `commit`s its result in the
 * same synchronous step as the last check: committing after a further
 * await would leave a gap a newer load could commit in first. A retired
 * operation throws `SupersededError` however it ended, even a failure of
 * its own, so no caller reports it against the newer model that retired it.
 */
export async function unlessSuperseded<T, R>(
	isStale: () => boolean,
	work: () => Promise<T>,
	commit: (result: T) => R
): Promise<R> {
	let result: T
	try {
		result = await work()
	} catch (error) {
		if (isStale()) throw new SupersededError({ cause: error })
		throw error
	}
	if (isStale()) throw new SupersededError()
	return commit(result)
}
