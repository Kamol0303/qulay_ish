import { Injectable, Logger } from '@nestjs/common';

export type AiLanguage = 'uz' | 'ru' | 'en';

export interface AiCompletion {
  text: string;
  provider: 'anthropic' | 'openai' | 'mock';
}

const LANGUAGE_RULE: Record<AiLanguage, string> = {
  uz: "Faqat o'zbek tilida javob ber.",
  ru: 'Отвечай только на русском языке.',
  en: 'Respond only in English.',
};

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  private get anthropicKey(): string {
    return (process.env.ANTHROPIC_API_KEY || process.env.AI_API_KEY || '').trim();
  }

  private get openaiKey(): string {
    return (process.env.OPENAI_API_KEY || '').trim();
  }

  getProvider(): 'anthropic' | 'openai' | 'mock' {
    if (this.anthropicKey) return 'anthropic';
    if (this.openaiKey) return 'openai';
    return 'mock';
  }

  isLive(): boolean {
    return this.getProvider() !== 'mock';
  }

  languageRule(language: AiLanguage): string {
    return LANGUAGE_RULE[language] ?? LANGUAGE_RULE.uz;
  }

  /**
   * Low-level completion. Uses the configured provider (key from .env). Falls
   * back to a deterministic mock when no key is set so the feature degrades
   * gracefully instead of failing.
   */
  async complete(params: {
    system: string;
    user: string;
    maxTokens?: number;
    mockFallback: () => string;
  }): Promise<AiCompletion> {
    const provider = this.getProvider();
    const maxTokens = params.maxTokens ?? 700;

    try {
      if (provider === 'anthropic') {
        return { text: await this.callAnthropic(params.system, params.user, maxTokens), provider };
      }
      if (provider === 'openai') {
        return { text: await this.callOpenAi(params.system, params.user, maxTokens), provider };
      }
    } catch (err) {
      this.logger.error(`AI provider "${provider}" error — mock fallback`, err as Error);
      return { text: params.mockFallback(), provider: 'mock' };
    }

    return { text: params.mockFallback(), provider: 'mock' };
  }

  private async callAnthropic(system: string, user: string, maxTokens: number): Promise<string> {
    const model = (process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-latest').trim();
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': this.anthropicKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        system,
        messages: [{ role: 'user', content: user }],
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`Anthropic ${res.status}: ${detail.slice(0, 200)}`);
    }
    const data = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
    const text = (data.content || [])
      .filter((c) => c.type === 'text' && c.text)
      .map((c) => c.text as string)
      .join('\n')
      .trim();
    if (!text) throw new Error('Anthropic empty response');
    return text;
  }

  private async callOpenAi(system: string, user: string, maxTokens: number): Promise<string> {
    const model = (process.env.OPENAI_MODEL || 'gpt-4o-mini').trim();
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${this.openaiKey}`,
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        temperature: 0.6,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`OpenAI ${res.status}: ${detail.slice(0, 200)}`);
    }
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const text = data.choices?.[0]?.message?.content?.trim();
    if (!text) throw new Error('OpenAI empty response');
    return text;
  }
}
