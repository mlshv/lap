import 'dotenv/config';
import { openai } from '@ai-sdk/openai';
import { generateObject } from 'ai';
import { readFile, writeFile, appendFile } from 'fs/promises';
import { existsSync } from 'fs';
import { z } from 'zod';

// TypeScript types
interface Phrase {
  french: string;
  english: string;
}

interface SentenceTranslation {
  sentence: string;
  phrases: Phrase[];
}

interface BatchItem {
  sentence: string;
  originalIndex: number;
}

// Zod schema for OpenAI structured output
const phraseSchema = z.object({
  french: z.string(),
  english: z.string(),
});

const sentenceTranslationSchema = z.object({
  phrases: z.array(phraseSchema),
});

// Configuration
const BATCH_SIZE = 10; // Number of sentences per batch
const PARALLEL_BATCHES = 5; // Number of batches to process in parallel
const MAX_RETRIES = 3;
const INPUT_FILE = 'data/french/2000verbs/sentences.json';
const OUTPUT_FILE = 'data/french/2000verbs/phrase-translations.json';
const ERROR_LOG_FILE = 'data/french/2000verbs/phrase-translations-errors.log';

/**
 * Fixes the order of existing translations to match input sentence order
 */
async function fixExistingOrder(): Promise<void> {
  if (!existsSync(OUTPUT_FILE)) {
    return;
  }

  try {
    console.log('🔧 Checking existing translations order...');

    // Read input sentences
    const inputData = await readFile(INPUT_FILE, 'utf-8');
    const inputSentences: string[] = JSON.parse(inputData);

    // Read existing translations
    const outputData = await readFile(OUTPUT_FILE, 'utf-8');
    const existingTranslations: SentenceTranslation[] = JSON.parse(outputData);

    // Create a map for quick lookup
    const translationMap = new Map<string, SentenceTranslation>();
    for (const translation of existingTranslations) {
      translationMap.set(translation.sentence, translation);
    }

    // Reorder to match input order
    const reordered: SentenceTranslation[] = inputSentences.map((sentence) => {
      return translationMap.get(sentence) || { sentence, phrases: [] };
    });

    // Check if order was already correct
    const orderChanged =
      JSON.stringify(existingTranslations) !== JSON.stringify(reordered);

    if (orderChanged) {
      await writeFile(OUTPUT_FILE, JSON.stringify(reordered, null, 2));
      console.log('✓ Fixed order in existing translations file\n');
    } else {
      console.log('✓ Existing translations already in correct order\n');
    }
  } catch (error) {
    console.log(`⚠️  Could not fix existing order: ${error}\n`);
  }
}

/**
 * Translates a single sentence into phrases with English translations
 */
