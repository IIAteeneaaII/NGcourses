import type { QuestionType, QuizData, QuizOption, QuizQuestion } from '@/types/course';

function parseJsonDeep(value: unknown, depth = 0): unknown {
  if (depth > 6) return value;
  if (typeof value !== 'string') return value;

  const trimmed = value.trim();
  if (!trimmed) return null;

  try {
    return parseJsonDeep(JSON.parse(trimmed), depth + 1);
  } catch {
    return value;
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  const parsed = parseJsonDeep(value);
  return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
    ? parsed as Record<string, unknown>
    : null;
}

function firstDefined(record: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    if (record[key] !== undefined && record[key] !== null) return record[key];
  }
  return undefined;
}

function normalizeQuestionType(value: unknown): QuestionType {
  const raw = String(value ?? '').toLowerCase();
  if (raw === 'true_false' || raw === 'verdadero_falso' || raw === 'boolean') return 'true_false';
  return 'multiple_choice';
}

function toStringValue(value: unknown, fallback = ''): string {
  if (value === undefined || value === null) return fallback;
  return String(value);
}

function toBooleanValue(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return ['true', '1', 'si', 'sí', 'correcta', 'correct', 'yes'].includes(normalized);
  }
  return false;
}

function normalizeOptions(rawOptions: unknown, question: Record<string, unknown>, questionIndex: number): QuizOption[] {
  const optionsArray = Array.isArray(parseJsonDeep(rawOptions)) ? parseJsonDeep(rawOptions) as unknown[] : [];
  const correctId = firstDefined(question, [
    'opcion_correcta_id',
    'opcionCorrectaId',
    'correctOptionId',
    'correct_answer_id',
    'respuesta_correcta_id',
  ]);

  return optionsArray.map((rawOption, optionIndex) => {
    const option = asRecord(rawOption) ?? {};
    const id = toStringValue(
      firstDefined(option, ['id', 'opcion_id', 'option_id', 'value']),
      `q${questionIndex + 1}-op${optionIndex + 1}`,
    );
    const texto = toStringValue(
      firstDefined(option, ['texto', 'text', 'label', 'respuesta', 'answer', 'titulo', 'title']),
      `Opción ${optionIndex + 1}`,
    );
    const explicitCorrect = firstDefined(option, [
      'esCorrecta',
      'es_correcta',
      'correcta',
      'isCorrect',
      'is_correct',
      'correct',
    ]);

    return {
      id,
      texto,
      esCorrecta: explicitCorrect !== undefined
        ? toBooleanValue(explicitCorrect)
        : correctId !== undefined && String(correctId) === id,
    };
  });
}

function normalizeQuestion(rawQuestion: unknown, questionIndex: number): QuizQuestion | null {
  const question = asRecord(rawQuestion);
  if (!question) return null;

  const id = toStringValue(
    firstDefined(question, ['id', 'pregunta_id', 'question_id', 'uuid']),
    `pregunta-${questionIndex + 1}`,
  );
  const enunciado = toStringValue(
    firstDefined(question, ['enunciado', 'texto', 'question', 'pregunta', 'titulo', 'title']),
  );
  const rawOptions = firstDefined(question, ['opciones', 'options', 'respuestas', 'answers', 'alternativas']);

  return {
    id,
    tipo: normalizeQuestionType(firstDefined(question, ['tipo', 'type', 'question_type'])),
    enunciado,
    opciones: normalizeOptions(rawOptions, question, questionIndex),
    orden: Number(firstDefined(question, ['orden', 'order']) ?? questionIndex + 1),
  };
}

function extractQuestionsCandidate(value: unknown): unknown {
  const parsed = parseJsonDeep(value);

  if (Array.isArray(parsed)) return parsed;

  const record = asRecord(parsed);
  if (!record) return undefined;

  const direct = firstDefined(record, ['preguntas', 'questions', 'items']);
  if (direct !== undefined) return direct;

  const nested = firstDefined(record, [
    'quizData',
    'quiz_data',
    'quiz',
    'contenido',
    'contenido_json',
    'content',
    'data',
    'payload',
    'configuracion',
    'configuracion_quiz',
  ]);

  if (nested !== undefined && nested !== parsed) return extractQuestionsCandidate(nested);

  return undefined;
}

export function normalizeQuizData(raw: unknown): QuizData {
  const questionsCandidate = extractQuestionsCandidate(raw);
  if (!Array.isArray(questionsCandidate)) return { preguntas: [] };

  const preguntas = questionsCandidate
    .map((question, index) => normalizeQuestion(question, index))
    .filter((question): question is QuizQuestion => Boolean(question));

  return { preguntas };
}

export function hasQuizQuestions(raw: unknown): boolean {
  return normalizeQuizData(raw).preguntas.length > 0;
}
