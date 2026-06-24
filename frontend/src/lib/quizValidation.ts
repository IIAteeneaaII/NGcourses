import type { QuizData, QuizQuestion } from '@/types/course';

/**
 * Valida una sola pregunta de quiz. Devuelve la lista de problemas encontrados;
 * un arreglo vacío significa que la pregunta está completa.
 *
 * El backend califica `aprobado = TODAS las preguntas correctas`, así que una
 * pregunta sin respuesta correcta marcada vuelve el quiz imposible de aprobar.
 */
export function validateQuestion(q: QuizQuestion): string[] {
  const issues: string[] = [];

  if (!q.enunciado.trim()) issues.push('falta el enunciado');

  if (q.tipo === 'multiple_choice') {
    const conTexto = q.opciones.filter((o) => o.texto.trim());
    if (conTexto.length < 2) issues.push('necesita al menos 2 opciones con texto');
  }

  const correcta = q.opciones.find((o) => o.esCorrecta);
  if (!correcta) {
    issues.push('marca la respuesta correcta');
  } else if (q.tipo === 'multiple_choice' && !correcta.texto.trim()) {
    issues.push('la respuesta correcta no tiene texto');
  }

  return issues;
}

/**
 * Valida un quiz completo. Devuelve la lista de problemas (con el número de
 * pregunta); vacío = el quiz es válido y se puede publicar.
 */
export function validateQuiz(quizData: QuizData | null | undefined): string[] {
  const preguntas = quizData?.preguntas ?? [];
  if (preguntas.length === 0) return ['el quiz no tiene preguntas'];

  const issues: string[] = [];
  preguntas.forEach((q, i) => {
    const qIssues = validateQuestion(q);
    if (qIssues.length) issues.push(`Pregunta ${i + 1}: ${qIssues.join(', ')}`);
  });
  return issues;
}
