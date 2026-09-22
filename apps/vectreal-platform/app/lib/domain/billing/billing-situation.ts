import {
	BILLING_STATES_DOWNGRADED_TO_FREE,
	type BillingState,
	type Plan
} from '../../../constants/plan-config'
import { PLAN_DISPLAY_NAMES } from '../../../constants/product-copy'

/**
 * What is happening with this organization's money, in one sentence.
 *
 * The billing page's job is not to show a plan name. It is to answer "am I
 * being charged, and is anything wrong", and the plan name is one input to
 * that. The page used to answer neither: it printed the plan, a state badge and
 * a renewal date under a header promising "your plan, and how it is paid for",
 * and for the free organizations that are every account in production it
 * printed the single word `Free`.
 *
 * This is the shape `usage-verdict.ts` gives the usage page, for the same
 * reason and into the same slot - the header's description, which states what
 * is true of the route right now. A static sentence there can only restate the
 * title.
 *
 * **`remedy` is present exactly when there is something to say next, and
 * `isProblem` says whether that thing is wrong.** They were one boolean at
 * first, which forced a contradiction: a cancellation is a blocking state, so
 * it flagged for attention, and the notice it raised had nothing in it because
 * a completed cancellation has no remedy. Splitting them lets the one state a
 * reader chose on purpose carry a reassurance instead of an alarm.
 *
 * The page used to keep its own six-member list of states worth warning about,
 * beside the sets `plan-config.ts` already exports. There is no list here: the
 * words are written per state, which is what varies, and the component renders
 * a notice whenever there are words.
 *
 * **`effectivePlan` is the plan the reader actually holds**, which is not the
 * one stored against them. A canceled subscription keeps `plan: 'pro'` in the
 * row while access has reverted to Free, and the page printed that row - so a
 * canceled organization read `Pro` in the panel above a sentence saying it was
 * back on Free. `resolveEffectivePlan` already computes this and is private to
 * `entitlement-service.server.ts`, which is a server module a component cannot
 * import; two other callers were noted as going without it, and this page was a
 * third. The set it turns on is exported, so the rule is stated here in the one
 * place a client can reach.
 */

/**
 * Whether a plan change is applied in place rather than through Stripe's
 * hosted checkout.
 *
 * All three conditions, in one place, because two places had two answers. The
 * checkout route requires a subscription id, a customer id and an `active`
 * state: with them it updates the subscription and prorates, without them it
 * opens a hosted checkout so payment details can be re-entered. The upgrade
 * page re-derived it from `billingState` alone, under a comment saying it
 * "mirrors the server-side route decision", so an organization holding an
 * `active` row with no Stripe subscription was promised an immediate prorated
 * change and sent to a checkout page instead.
 *
 * The page cannot run this itself: the two ids do not leave the server, and
 * should not. The loader runs it and ships the answer.
 */
export function planChangeAppliesImmediately(input: {
	billingState: BillingState
	stripeSubscriptionId: string | null
	stripeCustomerId: string | null
}): boolean {
	return (
		input.billingState === 'active' &&
		input.stripeSubscriptionId !== null &&
		input.stripeCustomerId !== null
	)
}

export interface BillingSituation {
	/** The page's one-line answer, for the header description. */
	headline: string
	/** The plan whose limits and entitlements are actually in force. */
	effectivePlan: Plan
	/** What to do or know next, when there is something. */
	remedy: string | null
	/** Whether the remedy is a problem to fix rather than a fact to know. */
	isProblem: boolean
}

export interface BillingSituationInput {
	plan: Plan
	billingState: BillingState
	currentPeriodEnd: string | null
	trialEnd: string | null
}

/**
 * The dashboard's one spelling for an absolute date.
 *
 * `en-US` and not the machine default, which is what this line used to pass.
 * Every dashboard page is server-rendered, so an unpinned locale is formatted
 * once by the container and again by the browser, and the two disagree wherever
 * the reader is not American - a hydration mismatch that swaps the date under
 * them on load. `relative-time.tsx` pins the same three fields for the same
 * reason and this deliberately matches its spelling; a third caller should
 * extract them both rather than add a third.
 *
 * Not `PUBLISHED_COPY_LOCALE`, whose own docstring scopes it to prose rendered
 * by a machine rather than for a reader. This is the opposite case and only
 * happens to agree on the value.
 */
function formatDate(value: string): string {
	return new Date(value).toLocaleDateString('en-US', {
		month: 'short',
		day: 'numeric',
		year: 'numeric'
	})
}

