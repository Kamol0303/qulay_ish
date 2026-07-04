// AI ASSISTANT SERVICE
// Secure foundation for AI-powered platform assistance
// NO API KEYS HARDCODED - Uses environment variables only
// ============================================

import { debugLogger } from '../lib/debugLogger';

export type AIAssistantRole = 'worker' | 'employer' | 'admin' | 'general';
export type AILanguage = 'uz' | 'ru' | 'en';
export type AIMessageType = 'user' | 'assistant' | 'system';

export interface AIMessage {
  id: string;
  role: AIMessageType;
  content: string;
  timestamp: Date;
}

export interface AIConversation {
  id: string;
  userId: string;
  messages: AIMessage[];
  context: AIAssistantRole;
  createdAt: Date;
  updatedAt: Date;
}

export interface AIResponse {
  success: boolean;
  message?: string;
  error?: string;
  suggestions?: string[];
}

// ============================================
// AI CONFIGURATION
// ============================================

class AIConfig {
  private static instance: AIConfig;
  
  // API configuration from environment variables
  // NEVER hardcode API keys
  private config = {
    openai: {
      apiKey: import.meta.env.VITE_OPENAI_API_KEY || '',
      model: import.meta.env.VITE_OPENAI_MODEL || 'gpt-3.5-turbo',
      enabled: import.meta.env.VITE_OPENAI_ENABLED === 'true'
    },
    anthropic: {
      apiKey: import.meta.env.VITE_ANTHROPIC_API_KEY || '',
      model: import.meta.env.VITE_ANTHROPIC_MODEL || 'claude-3-sonnet',
      enabled: import.meta.env.VITE_ANTHROPIC_ENABLED === 'true'
    },
    // Fallback to mock mode if no API keys configured
    mockMode: import.meta.env.VITE_AI_MOCK_MODE === 'true'
  };

  private constructor() {}

  static getInstance(): AIConfig {
    if (!AIConfig.instance) {
      AIConfig.instance = new AIConfig();
    }
    return AIConfig.instance;
  }

  isEnabled(): boolean {
    return this.config.openai.enabled || this.config.anthropic.enabled || this.config.mockMode;
  }

  getProvider(): 'openai' | 'anthropic' | 'mock' {
    if (this.config.openai.enabled && this.config.openai.apiKey) return 'openai';
    if (this.config.anthropic.enabled && this.config.anthropic.apiKey) return 'anthropic';
    return 'mock';
  }

  getConfig() {
    return this.config;
  }
}

// ============================================
// PLATFORM TOPIC ENFORCEMENT
// ============================================

const ALLOWED_TOPICS = [
  // Job-related
  'ish', 'job', 'работ', 'вакан', 'vacancy',
  // Application-related
  'ariza', 'application', 'заявк', 'nomzod', 'candidate',
  // Contract-related
  'shartnoma', 'contract', 'контракт', 'kelishuv', 'agreement',
  // Profile-related
  'profil', 'profile', 'профил', 'account', 'hisob',
  // Platform features
  'platform', 'platforma', 'платформ', 'qidirish', 'search',
  'register', 'royxat', 'регистр', 'kirish', 'login', 'вход',
  // Dispute and verification
  'nizo', 'dispute', 'спор', 'tasdiqlash', 'verification', 'верифик',
  // General help
  'yordam', 'help', 'помощ', 'qanday', 'how', 'как',
  'qulay ish', 'dashboard', 'panel',
];

const BLOCKED_TOPICS = [
  // Programming & Tech
  'programming', 'dasturlash', 'программирование', 'code', 'kod', 'python',
  'javascript', 'java', 'html', 'css', 'database', 'sql', 'api',
  // Cybersecurity
  'hack', 'security', 'xavfsizlik', 'безопасн', 'password crack',
  'vulnerability', 'exploit', 'malware', 'virus',
  // Politics & Religion
  'politics', 'siyosat', 'политик', 'election', 'saylov',
  'religion', 'din', 'религи', 'church', 'mosque', 'masjid',
  // News & Current Events
  'news', 'yangilik', 'новост', 'current event',
  // General Knowledge (unrelated to platform)
  'weather', 'ob-havo', 'погод', 'history', 'tarix', 'истори',
  'science', 'ilm', 'наук', 'mathematics', 'matematika',
];

