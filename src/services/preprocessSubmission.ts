/**
 * preprocessSubmission.ts
 *
 * Cleans up raw Trainual copy-paste before sending to the AI grader.
 *
 * What Trainual paste looks like:
 *   - Header junk:  "DB\nHomepage\nBack to by user report\nAttempt 1\n<name>'s score report..."
 *   - Question blocks: number on its own line, then question text, then optional "Example:" block, then student answer
 *   - Footer junk:  "Trainual Logo\nPrivacy\n|\nTerms"
 *
 * What we return:
 *   A clean string like:
 *     Q1: hoppy, malty, crisp, hazy, session
 *     Q2: Austin, south beach mimosa, dry wrought cider
 *     ...
 *
 * The AI then has zero ambiguity about which answer belongs to which question number.
 */

// Lines that are pure UI chrome — strip them completely
const NOISE_PATTERNS: RegExp[] = [
  /^search or ask a question$/i,
  /^db$/i,
  /^homepage$/i,
  /^back to by user report$/i,
  /^attempt \d+$/i,
  /^trainual logo$/i,
  /^privacy$/i,
  /^terms$/i,
  /^\|$/,
  /^passed\s+\d+%/i,
  /^\d+\/\d+\s*,?\s*\d+ (day|hour|minute|second)/i,  // "9/9, 3 days ago"
  /score report for/i,
  /attempt \d+,\s*passed/i,
];

// Lines that introduce inline examples inside the question text — strip from this line onward until next Q
const EXAMPLE_START = /^example\s*:/i;

function isNoiseLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;
  return NOISE_PATTERNS.some(p => p.test(trimmed));
}

interface ParsedQuestion {
  number: number;
  answer: string;
}

/**
 * Main export. Takes raw paste, returns a clean structured string.
 * Falls back to the original text if parsing produces < 2 questions
 * (so a completely different format still works).
 */
export function preprocessSubmission(raw: string, questionCount: number): string {
  const lines = raw.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  // ── Strip header/footer noise ──────────────────────────────────────────────
  const cleaned: string[] = [];
  for (const line of lines) {
    if (!isNoiseLine(line)) cleaned.push(line);
  }

  // ── Find question boundaries ───────────────────────────────────────────────
  // A question starts when a line is JUST a number (or "Q<n>") and the number
  // is plausible given the exam length.
  const questionStarts: { idx: number; num: number }[] = [];

  for (let i = 0; i < cleaned.length; i++) {
    const line = cleaned[i];
    const bare = /^q?(\d{1,2})\.?\s*$/i.exec(line);
    if (bare) {
      const n = parseInt(bare[1], 10);
      if (n >= 1 && n <= Math.max(questionCount + 5, 30)) {
        questionStarts.push({ idx: i, num: n });
      }
    }
  }

  // Need at least 2 detected questions to trust the parse
  if (questionStarts.length < 2) {
    return fallbackClean(raw);
  }

  // ── Extract the answer block for each question ─────────────────────────────
  const questions: ParsedQuestion[] = [];

  for (let qi = 0; qi < questionStarts.length; qi++) {
    const start = questionStarts[qi].idx;
    const end = qi + 1 < questionStarts.length
      ? questionStarts[qi + 1].idx
      : cleaned.length;

    // Lines between this question number and the next: [question number, question text..., answer]
    // The question text lines come first; the student answer is at the END of the block.
    // We skip:
    //   - The question number line itself (start)
    //   - Lines that look like question text (long sentences ending with "?")
    //   - "Example:" blocks

    const blockLines = cleaned.slice(start + 1, end);

    // Find where the "Example:" block starts (if any) and cut it out
    let exampleStart = blockLines.length;
    for (let j = 0; j < blockLines.length; j++) {
      if (EXAMPLE_START.test(blockLines[j])) {
        exampleStart = j;
        break;
      }
    }
    const noExamples = blockLines.slice(0, exampleStart);

    // Separate question text from student answer.
    // Heuristic: question text lines are typically long (>30 chars) and end with "?" or ":"
    // Student answers are shorter and don't end with "?"
    // Strategy: walk from the END and collect answer lines until we hit a likely question-text line.
    const answerLines: string[] = [];
    let hitQuestionText = false;

    for (let j = noExamples.length - 1; j >= 0; j--) {
      const l = noExamples[j];

      const looksLikeQuestionText =
        (l.length > 40 && l.endsWith('?')) ||
        (l.length > 50 && /^(what|how|list|describe|explain|name|where|when|why|which|give|tell)/i.test(l)) ||
        /\(brand & varietal/i.test(l) ||
        /there'?s \d+\)?/i.test(l) ||
        /\(in detail\)/i.test(l);

      if (looksLikeQuestionText) {
        hitQuestionText = true;
        break;
      }

      answerLines.unshift(l);
    }

    // If we never hit obvious question text, the whole block might be the answer
    // (single-line answer exams). Use noExamples as-is but skip very long first lines.
    if (!hitQuestionText && answerLines.length === 0) {
      for (let j = 0; j < noExamples.length; j++) {
        const l = noExamples[j];
        if (l.length <= 120) answerLines.push(l);
      }
    }

    const answer = answerLines.join(' ').trim();

    if (answer.length > 0) {
      questions.push({ number: questionStarts[qi].num, answer });
    }
  }

  if (questions.length < 2) {
    return fallbackClean(raw);
  }

  // ── Format as clean structured string for the AI ──────────────────────────
  const formatted = questions
    .sort((a, b) => a.number - b.number)
    .map(q => `Q${q.number}: ${q.answer}`)
    .join('\n');

  return formatted;
}

/**
 * Minimal fallback: just strip obvious noise lines and return.
 * Used when the structured parser can't find question boundaries.
 */
function fallbackClean(raw: string): string {
  return raw
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0 && !isNoiseLine(l))
    .join('\n');
}
