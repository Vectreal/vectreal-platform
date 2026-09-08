# The look we are avoiding

Owner of: what marketing surfaces must not look like, and what to do instead.

Vectreal's marketing surfaces read as machine-made, and that costs trust before
it costs conversions. This file is the standing brief for any surface a
prospective customer sees.

## The one idea worth holding

**The tells are not the ingredients. They are the absence of a decision.**

Linear ships Inter and a purple accent - two of the most-named "AI slop"
signatures - and is the most-admired site in the category, because every choice
there is load-bearing and consistently applied. A model with no direction
reaches for the statistical centre of what it absorbed, and the centre is what
everyone recognises.

So the list below bans **defaults**, not ingredients. A banned item used
deliberately, consistently, and for a reason you can state is not a violation;
it is a decision. Using one because it was the first thing to hand is the
violation, and that is what the list is really detecting.

The corollary is that uniformity is the signature. Six identical cards, one
radius everywhere, one padding everywhere, every section built from the same
header component - that is what a system produces when nothing chose.

## Do not ship

**Colour**
- Purple or indigo accents; purple-to-blue and purple-to-cyan gradients
- Gradients used decoratively, anywhere they are not doing work
- Large coloured glows and coloured box-shadows
- Low-contrast mid-grey body text on a dark ground

**Type**
- A second face reached for per component. Two: `--font-heading` and
  `--font-sans`, per [typography.md](typography.md)
- An italic serif word dropped into a sans headline
- All-caps eyebrows applied reflexively, on every section, because the last
  section had one

**Layout**
- A pill badge sitting directly above or below the H1
- Three or four identical icon-over-title-over-one-line cards in a row
- A coloured 3-4px strip on the top or left edge of a card
- The untouched shadcn card: `rounded-2xl shadow-lg p-6`
- One radius and one padding on everything
- Glassmorphism and frosted panels
- Numbered 1-2-3 step rows
- A horizontal band of stat figures
- A logo cloud of logos the reader will not recognise, or "trusted by
  thousands" with no number behind it

**Imagery and motion**
- Decorative 3D blobs and abstract ambient shapes
- Stock photography of people at laptops
- Emoji standing in for icons
- Fade-up on scroll applied to every section

**Copy**
- "seamlessly", "robust", "powerful", "unlock the power of", "effortlessly",
  "get started today"
- The negation pivot: "It's not just X, it's Y"
- The rule of three used as a rhythm: "Fast, simple, and reliable"
- Em dashes used as a rhythmic crutch between clauses that wanted commas

## Ship instead

**Put the product on the page.** Vectreal ships a real 3D viewer. A working
viewer orbiting a real model, above the fold, is credibility that cannot be
faked, copied from a template, or generated - and it is the same asset the
product is built on. This is the single highest-value move available to this
brand, and it is the direct replacement for the decorative-3D-blob tell.

**One accent, doing one job.** `--orange` marks interactive state and the one
thing the reader should look at next. A brand colour sprayed across decoration
stops meaning anything.

**Say the specific thing.** A concrete noun phrase beats an adjective. Stripe's
"Financial infrastructure for the internet" is the model: it names what the
thing *is*. Numbers, formats, limits and file sizes are more persuasive than
any adjective, and this product has real ones.

**Build hierarchy by varying, not by repeating.** Different section rhythms,
different card sizes, deliberate asymmetry. If two things are equally important
the layout is probably wrong about one of them.

**Name your proof.** A customer with a name, a role and a number beats a logo
strip. If the logos are not recognisable, a real count is more honest and reads
better.

**Motion only where it says something.** See [motion.md](motion.md).

**Keep enough above the fold.** Airy heroes create a "false floor" - the reader
believes the page has ended and stops. Show the top of the next thing.

**Disclose progressively.** Technical depth belongs behind a deliberate
affordance, not flattened into an icon grid. That is the honest alternative to a
three-column feature row.

## When a rule and this file disagree

This file describes intent. [tokens.md](tokens.md),
[typography.md](typography.md), [elevation.md](elevation.md) and
[motion.md](motion.md) own the mechanics, and where one of them states a value,
it wins. Nothing here licenses a hand-rolled size or an off-ladder surface.

The evidence behind these claims, and the widely-repeated numbers that do not
survive checking, are in [evidence.md](evidence.md).

```claims
present  shared/components/src/styles/globals.css                                          --font-heading
present  shared/components/src/styles/globals.css                                          --tracking-eyebrow: 0.14em
present  apps/vectreal-platform/app/components/layout-components/page-hero.tsx             container-page
absent   apps/vectreal-platform/app/components/layout-components/page-hero.tsx             md:text-6xl
absent   apps/vectreal-platform/app/components/layout-components/page-hero.tsx             tracking-[0.22em]
```