function isTopicAllowed(message: string): boolean {
  const lowerMessage = message.toLowerCase();
  
  // Check if message contains blocked topics
  for (const blocked of BLOCKED_TOPICS) {
    if (lowerMessage.includes(blocked.toLowerCase())) {
      return false;
    }
  }
  
  // Check if message contains allowed topics or is a general greeting
  const hasAllowedTopic = ALLOWED_TOPICS.some(topic => 
    lowerMessage.includes(topic.toLowerCase())
  );
  
  // Allow greetings and basic questions even without specific keywords
  const isGreeting = /^(salom|hello|привет|hi|assalomu|здравствуй)/i.test(lowerMessage);
  const isBasicQuestion = lowerMessage.length < 50;
  
  return hasAllowedTopic || (isGreeting && isBasicQuestion);
}

const OUT_OF_SCOPE_RESPONSES: Record<AILanguage, string> = {
  uz: "Kechirasiz, men faqat QULAY ISH platformasi bo'yicha yordam bera olaman. Ish qidirish, ariza topshirish, shartnoma tuzish va platforma xususiyatlari haqida savol bering.",
  ru: "Извините, я могу помочь только по вопросам платформы QULAY ISH. Задавайте вопросы о поиске работы, подаче заявок, заключении контрактов и функциях платформы.",
  en: "Sorry, I can only help with QULAY ISH platform-related questions. Ask me about job search, applications, contracts, and platform features."
};

// ============================================
// SYSTEM PROMPTS
// ============================================

// ============================================
// LANGUAGE ENFORCEMENT PROMPTS
// ============================================

const LANGUAGE_INSTRUCTIONS: Record<AILanguage, string> = {
  uz: "Faqat O'zbek tilida javob ber. Boshqa tillardan foydalanma.",
  ru: "Отвечай ТОЛЬКО на русском языке. Не используй другие языки.",
  en: "Respond ONLY in English. Do not use any other language."
};

function buildSystemPrompt(role: AIAssistantRole, language: AILanguage): string {
  const base = SYSTEM_PROMPTS[role];
  const langInstruction = LANGUAGE_INSTRUCTIONS[language] ?? LANGUAGE_INSTRUCTIONS.uz;
  return `${base}\n\nLANGUAGE RULE (STRICT): ${langInstruction}`;
}

const SYSTEM_PROMPTS = {
  worker: `You are a helpful assistant for workers on the Qulay Ish job platform in Uzbekistan.

STRICT RULES:
- ONLY answer questions about: job search, applications, profile management, contracts, platform usage
- DO NOT answer questions about: programming, cybersecurity, politics, religion, news, general knowledge
- If asked about unrelated topics, politely redirect to platform-related questions

Help workers with:
- Finding suitable jobs on the platform
- Writing effective job applications
- Understanding job requirements
- Managing their profile
- Communicating with employers
- Understanding contracts

Keep responses concise, professional, and in the user's language (Uzbek, Russian, or English).
Focus ONLY on platform-related assistance.`,

  employer: `You are a helpful assistant for employers on the Qulay Ish job platform in Uzbekistan.

STRICT RULES:
- ONLY answer questions about: job posting, reviewing applications, finding workers, contracts, platform features
- DO NOT answer questions about: programming, cybersecurity, politics, religion, news, general knowledge
- If asked about unrelated topics, politely redirect to platform-related questions

Help employers with:
- Creating effective job postings
- Reviewing applications
- Finding qualified workers
- Managing contracts
- Understanding platform features
- Best practices for hiring

Keep responses concise, professional, and in the user's language (Uzbek, Russian, or English).
Focus ONLY on platform-related assistance.`,

  admin: `You are a helpful assistant for administrators on the Qulay Ish platform.

STRICT RULES:
- ONLY answer questions about: platform management, user moderation, verification, system monitoring
- DO NOT answer questions about: programming, cybersecurity, politics, religion, news
- If asked about unrelated topics, politely decline

Help with:
- Platform management
- User moderation
- Verification processes
- System monitoring
- Analytics interpretation
- Policy enforcement

Keep responses concise and professional.`,

  general: `You are a helpful assistant for the Qulay Ish job platform in Uzbekistan.

STRICT RULES:
- ONLY answer questions about the job platform, its features, and how to use it
- DO NOT answer questions about: programming, cybersecurity, politics, religion, news, general knowledge
- If asked about unrelated topics, politely redirect to platform questions

Provide general platform guidance and answer questions about features.
Keep responses concise and professional.`
};