async function translateSentence(
  sentence: string,
  retries = 0
): Promise<Phrase[]> {
  try {
    const { object } = await generateObject({
      model: openai('gpt-5-nano'),
      providerOptions: {
        openai: {
          reasoningEffort: 'minimal',
        },
      },
      schema: sentenceTranslationSchema,
      prompt: `You are a French language expert. Break down the following French sentence into meaningful phrases and translate each phrase to English.

Rules:
- Break the sentence into 3-6 logical phrases that capture semantic meaning
- Each phrase should be a meaningful unit (subject, verb, object, prepositional phrase, etc.)
- Provide accurate English translations for each phrase

French sentence: "${sentence}"

Return a JSON object with an array of phrases, where each phrase has "french" and "english" fields.`,
    });

    return object.phrases;
  } catch (error) {
    if (retries < MAX_RETRIES) {
      const delay = Math.pow(2, retries) * 1000; // Exponential backoff
      console.log(
        `  Retry ${retries + 1}/${MAX_RETRIES} after ${delay}ms delay...`
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
      return translateSentence(sentence, retries + 1);
    }

    // Log error and throw
    const errorMsg = `Failed to translate sentence after ${MAX_RETRIES} retries: "${sentence}"\nError: ${error}\n\n`;
    await appendFile(ERROR_LOG_FILE, errorMsg).catch(() => {});
    console.error(`  ❌ Failed: ${sentence}`);
    throw error;
  }
}

/**
 * Processes a batch of sentences in parallel
 */
async function processBatch(
  batchItems: BatchItem[],
  totalSentences: number
): Promise<Array<SentenceTranslation & { originalIndex: number }>> {
  // Process all sentences in the batch in parallel
  const promises = batchItems.map(async ({ sentence, originalIndex }) => {
    console.log(
      `[${originalIndex + 1}/${totalSentences}] Processing: ${sentence.substring(0, 50)}...`
    );

    try {
      const phrases = await translateSentence(sentence);
      console.log(
        `  ✓ [${originalIndex + 1}] Generated ${phrases.length} phrases`
      );
      return {
        sentence,
        phrases,
        originalIndex,
      };
    } catch (error) {
      // Continue processing even if one sentence fails
      console.error(`  ❌ [${originalIndex + 1}] Failed to process`);
      return {
        sentence,
        phrases: [],
        originalIndex,
      };
    }
  });

  const results = await Promise.all(promises);

  // Sort by original index to maintain order
  results.sort((a, b) => a.originalIndex - b.originalIndex);

  return results;
}

/**
 * Load existing translations
 */
async function loadExistingTranslations(): Promise<
  Map<string, SentenceTranslation>
> {
  const translationMap = new Map<string, SentenceTranslation>();

  if (existsSync(OUTPUT_FILE)) {
    try {
      const data = await readFile(OUTPUT_FILE, 'utf-8');
      const translations: SentenceTranslation[] = JSON.parse(data);

      for (const translation of translations) {
        // Only load translations that have phrases (skip empty ones)
        if (translation.phrases.length > 0) {
          translationMap.set(translation.sentence, translation);
        }
      }

      console.log(`✓ Loaded ${translationMap.size} existing translations\n`);
    } catch (error) {
      console.log(`⚠️  Could not load existing translations: ${error}\n`);
    }
  }

  return translationMap;
}

/**
 * Main function
 */
async function main() {
  console.log('🚀 Starting phrase translation generation...\n');

  // First, fix the order of any existing translations
  await fixExistingOrder();

  console.log(`⚙️  Configuration:`);
  console.log(`   - Batch size: ${BATCH_SIZE} sentences`);
  console.log(`   - Parallel batches: ${PARALLEL_BATCHES}`);
  console.log(`   - Max retries: ${MAX_RETRIES}\n`);

  // Read input sentences
  console.log(`📖 Reading sentences from ${INPUT_FILE}...`);
  const sentencesData = await readFile(INPUT_FILE, 'utf-8');
  const allSentences: string[] = JSON.parse(sentencesData);
  console.log(`✓ Loaded ${allSentences.length} sentences\n`);

  // Load existing translations
  console.log(`📂 Checking for existing translations...`);
  const existingTranslations = await loadExistingTranslations();

  // Build batch items with original indices for sentences that need processing
  const batchItems: BatchItem[] = [];
  for (let i = 0; i < allSentences.length; i++) {
    const sentence = allSentences[i];
    if (!existingTranslations.has(sentence)) {
      batchItems.push({
        sentence,
        originalIndex: i,
      });
    }
  }

  if (batchItems.length === 0) {
    console.log('✅ All sentences are already translated!');
    return;
  }

  console.log(
    `📊 Processing ${batchItems.length} new sentences (${existingTranslations.size} already done)\n`
  );

  // Build initial results from existing translations (maintain order)
  const allResults: SentenceTranslation[] = allSentences.map((sentence) => {
    return existingTranslations.get(sentence) || { sentence, phrases: [] };
  });

  // Split batch items into batches
  const batches: BatchItem[][] = [];
  for (let i = 0; i < batchItems.length; i += BATCH_SIZE) {
    batches.push(batchItems.slice(i, i + BATCH_SIZE));
  }

  console.log(`📦 Total batches to process: ${batches.length}\n`);

  // Process batches in parallel groups
  for (let i = 0; i < batches.length; i += PARALLEL_BATCHES) {
    const parallelBatches = batches.slice(i, i + PARALLEL_BATCHES);
    const groupNumber = Math.floor(i / PARALLEL_BATCHES) + 1;
    const totalGroups = Math.ceil(batches.length / PARALLEL_BATCHES);

    console.log(
      `\n🚀 Processing batch group ${groupNumber}/${totalGroups} (${parallelBatches.length} batches in parallel)...`
    );

    // Process multiple batches in parallel
    const batchPromises = parallelBatches.map((batch) =>
      processBatch(batch, allSentences.length)
    );

    const batchResults = await Promise.all(batchPromises);

    // Update allResults with new translations at their correct indices
    for (const results of batchResults) {
      for (const result of results) {
        allResults[result.originalIndex] = {
          sentence: result.sentence,
          phrases: result.phrases,
        };
      }
    }

    // Save incrementally after each parallel group
    await writeFile(OUTPUT_FILE, JSON.stringify(allResults, null, 2));

    const processedCount = allResults.filter((r) => r.phrases.length > 0)
      .length;
    console.log(
      `\n💾 Saved progress (${processedCount}/${allSentences.length} sentences complete)`
    );
  }

  console.log('\n✅ Translation complete!');
  console.log(`📄 Output saved to: ${OUTPUT_FILE}`);

  const completedCount = allResults.filter((r) => r.phrases.length > 0).length;
  console.log(
    `📊 Total sentences completed: ${completedCount}/${allSentences.length}`
  );

  const failedCount = allResults.filter((r) => r.phrases.length === 0).length;
  if (failedCount > 0) {
    console.log(`⚠️  Failed/incomplete sentences: ${failedCount}`);
    console.log(`📋 Check error log: ${ERROR_LOG_FILE}`);
  }
}

// Run the script
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
