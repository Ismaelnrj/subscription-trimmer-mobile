export const MODULES = [
  {
    id: 'prospecting',
    title: 'Prospecting & Cold Outreach',
    icon: '🎯',
    color: '#2563eb',
    summary: 'Find the right people, get their attention, and earn the first conversation.',
    lessons: [
      {
        id: 'qualifying-leads',
        title: 'Finding & Qualifying Leads',
        sections: [
          {
            heading: 'Why qualification comes first',
            body: 'Most wasted sales effort goes into pitching people who were never going to buy. Before you write a single cold email, know who you are targeting and why they would care.',
          },
          {
            heading: 'The BANT framework',
            body: 'A simple way to qualify a lead before investing time:',
            list: [
              'Budget — can they realistically afford this?',
              'Authority — are you talking to someone who can say yes?',
              'Need — do they have the problem you solve?',
              'Timeline — is there urgency, or is this a "someday" project?',
            ],
          },
          {
            heading: 'Signals worth chasing',
            list: [
              'Recent funding round, hiring spree, or leadership change',
              'Public complaints about a problem you solve (reviews, social posts)',
              'Using a competitor or an outdated/manual workaround',
              'A trigger event: new office, new regulation, new system rollout',
            ],
          },
          {
            heading: 'Key takeaway',
            tip: 'Spend your prep time finding 10 great-fit leads, not 100 random ones. Quality of list beats volume of outreach almost every time.',
          },
        ],
      },
      {
        id: 'cold-outreach',
        title: 'Cold Calls & Cold Emails That Get Replies',
        sections: [
          {
            heading: 'The 10-second test',
            body: 'On a cold call, you have about 10 seconds before someone decides to hang up. In a cold email, you have one subject line and one opening sentence before it gets archived. Lead with relevance, not with your company.',
          },
          {
            heading: 'A cold call opener formula',
            list: [
              '"Hi [Name], this is [You] from [Company] — I know this is out of the blue..."',
              'State the reason for the call in one sentence, tied to THEM (not your product)',
              'Ask a permission-based question: "Do you have 30 seconds, or is this a bad time?"',
            ],
            body: 'Acknowledging the interruption disarms the instinct to hang up — it signals respect for their time.',
          },
          {
            heading: 'A cold email framework: P-A-S',
            list: [
              'Problem — name a specific problem they likely face',
              'Agitate — briefly show the cost of not solving it',
              'Solve — show how you help, with one proof point, and a low-friction next step',
            ],
          },
          {
            heading: 'Common mistakes',
            list: [
              'Leading with "I wanted to introduce myself and our company..."',
              'Asking for a 30-60 minute meeting on the very first touch',
              'Sending the same generic message to everyone on the list',
            ],
          },
          {
            heading: 'Key takeaway',
            tip: 'The goal of a cold touch is NOT to sell — it\'s to earn a small "yes" (a reply, a 15-minute call). Make that ask easy.',
          },
        ],
      },
    ],
    quiz: [
      {
        question: 'In the BANT framework, what does the "A" stand for?',
        options: ['Authority', 'Availability', 'Approach', 'Activity'],
        correct: 0,
        explanation: 'Authority — whether the person you\'re speaking to can actually make or strongly influence the buying decision.',
      },
      {
        question: 'What is the main goal of a FIRST cold outreach touch?',
        options: [
          'Close the deal on the spot',
          'Earn a small next step, like a short call or a reply',
          'Send the full pricing sheet',
          'Get them to sign an NDA',
        ],
        correct: 1,
        explanation: 'Cold outreach should ask for a small commitment — a reply, a quick call — not the whole relationship at once.',
      },
      {
        question: 'Which is a strong "trigger event" signal worth acting on quickly?',
        options: [
          'The company logo changed color',
          'They posted a generic holiday message',
          'They just hired a new VP in the department you sell to',
          'Their website is more than 2 years old',
        ],
        correct: 2,
        explanation: 'New leadership often re-evaluates vendors and tools — it\'s a classic window of opportunity.',
      },
      {
        question: 'What does the "Agitate" step in the P-A-S email framework do?',
        options: [
          'Makes the prospect angry at your competitor',
          'Briefly highlights the cost/pain of NOT solving the problem',
          'Adds urgency by threatening to remove a discount',
          'Lists every feature of your product',
        ],
        correct: 1,
        explanation: 'Agitate connects the problem to a real consequence, which builds motivation to act — without exaggerating or fear-mongering.',
      },
      {
        question: 'On a cold call, what should you do in roughly the first 10 seconds?',
        options: [
          'Launch into your full pitch',
          'Acknowledge the interruption and state a relevant reason for calling',
          'Ask for their email address',
          'Apologize repeatedly for calling',
        ],
        correct: 1,
        explanation: 'Acknowledging the cold call and giving a relevant reason builds quick trust and keeps them on the line.',
      },
    ],
  },

  {
    id: 'pitching',
    title: 'Pitching & Negotiation',
    icon: '💬',
    color: '#7c3aed',
    summary: 'Run great discovery, present value clearly, and negotiate without giving everything away.',
    lessons: [
      {
        id: 'discovery-spin',
        title: 'Discovery: Asking Before Telling',
        sections: [
          {
            heading: 'Why discovery comes before the pitch',
            body: 'A pitch built on assumptions is a guess. A pitch built on what the prospect just told you is tailored — and tailored pitches close more often.',
          },
          {
            heading: 'The SPIN framework',
            list: [
              'Situation — understand their current setup ("How are you handling X today?")',
              'Problem — surface pain points ("What\'s frustrating about that process?")',
              'Implication — explore the cost of the problem ("What happens if this doesn\'t get fixed?")',
              'Need-payoff — let THEM state the value ("If you could fix that, what would it mean for the team?")',
            ],
          },
          {
            heading: 'Listen for buying language',
            body: 'When a prospect describes the impact of a problem in their own words ("we lose about a day a week to this"), that phrase becomes the centerpiece of your pitch later.',
          },
          {
            heading: 'Key takeaway',
            tip: 'Aim for roughly 70% them talking, 30% you talking during discovery. If you\'re doing most of the talking, you\'re pitching too early.',
          },
        ],
      },
      {
        id: 'value-pitch',
        title: 'Pitching on Value, Not Features',
        sections: [
          {
            heading: 'Features tell, outcomes sell',
            body: 'Nobody buys a feature for its own sake — they buy what it lets them do, or what pain it removes. Translate every feature into an outcome relevant to THIS prospect\'s situation.',
            list: [
              'Feature: "Automated weekly reports"',
              'Outcome: "Your team gets back the ~3 hours a week they currently spend building these manually"',
            ],
          },
          {
            heading: 'Mirror their language',
            body: 'If discovery surfaced a phrase like "we\'re flying blind on renewals," reuse that exact phrase in your pitch. It signals you were truly listening.',
          },
          {
            heading: 'Negotiation basics',
            list: [
              'Never be the first to name a number if you can help it — ask about budget/range first',
              'Trade, don\'t just give: "I can do that price if we move to an annual contract"',
              'Silence is a tool — after stating your price, stop talking',
              'Separate "price" objections from "value" objections — they need different responses',
            ],
          },
          {
            heading: 'Key takeaway',
            tip: 'Anchor every claim to something the prospect told you in discovery. Generic pitches feel like spam; specific ones feel like solutions.',
          },
        ],
      },
    ],
    quiz: [
      {
        question: 'In the SPIN framework, what is the purpose of "Implication" questions?',
        options: [
          'To introduce your product features',
          'To explore the downstream cost/impact of the problem',
          'To ask for the sale',
          'To schedule the next meeting',
        ],
        correct: 1,
        explanation: 'Implication questions help the prospect realize how big the problem really is — building urgency naturally.',
      },
      {
        question: 'Roughly what talk-time ratio should you aim for during discovery?',
        options: [
          '70% you, 30% them',
          '50% you, 50% them',
          '70% them, 30% you',
          '100% you',
        ],
        correct: 2,
        explanation: 'Discovery is about listening. If you\'re talking more than the prospect, you\'re likely pitching too soon.',
      },
      {
        question: '"Automated weekly reports" is an example of a:',
        options: ['Outcome', 'Feature', 'Objection', 'Discount'],
        correct: 1,
        explanation: 'It describes what the product does. The OUTCOME would be the time/effort it saves the prospect.',
      },
      {
        question: 'When negotiating price, why is it useful to avoid naming a number first?',
        options: [
          'It\'s rude to discuss money',
          'It lets you understand their budget/range before anchoring',
          'It guarantees a higher price always',
          'It is a legal requirement',
        ],
        correct: 1,
        explanation: 'Understanding their range first helps you anchor appropriately and avoid leaving value on the table — or pricing yourself out immediately.',
      },
      {
        question: 'After stating your price during negotiation, what should you typically do?',
        options: [
          'Immediately offer a discount',
          'Keep talking to fill the silence',
          'Stop talking and let them respond',
          'Change the subject',
        ],
        correct: 2,
        explanation: 'Silence after stating a price puts gentle pressure on the other side to respond first — talking through it often leads to self-discounting.',
      },
    ],
  },

  {
    id: 'objections',
    title: 'Objection Handling',
    icon: '🛡️',
    color: '#dc2626',
    summary: 'Turn pushback into a normal part of the conversation — and sometimes into the reason they buy.',
    lessons: [
      {
        id: 'objection-frameworks',
        title: 'Frameworks for Any Objection',
        sections: [
          {
            heading: 'Objections are information, not rejection',
            body: 'An objection usually means the prospect is engaged enough to voice a real concern. Silence and "I\'ll think about it" without explanation are often worse signs.',
          },
          {
            heading: 'Feel-Felt-Found',
            list: [
              '"I understand how you FEEL about that"',
              '"Other customers FELT the same way initially"',
              '"What they FOUND was..."',
            ],
            body: 'This validates the concern, normalizes it, and pivots to evidence — without arguing.',
          },
          {
            heading: 'The 4-step objection loop',
            list: [
              'Acknowledge — don\'t argue or interrupt',
              'Clarify — "When you say X, do you mean...?" (often reveals the REAL objection)',
              'Respond — address the real concern with a relevant point or proof',
              'Confirm — "Does that address your concern?"',
            ],
          },
          {
            heading: 'Key takeaway',
            tip: 'Never argue with an objection. Get curious about it first — half the time the stated objection isn\'t the real one.',
          },
        ],
      },
      {
        id: 'price-and-stalls',
        title: '"It\'s Too Expensive" & "I Need to Think About It"',
        sections: [
          {
            heading: 'Price objections: separate cost from value',
            body: '"Too expensive" almost always means "not worth it to me yet" — not literally that the number is too high. Reconnect the price to the value/outcome established earlier.',
            list: [
              '"Compared to what?" (uncovers the comparison they\'re making)',
              '"What would make this a no-brainer at this price?"',
              '"Let\'s set price aside for a second — if cost weren\'t a factor, is this the right solution?"',
            ],
          },
          {
            heading: '"I need to think about it"',
            body: 'This is often a polite way to end the conversation without conflict. Get specific.',
            list: [
              '"Totally understand. Just so I can be useful — is it the price, the timing, or something about the solution itself you\'re weighing?"',
              '"What questions do you think you\'ll be asking yourself this week?"',
              '"Is there anyone else who needs to weigh in before you decide?"',
            ],
          },
          {
            heading: 'Stalling vs. real objection',
            body: 'A real objection has specifics attached once you ask. A pure stall stays vague no matter how you probe — in that case, leave the door open gracefully and set a concrete follow-up.',
          },
          {
            heading: 'Key takeaway',
            tip: 'Your job isn\'t to eliminate every objection on the spot — it\'s to understand it well enough to know your next honest step.',
          },
        ],
      },
    ],
    quiz: [
      {
        question: 'What does the "Felt" step in Feel-Felt-Found do?',
        options: [
          'Argues that the prospect is wrong to feel that way',
          'Normalizes the concern by showing others had it too',
          'Ends the conversation',
          'Offers an immediate discount',
        ],
        correct: 1,
        explanation: 'It shows the prospect they aren\'t alone in their concern, lowering defensiveness before you share evidence.',
      },
      {
        question: 'In the 4-step objection loop, what comes right after "Acknowledge"?',
        options: ['Respond', 'Confirm', 'Clarify', 'Close'],
        correct: 2,
        explanation: 'Clarifying first often reveals that the real objection is different from what was first said.',
      },
      {
        question: '"It\'s too expensive" most often really means:',
        options: [
          'The literal number is mathematically impossible for them',
          'They don\'t yet see enough value to justify the price',
          'They want a free trial',
          'They want to end the relationship permanently',
        ],
        correct: 1,
        explanation: 'Price objections are usually value objections in disguise — reconnect to the outcomes that matter to them.',
      },
      {
        question: 'A good response to "I need to think about it" tries to:',
        options: [
          'Pressure them into deciding immediately',
          'Get specific about what exactly they\'re weighing',
          'Hang up and move on',
          'Offer to lower the price by half',
        ],
        correct: 1,
        explanation: 'Getting specific helps you understand whether it\'s a real objection (which you can address) or a polite stall.',
      },
      {
        question: 'How can you tell a real objection apart from a pure stall?',
        options: [
          'Real objections get more specific when you probe; stalls stay vague',
          'Real objections are always about price',
          'Stalls are always said loudly',
          'There is no way to tell',
        ],
        correct: 0,
        explanation: 'Probing a real objection surfaces concrete details. A stall tends to stay non-specific no matter how you ask.',
      },
    ],
  },

  {
    id: 'closing',
    title: 'Closing & Follow-up',
    icon: '🤝',
    color: '#059669',
    summary: 'Ask for the business confidently, and keep the relationship alive after "yes" — or "not yet".',
    lessons: [
      {
        id: 'closing-techniques',
        title: 'Closing Techniques That Don\'t Feel Pushy',
        sections: [
          {
            heading: 'Closing is a natural next step, not a trick',
            body: 'If discovery and the pitch were done well, closing should feel like the obvious next sentence — not a manipulative maneuver.',
          },
          {
            heading: 'A few reliable closes',
            list: [
              'Assumptive close — "Great, I\'ll get the agreement over to you today — does [date] work for kickoff?"',
              'Summary close — recap the agreed value/pain points, then ask "Does it make sense to move forward?"',
              'Options close — "Would you prefer to start with the standard plan or the team plan?"',
              'Trial/pilot close — for hesitant buyers, propose a smaller, lower-risk first step',
            ],
          },
          {
            heading: 'Reading buying signals',
            list: [
              'They start asking implementation/logistics questions ("How long does onboarding take?")',
              'They say "we" when describing using the product',
              'They ask about contract terms or who else needs to be involved',
            ],
            body: 'These are cues that it\'s time to ask for the business — don\'t keep pitching past this point.',
          },
          {
            heading: 'Key takeaway',
            tip: 'The biggest closing mistake is simply not asking. If the conversation has earned it, ask directly and clearly.',
          },
        ],
      },
      {
        id: 'follow-up',
        title: 'Follow-up & Long-Term Relationships',
        sections: [
          {
            heading: 'Most deals aren\'t lost — they\'re abandoned',
            body: 'Many "no"s are actually "not right now"s. A thoughtful follow-up cadence keeps you top-of-mind without becoming annoying.',
          },
          {
            heading: 'A simple follow-up cadence',
            list: [
              'Day 1: Recap email — what was discussed, agreed next steps',
              'Day 3-4: Share something useful (an article, a quick answer to something they raised)',
              'Day 7-10: Check in on the decision timeline',
              'Day 21+: "Still the right time?" check-in, spaced out further if no response',
            ],
          },
          {
            heading: 'After a "no" — keep the door open',
            list: [
              '"Totally understand — would it be okay if I checked back in [timeframe]?"',
              'Ask what would need to change for it to make sense later',
              'Stay useful: occasional relevant content keeps you remembered without pressure',
            ],
          },
          {
            heading: 'After a "yes" — protect the relationship',
            body: 'The sale is the start of the relationship, not the end. A smooth handoff/onboarding and an early check-in massively reduce churn and create referral opportunities.',
          },
          {
            heading: 'Key takeaway',
            tip: 'Consistent, useful follow-up is one of the highest-leverage, lowest-cost activities in sales — most people simply stop too early.',
          },
        ],
      },
    ],
    quiz: [
      {
        question: 'What is the "assumptive close"?',
        options: [
          'Assuming the prospect will say no',
          'Moving forward with next steps as if the decision to proceed has been made',
          'Refusing to discuss price',
          'Ending the call abruptly',
        ],
        correct: 1,
        explanation: 'It frames the conversation around logistics of moving forward, which is natural when the conversation has earned it.',
      },
      {
        question: 'Which of these is a buying signal?',
        options: [
          'They ask how long onboarding takes',
          'They stop responding entirely',
          'They ask you to remove them from the list',
          'They reschedule the call three times',
        ],
        correct: 0,
        explanation: 'Logistics/implementation questions usually mean they\'re mentally already past the "should we?" stage.',
      },
      {
        question: 'What is the biggest closing mistake mentioned in the lesson?',
        options: [
          'Asking too many questions',
          'Simply not asking for the business when it\'s warranted',
          'Sending a follow-up email',
          'Offering a pilot',
        ],
        correct: 1,
        explanation: 'Many reps over-pitch and never actually ask — leaving deals to stall on their own.',
      },
      {
        question: 'A good first follow-up after a sales call (Day 1) should typically:',
        options: [
          'Repeat the entire pitch from scratch',
          'Recap what was discussed and the agreed next steps',
          'Ask for payment immediately',
          'Wait at least a month before any contact',
        ],
        correct: 1,
        explanation: 'A short recap keeps both sides aligned and creates a paper trail of agreed next steps.',
      },
      {
        question: 'Why does the relationship matter AFTER a "yes"?',
        options: [
          'It doesn\'t — the work is done once they sign',
          'A smooth onboarding and check-ins reduce churn and create referral opportunities',
          'Only legal/finance teams need to be involved after signing',
          'Follow-up after signing is illegal in most industries',
        ],
        correct: 1,
        explanation: 'The sale is the start of the customer relationship — early attention pays off in retention and referrals.',
      },
    ],
  },
];

export function getModule(moduleId) {
  return MODULES.find((m) => m.id === moduleId);
}

export function getLesson(moduleId, lessonId) {
  const mod = getModule(moduleId);
  return mod?.lessons.find((l) => l.id === lessonId);
}

export function totalLessonCount() {
  return MODULES.reduce((sum, m) => sum + m.lessons.length, 0);
}
