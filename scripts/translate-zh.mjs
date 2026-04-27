/**
 * Translates client/i18n/locales/en/translation.json → zh/translation.json
 * using Google Gemini API.
 *
 * Usage:
 *   $env:GEMINI_API_KEY="your_key"; node scripts/translate-zh.mjs
 *
 * Batches multiple namespaces per request to stay within free tier limits.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const API_KEY = process.env.GEMINI_API_KEY;
if (!API_KEY) {
  console.error('GEMINI_API_KEY environment variable is required.');
  process.exit(1);
}

const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${API_KEY}`;
const DELAY_MS = 10000;
const MAX_RETRIES = 6;
// Max number of leaf strings per batch request
const BATCH_LEAF_LIMIT = 150;

const EN_PATH = path.join(__dirname, '../client/i18n/locales/en/translation.json');
const ZH_PATH = path.join(__dirname, '../client/i18n/locales/zh/translation.json');

const SYSTEM_PROMPT = `You are a professional translator specializing in speedcubing / Rubik's cube apps.
Translate the given JSON from English to Simplified Chinese (zh-CN).

Rules:
- Keep all JSON keys exactly as-is (do not translate keys).
- Translate only string values.
- Preserve {{placeholders}} like {{count}}, {{name}}, {{time}} exactly.
- Preserve HTML tags like <strong>, <br/> exactly.
- Use proper speedcubing terminology in Chinese:
  - Rubik's cube / speedcubing → 魔方 / 速拧
  - scramble → 打乱
  - solve → 还原
  - algorithm → 公式
  - session → 阶段
  - average → 平均
  - single → 单次
  - DNF → DNF (keep as-is)
  - DNS → DNS (keep as-is)
  - WCA → WCA (keep as-is)
  - Pro → Pro (keep as-is)
  - Timer → 计时器
  - leaderboard → 排行榜
  - trainer → 训练器
- Return ONLY valid JSON. No markdown, no explanation, no code fences.`;

function countLeaves(obj) {
  if (typeof obj === 'string') return 1;
  if (Array.isArray(obj)) return obj.length;
  if (typeof obj === 'object' && obj !== null) {
    return Object.values(obj).reduce((sum, v) => sum + countLeaves(v), 0);
  }
  return 1;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function translateBatch(batch, attempt = 1) {
  const body = JSON.stringify({
    system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents: [
      {
        role: 'user',
        parts: [{ text: JSON.stringify(batch, null, 2) }],
      },
    ],
    generationConfig: {
      temperature: 0.1,
      responseMimeType: 'application/json',
    },
  });

  const res = await fetch(GEMINI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  });

  if (res.status === 429) {
    if (attempt > MAX_RETRIES) throw new Error('Rate limit: max retries exceeded');
    const wait = DELAY_MS * attempt;
    process.stdout.write(`\n  rate limited, waiting ${wait / 1000}s (attempt ${attempt})... `);
    await sleep(wait);
    return translateBatch(batch, attempt + 1);
  }

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini API error ${res.status}: ${err}`);
  }

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Empty response from Gemini');

  return JSON.parse(text);
}

async function main() {
  const en = JSON.parse(fs.readFileSync(EN_PATH, 'utf-8'));
  const namespaces = Object.keys(en);

  fs.mkdirSync(path.dirname(ZH_PATH), { recursive: true });

  let zh = {};
  if (fs.existsSync(ZH_PATH)) {
    zh = JSON.parse(fs.readFileSync(ZH_PATH, 'utf-8'));
    console.log(`Resuming — ${Object.keys(zh).length} namespaces already done.`);
  }

  const remaining = namespaces.filter((ns) => !(ns in zh));
  console.log(`Translating ${remaining.length} of ${namespaces.length} namespaces in batches...\n`);

  // Group namespaces into batches by leaf count
  const batches = [];
  let currentBatch = {};
  let currentLeaves = 0;

  for (const ns of remaining) {
    const leaves = countLeaves(en[ns]);
    if (currentLeaves + leaves > BATCH_LEAF_LIMIT && Object.keys(currentBatch).length > 0) {
      batches.push(currentBatch);
      currentBatch = {};
      currentLeaves = 0;
    }
    currentBatch[ns] = en[ns];
    currentLeaves += leaves;
  }
  if (Object.keys(currentBatch).length > 0) batches.push(currentBatch);

  console.log(`${batches.length} batch request(s) needed.\n`);

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    const keys = Object.keys(batch);
    process.stdout.write(`[${i + 1}/${batches.length}] ${keys.join(', ')} ... `);

    try {
      const translated = await translateBatch(batch);

      for (const ns of keys) {
        if (translated[ns]) {
          zh[ns] = translated[ns];
        } else {
          console.warn(`\n  WARNING: missing namespace "${ns}" in response`);
        }
      }

      fs.writeFileSync(ZH_PATH, JSON.stringify(zh, null, 2), 'utf-8');
      console.log('done');
    } catch (err) {
      console.error(`\nFAILED: ${err.message}`);
      console.error('Progress saved. Re-run to resume.');
      fs.writeFileSync(ZH_PATH, JSON.stringify(zh, null, 2), 'utf-8');
      process.exit(1);
    }

    if (i < batches.length - 1) {
      await sleep(DELAY_MS);
    }
  }

  console.log(`\nDone! Written to ${ZH_PATH}`);
  console.log(`Total namespaces: ${Object.keys(zh).length}`);
}

main();
