// Flashcard deck for the Leitner spaced-repetition system.
// Each card belongs to a module and has a front (prompt) and back (answer).
export const FLASHCARDS = [
  // Prospecting & Cold Outreach
  {
    id: 'fc-prospecting-1',
    moduleId: 'prospecting',
    front: 'What does BANT stand for?',
    back: 'Budget, Authority, Need, Timeline — a quick framework for qualifying a lead.',
  },
  {
    id: 'fc-prospecting-2',
    moduleId: 'prospecting',
    front: 'Name two examples of a "trigger event" worth acting on.',
    back: 'New leadership/funding round, or a hiring spree in the department you sell to (also: using a competitor or outdated workaround).',
  },
  {
    id: 'fc-prospecting-3',
    moduleId: 'prospecting',
    front: 'What is the "10-second test" in cold calling?',
    back: 'You have about 10 seconds before someone decides to hang up — lead with relevance to THEM, not your company.',
  },
  {
    id: 'fc-prospecting-4',
    moduleId: 'prospecting',
    front: 'What does P-A-S stand for in a cold email framework?',
    back: 'Problem, Agitate, Solve — name the problem, show the cost of not fixing it, then show how you help with a low-friction next step.',
  },
  {
    id: 'fc-prospecting-5',
    moduleId: 'prospecting',
    front: 'What is the goal of a FIRST cold outreach touch?',
    back: 'Earn a small "yes" — a reply or a short call — not to close the deal.',
  },
  {
    id: 'fc-prospecting-6',
    moduleId: 'prospecting',
    front: 'Why is a list of 10 great-fit leads better than 100 random ones?',
    back: 'Quality of targeting beats volume — your prep time is better spent finding people who actually fit your ideal customer profile.',
  },

  // Pitching & Negotiation
  {
    id: 'fc-pitching-1',
    moduleId: 'pitching',
    front: 'What does SPIN stand for?',
    back: 'Situation, Problem, Implication, Need-payoff — a discovery question framework.',
  },
  {
    id: 'fc-pitching-2',
    moduleId: 'pitching',
    front: 'What talk-time ratio should you aim for during discovery?',
    back: 'Roughly 70% them talking, 30% you. If you talk more, you\'re pitching too early.',
  },
  {
    id: 'fc-pitching-3',
    moduleId: 'pitching',
    front: '"Automated weekly reports" is a feature. What\'s the OUTCOME version?',
    back: '"Your team gets back the ~3 hours a week they spend building these manually" — translate features into outcomes for THIS prospect.',
  },
  {
    id: 'fc-pitching-4',
    moduleId: 'pitching',
    front: 'Why should you avoid naming a price first in negotiation?',
    back: 'Asking about their budget/range first helps you anchor appropriately and avoid leaving value on the table.',
  },
  {
    id: 'fc-pitching-5',
    moduleId: 'pitching',
    front: 'What should you do right after stating your price?',
    back: 'Stop talking. Silence puts gentle pressure on the other side to respond first.',
  },
  {
    id: 'fc-pitching-6',
    moduleId: 'pitching',
    front: 'Why mirror the prospect\'s exact language in your pitch?',
    back: 'Reusing their own phrases (e.g. "flying blind on renewals") signals you were truly listening during discovery.',
  },

  // Objection Handling
  {
    id: 'fc-objections-1',
    moduleId: 'objections',
    front: 'What does Feel-Felt-Found do?',
    back: 'Validates the concern ("I understand how you feel"), normalizes it ("others felt the same"), then pivots to evidence ("what they found was...").',
  },
  {
    id: 'fc-objections-2',
    moduleId: 'objections',
    front: 'List the 4 steps of the objection loop.',
    back: 'Acknowledge, Clarify, Respond, Confirm.',
  },
  {
    id: 'fc-objections-3',
    moduleId: 'objections',
    front: 'What does "It\'s too expensive" usually really mean?',
    back: 'They don\'t yet see enough value to justify the price — it\'s usually a value objection in disguise.',
  },
  {
    id: 'fc-objections-4',
    moduleId: 'objections',
    front: 'Give a good follow-up question to "I need to think about it."',
    back: '"Is it the price, the timing, or something about the solution itself you\'re weighing?" — get specific.',
  },
  {
    id: 'fc-objections-5',
    moduleId: 'objections',
    front: 'How do you tell a real objection from a pure stall?',
    back: 'Real objections get more specific the more you probe. Stalls stay vague no matter how you ask.',
  },
  {
    id: 'fc-objections-6',
    moduleId: 'objections',
    front: 'What should you NOT do when you hear an objection?',
    back: 'Don\'t argue or interrupt — get curious first. Half the time the stated objection isn\'t the real one.',
  },

  // Closing & Follow-up
  {
    id: 'fc-closing-1',
    moduleId: 'closing',
    front: 'What is the "assumptive close"?',
    back: 'Moving forward with next steps as if the decision has been made — e.g. "I\'ll send the agreement today, does Friday work for kickoff?"',
  },
  {
    id: 'fc-closing-2',
    moduleId: 'closing',
    front: 'Name a buying signal to listen for.',
    back: 'They start asking implementation/logistics questions, say "we" when describing using the product, or ask about contract terms.',
  },
  {
    id: 'fc-closing-3',
    moduleId: 'closing',
    front: 'What is the biggest closing mistake?',
    back: 'Simply not asking for the business when the conversation has earned it.',
  },
  {
    id: 'fc-closing-4',
    moduleId: 'closing',
    front: 'What should a Day-1 follow-up after a sales call include?',
    back: 'A recap of what was discussed and the agreed next steps.',
  },
  {
    id: 'fc-closing-5',
    moduleId: 'closing',
    front: 'After a "no", what\'s a good way to keep the door open?',
    back: '"Would it be okay if I checked back in a few months?" and ask what would need to change for it to make sense later.',
  },
  {
    id: 'fc-closing-6',
    moduleId: 'closing',
    front: 'Why does the relationship matter AFTER a "yes"?',
    back: 'A smooth onboarding and early check-ins reduce churn and create referral opportunities — the sale is the start, not the end.',
  },
];

export function getCardsForModule(moduleId) {
  return FLASHCARDS.filter((c) => c.moduleId === moduleId);
}
