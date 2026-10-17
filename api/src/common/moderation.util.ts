export type ModerationHit = {
  allowed: boolean;
  violationType?: 'adult_content' | 'harassment' | 'external_contact' | 'profanity';
  reason?: string;
};

const ADULT = ['sex', 'porn', 'xxx', 'nude', 'naked', 'jinsiy', 'yalangʻoch', "yalang'och"];
const HARASSMENT = ['stupid', 'idiot', 'hate', 'kill', 'ahmoq', 'jinni', 'oʻldiraman', "o'ldiraman"];
const PROFANITY = ['damn', 'hell', 'shit', 'fuck', 'bitch', 'jinni', 'harom'];
const CONTACT = [
  /\b\d{9,}\b/,
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/,
  /telegram|whatsapp|viber|instagram|facebook/i,
  /t\.me|wa\.me/i,
];

function hasWord(text: string, words: string[]) {
  return words.some((word) => text.includes(word));
}

/** Same keyword gate the app already uses, enforced on the server. */
export function moderateText(message: string): ModerationHit {
  const lower = message.toLowerCase();
  if (hasWord(lower, ADULT)) {
    return { allowed: false, violationType: 'adult_content', reason: 'Xabarda nomaqbul kontent bor' };
  }
  if (hasWord(lower, HARASSMENT)) {
    return { allowed: false, violationType: 'harassment', reason: 'Xabarda tahdid yoki haqorat bor' };
  }
  if (CONTACT.some((pattern) => pattern.test(message))) {
    return { allowed: false, violationType: 'external_contact', reason: 'Platformadan tashqari aloqa yozilmaydi' };
  }
  if (hasWord(lower, PROFANITY)) {
    return { allowed: false, violationType: 'profanity', reason: 'Xabarda nomaqbul soʻz bor' };
  }
  return { allowed: true };
}
