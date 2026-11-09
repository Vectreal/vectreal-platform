// ---------------------------------------------------------------------------
// Agency page (`/agenturen`)
//
// Where an agency letter's short address forwards. German only, like the
// agency letters, and noindex until its copy and the sample store are final.
// COPY PENDING: every string marked `[Platzhalter: …]` is a placeholder for
// copy the content side writes and Moritz approves. It names what belongs
// there, not what to claim, and must be replaced before this page ships.
//
// Its own module rather than a block in `product-copy.ts`, which every
// marketing page bundles: only this route should pay for these strings.
// ---------------------------------------------------------------------------

export const AGENCY_PAGE_COPY = {
	meta: {
		title: 'Für Agenturen | Vectreal',
		description:
			'[Platzhalter: ein Satz, was Agenturen mit Shopify-Kunden hier finden.]'
	},
	hero: {
		heading:
			'[Platzhalter: Überschrift für Agenturen, die Shopify-Shops bauen]',
		description: '[Platzhalter: ein Satz, was die Agentur bekommt.]'
	},
	/** Opens the hero for a visit from one of our letters; the organization comes from the letter's code. */
	letterGreeting: (organization: string) =>
		`[Platzhalter: Begrüßung für ${organization}]`,
	offer: {
		heading: '[Platzhalter: Das Angebot]',
		body: '[Platzhalter: ein kostenloses 3D-Modell eines Kundenprodukts, mit den Bedingungen, wie Moritz sie festlegt.]'
	},
	inStore: {
		heading: '[Platzhalter: So sieht es im Shop des Kunden aus]',
		body: '[Platzhalter: die Scroll-Sektion und die Galerie-Folie für Shopify-Produktseiten. Nur, was ausgeliefert ist.]',
		link: 'Anleitung zum Einbetten'
	},
	cta: {
		heading: '[Platzhalter: Überschrift über dem Aufruf]',
		description: '[Platzhalter: ein Satz zum nächsten Schritt.]',
		action: 'Kostenloses Modell anfragen'
	}
} as const
