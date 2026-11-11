// ---------------------------------------------------------------------------
// Agency page (`/agenturen`)
//
// Where an agency letter's short address forwards. German only, like the
// agency letters, and Moritz's own voice. Approved by Moritz on 10 Nov; from
// here on this file is the only version, and changes go through a PR.
//
// Its own module rather than a block in `product-copy.ts`, which every
// marketing page bundles: only this route should pay for these strings.
// ---------------------------------------------------------------------------

const LEAD =
	'Ich mache aus drei Fotos eines Produkts ein 3D-Modell, das Kundinnen und Kunden im Shop selbst drehen können. Für Agenturen mache ich das unter Ihrem Namen: Sie bieten es Ihren Kunden an, ich liefere Ihnen die Dateien.'

export const AGENCY_PAGE_COPY = {
	meta: {
		title: '3D-Modelle für die Shopify-Shops Ihrer Kunden | Vectreal',
		description: LEAD
	},
	/** Opens the hero for a visit from one of our letters; the organization comes from the letter's code. */
	letterGreeting: (organization: string) => `Guten Tag, ${organization}.`,
	hero: {
		heading: '3D-Modelle für die Shopify-Shops Ihrer Kunden, unter Ihrem Namen',
		description: LEAD,
		/** The hero's one sentence on the phone's first screen, beside the turning product. */
		lead: 'Ich mache aus drei Fotos eines Produkts ein 3D-Modell, das Kundinnen und Kunden im Shop selbst drehen können.',
		sceneLabel: 'Ein Beispielprodukt in 3D, zum Drehen'
	},
	audience: {
		heading: 'Für Agenturen mit Shopify-Kunden',
		paragraphs: [
			'Für Agenturen, die Shopify-Shops für Marken mit greifbaren Produkten bauen: Möbel, Leuchten, Küche, Kaffee, Tierbedarf, Design. Am besten eignen sich Produkte mit festen Oberflächen. Glas, Emaille und Gusseisen sind schwierig; ob ein Produkt geht, sage ich Ihnen, bevor ich anfange.',
			'Einigen Marken habe ich direkt geschrieben. Betreuen Sie eine davon, sagen Sie es mir: dann läuft alles Weitere über Sie.'
		]
	},
	offer: {
		heading: 'Ein Modell kostenlos',
		paragraphs: [
			'Ein Produkt eines Ihrer Kunden mache ich kostenlos als 3D-Modell, wenn Ihr Kunde einverstanden ist. Sie schicken mir drei Fotos und bestätigen im Formular, dass Ihr Kunde einverstanden ist. Reichen die Fotos, haben Sie das Modell in zwei Werktagen, als GLB- und USDZ-Datei für Shopifys eigenen 3D-Platz in der Produktgalerie.',
			'Ein Modell aus Fotos bildet das Produkt nach. Ob es gut genug ist, entscheiden Sie und Ihr Kunde, bevor etwas live geht.'
		]
	},
	inStore: {
		heading: 'So sieht es im Shop Ihres Kunden aus',
		intro: 'Drei Wege, die sich kombinieren lassen.',
		ways: [
			{
				label: 'Shopifys eigener 3D-Platz.',
				paragraphs: [
					'Das Modell kommt wie ein Foto als Produktmedium in die Galerie, und Shopify zeigt es mit seinem eigenen Viewer. Dafür braucht es keine App und keine Theme-Änderung, wenn das Theme 3D-Modelle unterstützt. Alle Online-Store-2.0-Themes von Shopify tun das.'
				]
			},
			{
				label: 'Die 3D-Szene unter den Produktdetails.',
				paragraphs: [
					'Ein Abschnitt im Theme zeigt die veröffentlichte Szene mit ihrem Licht und ihren Kameras. Während der Kunde scrollt, fährt die Szene ihre Kameras nacheinander an, und zu jeder Station kann eine kurze Überschrift mit Text stehen. Hält er an, erscheint „Selbst drehen“: ein Tipp, und er dreht das Modell selbst. Scrollt er weiter, übernimmt wieder die Tour. Ist auf dem Gerät reduzierte Bewegung eingestellt, gibt es keine Scroll-Tour: Die Szene steht still auf der Seite, und der Kunde dreht sie selbst und wechselt mit den Kamera-Schaltflächen des Viewers zwischen den Stationen.',
					'Eingebaut wird der Abschnitt einmal pro Theme: Er kommt als neue Datei in den Code-Editor des Themes, danach fügen Sie ihn im Theme-Editor in die Produktvorlage ein. Die Domains des Shops müssen in den erlaubten Domains der Szene stehen.'
				]
			},
			{
				label: 'Die Szene in der Produktgalerie.',
				paragraphs: [
					'Ein Snippet setzt die Szene als eigene Ansicht in die Galerie, neben die Fotos und den 3D-Platz. Dafür kommt eine Zeile in das Galerie-Snippet des Themes; die Anleitung ist für Dawn, Shopifys Standard-Theme. Welche Szene ein Produkt zeigt, steht in einem Metafeld des Produkts, und Produkte ohne Szene zeigen keine zusätzliche Ansicht.'
				]
			}
		],
		closing:
			'In allen drei Fällen dreht der Kunde das Modell selbst. Die Szene hat einen Namen und eine Beschreibung, die Screenreader vorlesen, lässt sich mit der Tastatur drehen und berücksichtigt die Einstellung für reduzierte Bewegung. Vollbild lässt sich pro Szene ein- oder ausschalten. Die eingebettete Szene lädt auf der Seite des Shops keine Analyse-Software.',
		link: {
			label: 'Anleitung zum Einbauen (englisch)',
			href: '/docs/guides/publish-embed#shopify-a-section-that-tours-the-scene-on-scroll'
		}
	},
	terms: {
		heading: 'So arbeiten wir zusammen',
		items: [
			'120 € pro Produkt, im Paket von 30 Produkten über sechs Monate',
			'fertig in fünf Arbeitstagen, als GLB- und USDZ-Datei',
			'White-Label für die Modelldateien: Ihr Kunde sieht Ihren Namen, nicht meinen',
			'gefällt ein Modell nicht, mache ich es neu, oder es kostet nichts',
			'auf Wunsch ein Auftragsverarbeitungsvertrag und ein Test in Shopware',
			'Die Dateien im 3D-Platz gehören Ihrem Kunden, und Shopify hostet sie.',
			'Die 3D-Szene läuft bei Vectreal: bis zu drei veröffentlichte Szenen kostenlos, mit Vectreal-Hinweis. Ohne Hinweis und für mehr Szenen: sprechen Sie mich an.'
		],
		contact:
			'Ich antworte werktags innerhalb eines Tages per E-Mail; ein Telefonat machen wir gern aus.'
	},
	request: {
		heading: 'Anfrage',
		body: 'Drei Fotos eines Produkts und das Einverständnis Ihres Kunden: Mehr brauche ich für das erste Modell nicht.',
		signature: 'Moritz Becker, Hamburg'
	},
	action: 'Kostenloses Modell anfragen'
} as const
