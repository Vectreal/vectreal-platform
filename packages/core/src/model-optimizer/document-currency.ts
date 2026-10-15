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
 * that refuses a result once a newer model or document has been claimed or
 * committed.
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
 * `replaceDocument` claim a new document of the same model when they start,
 * and every document that replaces the held one is committed, which advances
 * the revision again. Operations await between reading the optimizer's state
 * and writing it, so a document commits only if neither model nor document
 * changed meanwhile: work still running for a previous model or document,
 * such as a step a caller timed out on, then throws `SupersededError` and
 * changes nothing. `setSource` is the one write that only asks about the
 * model, because it does not replace the document.
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
	/**
	 * The revision of the document held. While it trails `revision` a claimed
	 * document is being parsed, and the one still held is the one it retires,
	 * so no new work may start on it either.
	 */
	private settledRevision = 0

	/**
	 * The ticket for work on the held document starting now, refused while a
	 * load or a claimed document is pending.
	 */
	currentTicket(): Ticket {
		const ticket = this.currentModelTicket()
		if (this.settledRevision !== this.revision) throw new SupersededError()
		return ticket
	}

	/**
	 * The ticket for work that only asks which model is held, refused only
	 * while a load is pending: a claimed document of the same model is no
	 * reason to wait.
	 */
	currentModelTicket(): Ticket {
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
	 * A new document of the same model. Work started on the previous document,
	 * including a claim still parsing, is moot; no work may start until this
	 * commits or is released; and the claim is itself refused if a newer
	 * document or model is claimed first.
	 */
	claimDocument(): Ticket {
		const { generation } = this.currentModelTicket()
		this.revision += 1
		return { generation, revision: this.revision }
	}

	/**
	 * A document of `ticket`'s model and revision replaces the held one. Work
	 * that started on the document it replaces is moot from here, so this
	 * advances the revision in the same step as the replacement.
	 */
	commit(ticket: Ticket): void {
		this.ensureCurrent(ticket)
		this.revision += 1
		this.settledRevision = this.revision
	}

	/**
	 * A claimed document that will not commit, because it failed or was
	 * dropped: the document still held is usable again. Work it retired stays
	 * retired. Nothing to do once a newer claim owns the optimizer.
	 */
	release(ticket: Ticket): void {
		if (this.isCurrent(ticket)) this.releasePending()
	}

	/**
	 * Whatever claimed document is pending will not commit, because the caller
	 * just retired what it belongs to: the document still held is usable again.
	 */
	releasePending(): void {
		this.settledRevision = this.revision
	}

	/** The load holding `ticket` committed its model, so work may start on it. */
	settle(ticket: Ticket): void {
		this.ensureCurrent(ticket)
		this.settledGeneration = ticket.generation
		this.settledRevision = ticket.revision
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