export function describeBillingSituation(
	input: BillingSituationInput
): BillingSituation {
	/*
	  Computed once here rather than in each arm below, which would be the same
	  rule written nine times and is how the stored plan came to be printed in
	  the first place.
	*/
	const effectivePlan = BILLING_STATES_DOWNGRADED_TO_FREE.has(
		input.billingState
	)
		? 'free'
		: input.plan

	return { effectivePlan, ...describeState(input) }
}

function describeState({
	plan,
	billingState,
	currentPeriodEnd,
	trialEnd
}: BillingSituationInput): Omit<BillingSituation, 'effectivePlan'> {
	switch (billingState) {
		case 'none':
			/*
			  A paid plan with no billing state is a self-granted account - both
			  that exist in production are the owner's own. "Nothing is being
			  charged" is true of it and still wrong, because it reads as a Free
			  account.
			*/
			return {
				headline:
					plan === 'free'
						? 'Nothing is being charged.'
						: 'No subscription is attached to this plan.',
				remedy: null,
				isProblem: false
			}

		case 'trialing':
			return {
				headline: trialEnd
					? `Your trial ends ${formatDate(trialEnd)}.`
					: 'Your trial is running.',
				remedy: null,
				isProblem: false
			}

		case 'active':
			/*
			  A date already past is not a renewal date. `current_period_end` is
			  written only by `syncSubscriptionFromStripe`, which is reached from
			  the webhook and the checkout success page, so nothing advances it
			  across a renewal on its own - both production rows carrying a paid
			  plan have held a stale one for months. Printing it as the page's
			  headline would state a future that has already gone by.
			*/
			return {
				headline:
					currentPeriodEnd && new Date(currentPeriodEnd).getTime() > Date.now()
						? `Renews ${formatDate(currentPeriodEnd)}.`
						: 'Your subscription is active.',
				remedy: null,
				isProblem: false
			}

		case 'past_due':
			/*
			  No deadline. This read "update your payment method within 7 days,
			  after that the account becomes read-only", and neither half is true:
			  `past_due` is in neither `READ_ONLY_BILLING_STATES` nor
			  `BLOCKING_BILLING_STATES`, so access is untouched and stays that way;
			  the only writer of the state is `handleInvoicePaymentFailed`, nothing
			  moves a row off it on a timer, and there is no scheduler in the
			  product that could. What happens next is Stripe's retry policy, which
			  is an account setting this repo does not configure.

			  Same rule as the 90-day retention promise removed from `canceled`
			  below, which was inherited from the same constant.
			*/
			return {
				headline: 'A payment failed.',
				remedy: 'Update your payment method to settle the invoice.',
				isProblem: true
			}

		/*
		  "Read-only" is the internal name for these two states and it overstates
		  them to a reader. `READ_ONLY_BLOCKED_ENTITLEMENTS` holds exactly
		  `scene_upload` and `scene_publish`, and `dashboard-mutations.server.ts`
		  - which executes every create, rename, move and delete - consults the
		  billing state nowhere. So projects and folders can still be made,
		  everything can still be renamed and deleted, and what actually stops is
		  getting new work in and getting it out. Saying "the account is
		  read-only" would send someone looking for a lock that is not there.
		*/
		case 'unpaid':
			return {
				headline: 'Uploads and publishing are blocked.',
				remedy: 'Settle the outstanding invoice to start publishing again.',
				isProblem: true
			}

		case 'paused':
			return {
				headline: 'The subscription is paused.',
				remedy: 'Uploads and publishing stay blocked until it resumes.',
				isProblem: true
			}

		case 'canceled':
			/*
			  This sentence used to end "Scenes and assets exceeding Free limits
			  will be retained for 90 days before deletion" - a commitment made at
			  the one moment a reader is most likely to act on it, and one no
			  constant carries and no code keeps. It is replaced by what is
			  actually true: the limits are enforced where content is created, and
			  there is no scheduler in the product, so nothing deletes anything.
			*/
			return {
				/*
				  Names the subscription that ended, because the panel beside it now
				  names the plan in force. "Back on the Free plan" said the same
				  thing the panel says and left no room to say which plan was lost.
				*/
				headline:
					plan === 'free'
						? 'Your subscription was canceled.'
						: `Your ${PLAN_DISPLAY_NAMES[plan]} subscription was canceled.`,
				remedy:
					'Nothing was deleted. Everything you have made is still here, and publishing again needs room within the Free limits.',
				isProblem: false
			}

		case 'incomplete':
		case 'incomplete_expired':
			return {
				headline:
					billingState === 'incomplete'
						? 'Checkout was not completed.'
						: 'Checkout expired.',
				remedy: 'Nothing was charged. Start again whenever you are ready.',
				isProblem: false
			}
	}
}
