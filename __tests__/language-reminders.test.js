/* Finding 1 from Codex's recheck of 31a93689.
 *
 * Switching language reschedules every queued reminder, because the OS bakes
 * the text in when the notification is scheduled and pending ones would
 * otherwise stay in the old language. It called the scheduler with no
 * preferences at all, and the scheduler's `{}` default means push on, renewal
 * alerts on and a three day lead. So changing language RE-ENABLED reminders
 * somebody had switched off, and quietly replaced a seven day choice with
 * three. Nothing errored: the scheduler was right the whole time and only the
 * caller was wrong, which is why a scheduler unit test could never find it.
 *
 * THIS IS A SOURCE-READING TEST AND IT IS NOT THE ONE I WANTED. The first
 * version drove the real store with mocked modules, the way
 * notification-race.test.js drives the real scheduler. It cannot work here, and
 * the reason is worth writing down so nobody spends an afternoon rediscovering
 * it: `rescheduleReminders` reaches its three dependencies through dynamic
 * `import()`, babel leaves those untransformed, and jest's VM rejects them with
 *
 *     TypeError: A dynamic import callback was invoked without
 *     --experimental-vm-modules   (ERR_VM_DYNAMIC_IMPORT_CALLBACK_MISSING_FLAG)
 *
 * The store's own catch swallows that, so the test went green on the assertion
 * side of nothing having run. It is a jest limitation only: Metro handles
 * dynamic import, so the shipped path is unaffected. Making it executable needs
 * a babel plugin devDependency or a transform change, which is not a trade
 * worth making for a three line caller.
 *
 * So: the BEHAVIOUR was verified by executing the real store outside jest,
 * against both the old and the new code. Old passed `undefined` as the third
 * argument; new passes `{pushEnabled: false, renewalAlerts: true,
 * renewalAlertDays: 3}`. What follows pins the shape of the fix so it cannot be
 * quietly undone, and says out loud that it is not proof the code ran. */

const fs = require("fs");
const path = require("path");
const read = (p) => fs.readFileSync(path.join(__dirname, "..", p), "utf8");

const STORE = read("lib/language-store.ts");
// Comments quote the old broken call, and a test that matches its own
// explanation is a test that passes while checking nothing. This project has
// been caught by that three times.
const CODE = STORE.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, "");

/** The scheduler call's arguments, split at the TOP level only.
 *
 *  Worth the dozen lines rather than a regex. The first version used
 *  `scheduleRenewalReminders\([^)]*prefs`, which stops dead at the `)` inside
 *  `useCurrencyStore.getState()`, and its companion `[^,)]+` happily matched
 *  half an expression. Both reported the wrong answer about code that was
 *  already correct. An argument list has nesting in it, so it needs counting,
 *  not matching. */
function callArgs() {
  const open = CODE.indexOf("scheduleRenewalReminders(");
  if (open === -1) return [];
  let depth = 0;
  let start = open + "scheduleRenewalReminders(".length;
  const args = [];
  for (let i = start; i < CODE.length; i++) {
    const c = CODE[i];
    if (c === "(" || c === "[" || c === "{") depth++;
    else if (c === ")" && depth === 0) {
      args.push(CODE.slice(start, i).trim());
      return args;
    } else if (c === ")" || c === "]" || c === "}") depth--;
    else if (c === "," && depth === 0) {
      args.push(CODE.slice(start, i).trim());
      start = i + 1;
    }
  }
  return args;
}

describe("changing language must not change anybody's notification settings", () => {
  it("reads the preferences the rest of the app writes", () => {
    // A different cache key would read undefined forever and look like it worked.
    expect(CODE).toMatch(/getQueryData[^\n]*\["notifications", "preferences"\]/);
  });

  it("passes them to the scheduler", () => {
    expect(callArgs()).toHaveLength(3);
    expect(callArgs()[2]).toMatch(/prefs/);
  });

  it("no longer calls the scheduler with only a list and a symbol", () => {
    /* The defect exactly: two arguments, so the scheduler's `{}` default
       decided somebody's notification settings for them. */
    expect(callArgs().length).toBeGreaterThan(2);
  });

  it("schedules nothing at all when preferences have not loaded", () => {
    /* Codex's review of 81b709ba. `prefs ?? {}` fixed the CACHED case and left
       this one open: the scheduler reads an absent preference as ON, which is
       right for the scheduler and wrong for this caller, because here it
       re-enables reminders somebody turned off.

       Skipping costs a language switch that leaves pending reminders in the
       old language until the dashboard's next refetch. Not skipping costs
       somebody notifications they explicitly opted out of. */
    expect(CODE).toMatch(/if \(!prefs\) return;/);
    expect(/prefs \?\? \{\}/.test(CODE)).toBe(false);
  });

  it("passes the preferences straight through once they exist", () => {
    // No defaulting on the way past, or the guard above is decorative.
    expect(callArgs()[2]).toBe("prefs");
  });

  it("still cannot fail the language change itself", () => {
    /* The reschedule is fire and forget inside its own try/catch on purpose:
       changing language must succeed with notifications denied, an empty cache,
       or an OS that refuses the schedule. That is also what hid the dynamic
       import failure above, which is the cost of the design and worth keeping
       anyway. */
    expect(CODE).toMatch(/catch \(e\)/);
    expect(CODE).toMatch(/console\.warn\("\[Language\] Could not reschedule reminders:"/);
  });

  it("the rule the scheduler applies to what it is given, mirrored", () => {
    // Runs for real, unlike everything above it. Absent is ON, explicit false
    // is OFF, and an unrecognised lead time falls back to three.
    const effective = (p = {}) => ({
      push: p.pushEnabled !== false,
      renewals: p.renewalAlerts !== false,
      lead: [1, 3, 7].includes(p.renewalAlertDays) ? p.renewalAlertDays : 3,
    });
    expect(effective()).toEqual({ push: true, renewals: true, lead: 3 });
    expect(effective({ pushEnabled: false })).toEqual({ push: false, renewals: true, lead: 3 });
    expect(effective({ renewalAlerts: false })).toEqual({ push: true, renewals: false, lead: 3 });
    expect(effective({ renewalAlertDays: 7 })).toEqual({ push: true, renewals: true, lead: 7 });
    expect(effective({ renewalAlertDays: 4 })).toEqual({ push: true, renewals: true, lead: 3 });
  });
});