// ============================================
// LOCALIZED MOCK RESPONSES
// ============================================

const MOCK_RESPONSES: Record<AILanguage, {
  job_worker: string;
  job_employer: string;
  profile: string;
  application_worker: string;
  application_employer: string;
  contract: string;
  default: string;
}> = {
  uz: {
    job_worker: "Ish topish uchun **Ishlar** bo'limiga o'ting va filtrlardan foydalaning: tuman, toifa, narx. Mos ishga **Ariza topshirish** tugmasini bosing.",
    job_employer: "Ish e'lon qilish uchun panelingizda **Yangi e'lon berish** tugmasini bosing. Ish nomi, tavsif, narx va hududni to'ldiring.",
    profile: "Profilni yangilash uchun **Profilim** bo'limiga o'ting va **Tahrirlash** tugmasini bosing. Ko'nikmalar, tajriba va joylashuvni qo'shing.",
    application_worker: "Arizalaringizni **Mening arizalarim** bo'limida ko'rishingiz mumkin. Ish beruvchi javob berganda bildirishnoma olasiz.",
    application_employer: "Barcha arizalarni **Arizalar** bo'limida ko'rishingiz mumkin. Har bir arizani ko'rib chiqing va nomzodlarni qabul qiling yoki rad eting.",
    contract: "Shartnomalar ariza qabul qilingandan so'ng tuziladi. Ish boshlashdan oldin ikkala tomon imzolashi kerak. Shartnomalarni panelingizda boshqarishingiz mumkin.",
    default: "Qulay Ish platformasida yordam berish uchun shu yerdaman. Ishlar, arizalar, profil, shartnomalar haqida savol bering."
  },
  ru: {
    job_worker: "\u0427\u0442\u043e\u0431\u044b \u043d\u0430\u0439\u0442\u0438 \u0440\u0430\u0431\u043e\u0442\u0443, \u043f\u0435\u0440\u0435\u0439\u0434\u0438\u0442\u0435 \u0432 \u0440\u0430\u0437\u0434\u0435\u043b **\u0420\u0430\u0431\u043e\u0442\u0430** \u0438 \u0438\u0441\u043f\u043e\u043b\u044c\u0437\u0443\u0439\u0442\u0435 \u0444\u0438\u043b\u044c\u0442\u0440\u044b: \u0440\u0430\u0439\u043e\u043d, \u043a\u0430\u0442\u0435\u0433\u043e\u0440\u0438\u044f, \u0437\u0430\u0440\u043f\u043b\u0430\u0442\u0430. \u041d\u0430\u0436\u043c\u0438\u0442\u0435 **\u041f\u043e\u0434\u0430\u0442\u044c \u0437\u0430\u044f\u0432\u043a\u0443** \u043d\u0430 \u043f\u043e\u0434\u0445\u043e\u0434\u044f\u0449\u0443\u044e \u0432\u0430\u043a\u0430\u043d\u0441\u0438\u044e.",
    job_employer: "\u0427\u0442\u043e\u0431\u044b \u0440\u0430\u0437\u043c\u0435\u0441\u0442\u0438\u0442\u044c \u0432\u0430\u043a\u0430\u043d\u0441\u0438\u044e, \u043d\u0430\u0436\u043c\u0438\u0442\u0435 **\u0420\u0430\u0437\u043c\u0435\u0441\u0442\u0438\u0442\u044c \u0432\u0430\u043a\u0430\u043d\u0441\u0438\u044e** \u0432 \u043f\u0430\u043d\u0435\u043b\u0438. \u0417\u0430\u043f\u043e\u043b\u043d\u0438\u0442\u0435 \u043d\u0430\u0437\u0432\u0430\u043d\u0438\u0435, \u043e\u043f\u0438\u0441\u0430\u043d\u0438\u0435, \u0437\u0430\u0440\u043f\u043b\u0430\u0442\u0443 \u0438 \u0440\u0435\u0433\u0438\u043e\u043d.",
    profile: "\u0427\u0442\u043e\u0431\u044b \u043e\u0431\u043d\u043e\u0432\u0438\u0442\u044c \u043f\u0440\u043e\u0444\u0438\u043b\u044c, \u043f\u0435\u0440\u0435\u0439\u0434\u0438\u0442\u0435 \u0432 **\u041c\u043e\u0439 \u043f\u0440\u043e\u0444\u0438\u043b\u044c** \u0438 \u043d\u0430\u0436\u043c\u0438\u0442\u0435 **\u0420\u0435\u0434\u0430\u043a\u0442\u0438\u0440\u043e\u0432\u0430\u0442\u044c**. \u0414\u043e\u0431\u0430\u0432\u044c\u0442\u0435 \u043d\u0430\u0432\u044b\u043a\u0438, \u043e\u043f\u044b\u0442 \u0438 \u043c\u0435\u0441\u0442\u043e\u043f\u043e\u043b\u043e\u0436\u0435\u043d\u0438\u0435.",
    application_worker: "\u0412\u0430\u0448\u0438 \u0437\u0430\u044f\u0432\u043a\u0438 \u043d\u0430\u0445\u043e\u0434\u044f\u0442\u0441\u044f \u0432 \u0440\u0430\u0437\u0434\u0435\u043b\u0435 **\u041c\u043e\u0438 \u0437\u0430\u044f\u0432\u043a\u0438**. \u0412\u044b \u043f\u043e\u043b\u0443\u0447\u0438\u0442\u0435 \u0443\u0432\u0435\u0434\u043e\u043c\u043b\u0435\u043d\u0438\u0435, \u043a\u043e\u0433\u0434\u0430 \u0440\u0430\u0431\u043e\u0442\u043e\u0434\u0430\u0442\u0435\u043b\u044c \u043e\u0442\u0432\u0435\u0442\u0438\u0442.",
    application_employer: "\u0412\u0441\u0435 \u0437\u0430\u044f\u0432\u043a\u0438 \u0434\u043e\u0441\u0442\u0443\u043f\u043d\u044b \u0432 \u0440\u0430\u0437\u0434\u0435\u043b\u0435 **\u0417\u0430\u044f\u0432\u043a\u0438**. \u041f\u0440\u043e\u0441\u043c\u043e\u0442\u0440\u0438\u0442\u0435 \u043a\u0430\u0436\u0434\u0443\u044e \u0438 \u043f\u0440\u0438\u043c\u0438\u0442\u0435 \u0438\u043b\u0438 \u043e\u0442\u043a\u043b\u043e\u043d\u0438\u0442\u0435 \u043a\u0430\u043d\u0434\u0438\u0434\u0430\u0442\u043e\u0432.",
    contract: "\u041a\u043e\u043d\u0442\u0440\u0430\u043a\u0442\u044b \u0441\u043e\u0437\u0434\u0430\u044e\u0442\u0441\u044f \u043f\u043e\u0441\u043b\u0435 \u043f\u0440\u0438\u043d\u044f\u0442\u0438\u044f \u0437\u0430\u044f\u0432\u043a\u0438. \u041e\u0431\u0435 \u0441\u0442\u043e\u0440\u043e\u043d\u044b \u0434\u043e\u043b\u0436\u043d\u044b \u043f\u043e\u0434\u043f\u0438\u0441\u0430\u0442\u044c \u043f\u0435\u0440\u0435\u0434 \u043d\u0430\u0447\u0430\u043b\u043e\u043c \u0440\u0430\u0431\u043e\u0442\u044b. \u0423\u043f\u0440\u0430\u0432\u043b\u044f\u0439\u0442\u0435 \u043a\u043e\u043d\u0442\u0440\u0430\u043a\u0442\u0430\u043c\u0438 \u0432 \u043f\u0430\u043d\u0435\u043b\u0438.",
    default: "\u042f \u0437\u0434\u0435\u0441\u044c, \u0447\u0442\u043e\u0431\u044b \u043f\u043e\u043c\u043e\u0447\u044c \u0432\u0430\u043c \u0441 \u043f\u043b\u0430\u0442\u0444\u043e\u0440\u043c\u043e\u0439 Qulay Ish. \u0421\u043f\u0440\u0430\u0448\u0438\u0432\u0430\u0439\u0442\u0435 \u043e \u0432\u0430\u043a\u0430\u043d\u0441\u0438\u044f\u0445, \u0437\u0430\u044f\u0432\u043a\u0430\u0445, \u043f\u0440\u043e\u0444\u0438\u043b\u0435 \u0438\u043b\u0438 \u043a\u043e\u043d\u0442\u0440\u0430\u043a\u0442\u0430\u0445."
  },
  en: {
    job_worker: "To find jobs, go to the **Jobs** section and use filters: district, category, salary. Click **Apply** on any matching job.",
    job_employer: "To post a job, click **Post New Job** in your dashboard. Fill in the title, description, salary, and location.",
    profile: "To update your profile, go to **My Profile** and click **Edit**. Add your skills, experience level, and location.",
    application_worker: "View your applications in the **My Applications** section. You'll get a notification when an employer responds.",
    application_employer: "All applications are in the **Applications** section. Review each one and accept or reject candidates.",
    contract: "Contracts are created after an application is accepted. Both parties must sign before work begins. Manage contracts in your dashboard.",
    default: "I'm here to help you with the Qulay Ish platform. Ask me about jobs, applications, profiles, or contracts."
  }
};

