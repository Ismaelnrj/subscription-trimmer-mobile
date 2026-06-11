import Anthropic from '@anthropic-ai/sdk';
import { getApiKey, getModel } from './storage.js';

export class MissingApiKeyError extends Error {
  constructor() {
    super('No Anthropic API key configured. Add one in Settings.');
    this.name = 'MissingApiKeyError';
  }
}

function getClient() {
  const apiKey = getApiKey();
  if (!apiKey) throw new MissingApiKeyError();
  return new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
}

// Sends the roleplay conversation so far and returns the AI persona's next reply.
export async function getRoleplayReply(scenario, history) {
  const client = getClient();
  const response = await client.messages.create({
    model: getModel(),
    max_tokens: 400,
    system: scenario.systemPrompt,
    messages: history.map((m) => ({ role: m.role, content: m.content })),
  });
  return response.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('');
}

// Sends the full transcript and returns coaching feedback as markdown text.
export async function getCoachingFeedback(scenario, history) {
  const client = getClient();
  const transcript = history
    .map((m) => `${m.role === 'user' ? 'Sales Rep (user)' : 'Prospect'}: ${m.content}`)
    .join('\n');

  const response = await client.messages.create({
    model: getModel(),
    max_tokens: 600,
    system: scenario.coachingPrompt,
    messages: [
      {
        role: 'user',
        content: `Here is the roleplay transcript:\n\n${transcript}\n\nPlease give your coaching feedback now.`,
      },
    ],
  });
  return response.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('');
}

// Quick connectivity/key check used by the Settings page.
export async function testApiKey() {
  const client = getClient();
  await client.messages.create({
    model: getModel(),
    max_tokens: 10,
    messages: [{ role: 'user', content: 'Say "ok".' }],
  });
  return true;
}
