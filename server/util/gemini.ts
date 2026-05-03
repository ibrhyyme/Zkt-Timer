/**
 * Gemini API runtime wrapper. Duyuru cevirisi icin kullanilir.
 * Mevcut scripts/translate-zh.mjs ile ayni endpoint + model + system prompt mantigini paylasir.
 */

const GEMINI_MODEL = 'gemini-2.5-flash-lite';
const GEMINI_URL = (apiKey: string) =>
	`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

const RETRY_DELAY_MS = 10_000;
const MAX_RETRIES = 3;

const SYSTEM_PROMPT = `You are a professional translator specializing in speedcubing / Rubik's cube apps.
Translate the provided Turkish (tr) announcement title and content into 4 languages: en (English), es (Spanish), ru (Russian), zh (Simplified Chinese).

Rules:
- Translate naturally; keep the marketing/announcement tone.
- Preserve {{placeholders}} like {{count}}, {{name}}, {{date}} exactly.
- Preserve markdown (**, *, [link](url), \`code\`, line breaks) exactly.
- Use proper speedcubing terminology in each language:
  - Rubik's cube / speedcubing: 魔方/速拧 (zh), кубик Рубика (ru)
  - scramble: 打乱 (zh), скрэмбл (ru)
  - solve: 还原 (zh), сборка (ru)
  - algorithm: 公式 (zh), алгоритм (ru)
  - session: 阶段 (zh), сессия (ru)
  - average: 平均 (zh), среднее (ru)
  - WCA, DNF, DNS, Pro: keep as-is in all languages
  - Timer: 计时器 (zh), таймер (ru)
  - leaderboard: 排行榜 (zh), таблица лидеров (ru)
- Return ONLY valid JSON matching this schema (no markdown, no code fences, no commentary):
{
  "title": {"en": "...", "es": "...", "ru": "...", "zh": "..."},
  "content": {"en": "...", "es": "...", "ru": "...", "zh": "..."}
}`;

interface TranslatedText {
	en: string;
	es: string;
	ru: string;
	zh: string;
}

export interface GeminiTranslateResult {
	title: TranslatedText;
	content: TranslatedText;
}

function sleep(ms: number) {
	return new Promise((r) => setTimeout(r, ms));
}

async function callGemini(input: { title: string; content: string }, attempt = 1): Promise<GeminiTranslateResult> {
	const apiKey = process.env.GEMINI_API_KEY;
	if (!apiKey) {
		throw new Error('GEMINI_API_KEY environment variable is not set');
	}

	const userPayload = JSON.stringify({
		title: input.title,
		content: input.content,
	});

	const body = JSON.stringify({
		system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
		contents: [
			{
				role: 'user',
				parts: [{ text: userPayload }],
			},
		],
		generationConfig: {
			temperature: 0.2,
			responseMimeType: 'application/json',
		},
	});

	const res = await fetch(GEMINI_URL(apiKey), {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body,
	});

	if (res.status === 429) {
		if (attempt > MAX_RETRIES) throw new Error('Gemini rate limit: max retries exceeded');
		await sleep(RETRY_DELAY_MS * attempt);
		return callGemini(input, attempt + 1);
	}

	if (!res.ok) {
		const errBody = await res.text();
		throw new Error(`Gemini API error ${res.status}: ${errBody.slice(0, 500)}`);
	}

	const data = await res.json();
	const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
	if (!text) throw new Error('Empty response from Gemini');

	let parsed: any;
	try {
		parsed = JSON.parse(text);
	} catch {
		throw new Error('Gemini returned invalid JSON');
	}

	const langs = ['en', 'es', 'ru', 'zh'] as const;
	for (const k of ['title', 'content']) {
		if (!parsed[k] || typeof parsed[k] !== 'object') {
			throw new Error(`Gemini response missing "${k}" object`);
		}
		for (const lang of langs) {
			if (typeof parsed[k][lang] !== 'string') {
				throw new Error(`Gemini response missing "${k}.${lang}"`);
			}
		}
	}

	return parsed as GeminiTranslateResult;
}

export async function translateAnnouncement(input: { title: string; content: string }): Promise<GeminiTranslateResult> {
	if (!input.title?.trim() || !input.content?.trim()) {
		throw new Error('Title and content are required for translation');
	}
	return callGemini(input);
}