// ============================================
// MOCK AI PROVIDER (for development/testing)
// ============================================

class MockAIProvider {
  async chat(messages: AIMessage[], context: AIAssistantRole, language: AILanguage = 'uz'): Promise<AIResponse> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    const lastMessage = messages[messages.length - 1];
    const query = lastMessage.content.toLowerCase();

    // Check if topic is allowed
    if (!isTopicAllowed(query)) {
      return { 
        success: true, 
        message: OUT_OF_SCOPE_RESPONSES[language] ?? OUT_OF_SCOPE_RESPONSES.uz 
      };
    }

    const r = MOCK_RESPONSES[language] ?? MOCK_RESPONSES.uz;

    if (query.includes('job') || query.includes('ish') || query.includes('работ') || query.includes('вакан')) {
      return { success: true, message: context === 'worker' ? r.job_worker : r.job_employer };
    }
    if (query.includes('profile') || query.includes('profil') || query.includes('профил')) {
      return { success: true, message: r.profile };
    }
    if (query.includes('application') || query.includes('ariza') || query.includes('заявк')) {
      return { success: true, message: context === 'worker' ? r.application_worker : r.application_employer };
    }
    if (query.includes('contract') || query.includes('shartnoma') || query.includes('контракт') || query.includes('договор')) {
      return { success: true, message: r.contract };
    }
    return { success: true, message: r.default };
  }
}

