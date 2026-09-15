export type GeneratedQuestion = {
  question_text: string;
  options: string[];
  correct_answer: string;
  explanation: string | null;
};

const questionShape = `[
  {
    "question_text": "string",
    "options": ["string", "string", "string", "string"],
    "correct_answer": "one of the four options exactly",
    "explanation": "string"
  }
]`;

function parseJson(content: string): unknown {
  const cleaned = content
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("[");
    const end = cleaned.lastIndexOf("]");
    if (start < 0 || end <= start) {
      throw new Error("Groq returned invalid JSON");
    }
    return JSON.parse(cleaned.slice(start, end + 1));
  }
}

function validateQuestions(value: unknown, count: number): GeneratedQuestion[] {
  const questions = Array.isArray(value)
    ? value
    : value && typeof value === "object" && Array.isArray((value as { questions?: unknown }).questions)
      ? (value as { questions: unknown[] }).questions
      : null;

  if (!questions || questions.length !== count) {
    throw new Error("Groq returned an unexpected number of questions");
  }

  return questions.map((item, index) => {
    if (!item || typeof item !== "object") {
      throw new Error(`Question ${index + 1} has an invalid shape`);
    }

    const question = item as {
      question_text?: unknown;
      options?: unknown;
      correct_answer?: unknown;
      explanation?: unknown;
    };
    const questionText = typeof question.question_text === "string" ? question.question_text.trim() : "";
    const options = Array.isArray(question.options)
      ? question.options.map((option) => (typeof option === "string" ? option.trim() : ""))
      : [];
    const correctAnswer = typeof question.correct_answer === "string" ? question.correct_answer.trim() : "";
    const explanation =
      question.explanation == null
        ? null
        : typeof question.explanation === "string"
          ? question.explanation.trim()
          : null;

    if (
      !questionText ||
      questionText.length > 2000 ||
      options.length !== 4 ||
      options.some((option) => !option || option.length > 500) ||
      new Set(options).size !== 4 ||
      !correctAnswer ||
      !options.includes(correctAnswer) ||
      (explanation !== null && explanation.length > 3000)
    ) {
      throw new Error(`Question ${index + 1} failed validation`);
    }

    return {
      question_text: questionText,
      options,
      correct_answer: correctAnswer,
      explanation,
    };
  });
}

export async function generateExamQuestions(
  subject: string,
  count: number,
  level: string,
): Promise<GeneratedQuestion[]> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error("GROQ_API_KEY is not configured");
  }

  const prompt = `Generate exactly ${count} multiple-choice questions about "${subject}" for the "${level}" level.
Return ONLY valid JSON matching this shape, with no markdown:
${questionShape}
Every question must have exactly four distinct options. correct_answer must match one option exactly.
Use Arabic for the questions and explanations when the subject is Arabic; otherwise use the subject's natural language.`;

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
      temperature: 0.7,
      messages: [{ role: "user", content: prompt }],
    }),
    signal: AbortSignal.timeout(45_000),
  });

  if (!response.ok) {
    throw new Error(`Groq request failed with status ${response.status}`);
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string | null } }>;
  };
  const content = payload.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("Groq returned an empty response");
  }

  return validateQuestions(parseJson(content), count);
}