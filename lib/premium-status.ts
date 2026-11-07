/* TWO QUESTIONS THAT USED TO SHARE ONE BOOLEAN.

   `user.isPaid` answers "does this account have Premium right now". Free
   Premium also makes it true: the 14 day reverse trial every new account gets
   since 2026-11-07, and the referral bonus before it. That is the right answer
   for every feature gate, so the gates keep reading isPaid.

   Three places need the OTHER question, "is there a purchase behind it":
     - the purchase screen, which used to greet a trial user as "already
       Premium", and which must only call a purchase confirmed once the server
       says a paid plan exists (a trial user is Premium before AND after an
       unconfirmed purchase, so isPaid cannot tell the two apart);
     - Settings, whose "Manage subscription" row opens Google Play, where a
       trial user has nothing to manage;
     - anything that says when free Premium ends.

   A server from before 2026-11-07 sends no `hasPaidPlan`. Then isPaid is the
   only answer there is, and these helpers return exactly what the app did
   before, so a new bundle on an old server changes nothing. */

type PremiumUser = {
  isPaid?: boolean;
  hasPaidPlan?: boolean;
  bonusPremiumUntil?: string | null;
} | null | undefined;

/** True when a purchase stands behind the account's Premium. */
export function hasPaidPlan(user: PremiumUser): boolean {
  if (!user) return false;
  return typeof user.hasPaidPlan === "boolean" ? user.hasPaidPlan : !!user.isPaid;
}

/** When free Premium ends, for an account on free Premium with no purchase,
 *  as the server sent it. Null otherwise: paid, free tier, already ended, or
 *  an unreadable date. */
export function freePremiumUntil(user: PremiumUser, now: Date = new Date()): string | null {
  if (!user || !user.isPaid || hasPaidPlan(user) || !user.bonusPremiumUntil) return null;
  const end = Date.parse(user.bonusPremiumUntil);
  return Number.isFinite(end) && end > now.getTime() ? user.bonusPremiumUntil : null;
}