// ============================================
// OPENAI PROVIDER
// ============================================

class OpenAIProvider {
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model: string) {
    this.apiKey = apiKey;
    this.model = model;
  }

  async chat(messages: AIMessage[], context: AIAssistantRole, language: AILanguage = 'uz'): Promise<AIResponse> {
    try {
      // In production, call OpenAI API with language-enforced system prompt:
      /*
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: 'system', content: buildSystemPrompt(context, language) },
            ...messages.map(m => ({ role: m.role, content: m.content }))
          ],
          max_tokens: 500,
          temperature: 0.7
        })
      });
      const data = await response.json();
      return { success: true, message: data.choices[0].message.content };
      */
      const mockProvider = new MockAIProvider();
      return await mockProvider.chat(messages, context, language);
    } catch (error) {
      debugLogger.error('OpenAI API error:', error);
      return { success: false, error: 'Failed to get AI response' };
    }
  }
}

// ============================================
// AI ASSISTANT SERVICE
// ============================================

export const aiAssistantService = {
  /**
   * Check if AI assistant is available
   */
  isAvailable(): boolean {
    return AIConfig.getInstance().isEnabled();
  },

  /**
   * Get AI provider type
   */
  getProvider(): string {
    return AIConfig.getInstance().getProvider();
  },

  /**
   * Send a message to AI assistant
   */
  async chat(
    message: string,
    conversationHistory: AIMessage[] = [],
    context: AIAssistantRole = 'general',
    language: AILanguage = 'uz'
  ): Promise<AIResponse> {
    try {
      if (!this.isAvailable()) {
        return {
          success: false,
          error: 'AI assistant is not configured'
        };
      }

      // Validate topic before processing
      if (!isTopicAllowed(message)) {
        return {
          success: true,
          message: OUT_OF_SCOPE_RESPONSES[language] ?? OUT_OF_SCOPE_RESPONSES.uz
        };
      }

      // Add user message to history
      const newMessage: AIMessage = {
        id: Date.now().toString(),
        role: 'user',
        content: message,
        timestamp: new Date()
      };

      const messages = [...conversationHistory, newMessage];

      // Get provider
      const provider = AIConfig.getInstance().getProvider();
      const config = AIConfig.getInstance().getConfig();

      let response: AIResponse;

      switch (provider) {
        case 'openai': {
          const openai = new OpenAIProvider(config.openai.apiKey, config.openai.model);
          response = await openai.chat(messages, context, language);
          break;
        }
        case 'anthropic':
        case 'mock':
        default: {
          const mockProvider = new MockAIProvider();
          response = await mockProvider.chat(messages, context, language);
          break;
        }
      }

      return response;
    } catch (error) {
      debugLogger.error('AI assistant error:', error);
      return {
        success: false,
        error: 'Failed to process your request'
      };
    }
  },

  /**
   * Get quick suggestions based on user role
   */
  getQuickSuggestions(role: AIAssistantRole): string[] {
    const suggestions = {
      worker: [
        "How do I find jobs in my area?",
        "How do I write a good application?",
        "What should I include in my profile?",
        "How do contracts work?"
      ],
      employer: [
        "How do I post a job?",
        "How do I review applications?",
        "How do I create a contract?",
        "What are best practices for hiring?"
      ],
      admin: [
        "How do I verify users?",
        "How do I manage disputes?",
        "How do I view platform statistics?",
        "How do I moderate content?"
      ],
      general: [
        "What is Qulay Ish?",
        "How do I sign up?",
        "What features are available?",
        "How do I get started?"
      ]
    };

    return suggestions[role] || suggestions.general;
  },

  /**
   * Generate job posting suggestions
   */
  async suggestJobPosting(category: string, description: string): Promise<AIResponse> {
    const message = `I'm posting a ${category} job. Here's my description: ${description}. Can you suggest improvements?`;
    return this.chat(message, [], 'employer');
  },

  /**
   * Generate application message suggestions
   */
  async suggestApplicationMessage(jobTitle: string, userSkills: string[]): Promise<AIResponse> {
    const message = `I'm applying for a ${jobTitle} position. My skills are: ${userSkills.join(', ')}. Can you help me write a good application message?`;
    return this.chat(message, [], 'worker');
  },

  /**
   * Get profile improvement suggestions
   */
  async suggestProfileImprovements(profileData: any): Promise<AIResponse> {
    const message = `Can you suggest improvements for my profile? Current info: ${JSON.stringify(profileData)}`;
    return this.chat(message, [], 'worker');
  }
};
