import type { QuizQuestion } from "@/app/context/UserContext";

/**
 * Get the correct answer indices for a multiple choice question
 * Supports both old correctIndex (single) and new correctIndices (multiple)
 */
export function getQuestionCorrectIndices(question: QuizQuestion): number[] {
  if (question.correctIndices && Array.isArray(question.correctIndices) && question.correctIndices.length > 0) {
    return question.correctIndices;
  }
  if (question.correctIndex !== undefined && question.correctIndex !== null) {
    return [question.correctIndex];
  }
  return [0];
}

/**
 * Get the indices that the student selected
 * Handles both single selection (number) and multiple selection (number[])
 */
export function getStudentSelectedIndices(answer: number | number[] | string | Record<number, number> | undefined): number[] {
  if (Array.isArray(answer)) {
    return answer;
  }
  if (typeof answer === "number") {
    return [answer];
  }
  return [];
}

/**
 * Calculate the score for a single quiz question with proportional scoring support
 */
export function calculateQuestionScore(
  question: QuizQuestion,
  answer: number | number[] | string | Record<number, number> | undefined
): {
  score: number;
  isCorrect: boolean | null;
  isPartial: boolean;
  studentAnswerText: string;
  correctAnswerText: string;
  detailText?: string;
} {
  const questionType = question.questionType || "multiple_choice";
  const points = question.points !== undefined && Number.isFinite(Number(question.points))
    ? Number(question.points)
    : 1;

  // MULTIPLE CHOICE - Proportional scoring for multiple correct answers
  if (questionType === "multiple_choice") {
    const correctIndices = getQuestionCorrectIndices(question);
    const selectedIndices = getStudentSelectedIndices(answer);
    const options = question.options || [];

    if (selectedIndices.length === 0) {
      return {
        score: 0,
        isCorrect: false,
        isPartial: false,
        studentAnswerText: "ไม่ได้เลือกคำตอบ",
        correctAnswerText: correctIndices.map(i => `${String.fromCharCode(65 + i)}. ${options[i]}`).join(", "),
      };
    }

    // Calculate correct and incorrect selections
    const correctSelections = selectedIndices.filter(idx => correctIndices.includes(idx));
    const incorrectSelections = selectedIndices.filter(idx => !correctIndices.includes(idx));
    const missedCorrect = correctIndices.filter(idx => !selectedIndices.includes(idx));

    // If multiple correct answers exist, use proportional scoring
    if (correctIndices.length > 1) {
      // Score = (correct selected / total correct) * points - penalty for incorrect
      const correctRatio = correctSelections.length / correctIndices.length;
      const incorrectPenalty = incorrectSelections.length / correctIndices.length;
      const rawScore = (correctRatio - incorrectPenalty) * points;
      const finalScore = Math.max(0, Math.min(points, rawScore));

      const isFullyCorrect = correctSelections.length === correctIndices.length && incorrectSelections.length === 0;
      const isPartial = !isFullyCorrect && correctSelections.length > 0;

      let detailText = "";
      if (isFullyCorrect) {
        detailText = "เลือกถูกครบทุกข้อ";
      } else {
        const parts: string[] = [];
        if (correctSelections.length > 0) {
          parts.push(`ถูก ${correctSelections.length}/${correctIndices.length}`);
        }
        if (incorrectSelections.length > 0) {
          parts.push(`เลือกผิด ${incorrectSelections.length}`);
        }
        if (missedCorrect.length > 0) {
          parts.push(`ขาด ${missedCorrect.length}`);
        }
        detailText = parts.join(", ");
      }

      return {
        score: finalScore,
        isCorrect: isFullyCorrect,
        isPartial,
        studentAnswerText: selectedIndices.map(i => `${String.fromCharCode(65 + i)}. ${options[i]}`).join(", "),
        correctAnswerText: correctIndices.map(i => `${String.fromCharCode(65 + i)}. ${options[i]}`).join(", "),
        detailText,
      };
    }

    // Single correct answer - traditional all-or-nothing
    const isCorrect = selectedIndices.length === 1 && selectedIndices[0] === correctIndices[0];
    return {
      score: isCorrect ? points : 0,
      isCorrect,
      isPartial: false,
      studentAnswerText: selectedIndices.map(i => `${String.fromCharCode(65 + i)}. ${options[i]}`).join(", "),
      correctAnswerText: `${String.fromCharCode(65 + correctIndices[0])}. ${options[correctIndices[0]]}`,
    };
  }

  // FILL BLANK - Exact match (case insensitive)
  if (questionType === "fill_blank") {
    if (!question.correctAnswer?.trim()) {
      return {
        score: 0,
        isCorrect: null,
        isPartial: false,
        studentAnswerText: typeof answer === "string" ? answer : "ไม่ได้กรอก",
        correctAnswerText: "รอผู้สอนตรวจให้คะแนน",
      };
    }

    const studentAnswer = typeof answer === "string" ? answer.trim() : "";
    const correctAnswer = question.correctAnswer.trim();
    const isCorrect = studentAnswer.toLowerCase() === correctAnswer.toLowerCase();

    return {
      score: isCorrect ? points : 0,
      isCorrect,
      isPartial: false,
      studentAnswerText: studentAnswer || "ไม่ได้กรอก",
      correctAnswerText: correctAnswer,
    };
  }

  // MATCHING - Proportional scoring based on correct pairs
  if (questionType === "matching") {
    const pairs = question.matchingPairs || [];
    if (pairs.length === 0) {
      return {
        score: 0,
        isCorrect: null,
        isPartial: false,
        studentAnswerText: "ไม่มีคู่ให้จับ",
        correctAnswerText: "ไม่มีคู่ให้จับ",
      };
    }

    if (typeof answer !== "object" || Array.isArray(answer) || answer === null) {
      return {
        score: 0,
        isCorrect: false,
        isPartial: false,
        studentAnswerText: "ไม่ได้จับคู่",
        correctAnswerText: pairs.map((p, i) => `${i + 1}. ${p.left} ↔ ${p.right}`).join(", "),
      };
    }

    // Count correct pairs
    let correctPairs = 0;
    for (let i = 0; i < pairs.length; i++) {
      if (answer[i] === i) {
        correctPairs++;
      }
    }

    // Proportional scoring: (correct pairs / total pairs) * points
    const ratio = correctPairs / pairs.length;
    const score = ratio * points;
    const isFullyCorrect = correctPairs === pairs.length;
    const isPartial = correctPairs > 0 && correctPairs < pairs.length;

    return {
      score,
      isCorrect: isFullyCorrect,
      isPartial,
      studentAnswerText: `จับคู่ถูก ${correctPairs} จาก ${pairs.length} คู่`,
      correctAnswerText: pairs.map((p, i) => `${i + 1}. ${p.left} ↔ ${p.right}`).join(", "),
      detailText: isFullyCorrect ? "จับคู่ถูกทั้งหมด" : `ถูก ${correctPairs}/${pairs.length} คู่`,
    };
  }

  // ESSAY - Manual grading required
  if (questionType === "essay") {
    return {
      score: 0,
      isCorrect: null,
      isPartial: false,
      studentAnswerText: typeof answer === "string" ? answer : "ไม่ได้ตอบ",
      correctAnswerText: question.correctAnswer || "รอผู้สอนตรวจให้คะแนน",
    };
  }

  // Fallback
  return {
    score: 0,
    isCorrect: null,
    isPartial: false,
    studentAnswerText: "ไม่ระบุประเภทคำถาม",
    correctAnswerText: "",
  };
}

/**
 * Calculate total score and per-question score array for an entire quiz submission
 */
export function calculateQuizTotalScore(
  questions: QuizQuestion[],
  answers: number | number[] | string | Record<number, any> | undefined
): { totalScore: number; questionScores: number[] } {
  const scores = questions.map((q, idx) => {
    const ans = Array.isArray(answers) ? answers[idx] : (answers as Record<number, any> | undefined)?.[idx];
    return calculateQuestionScore(q, ans).score;
  });
  const total = scores.reduce((sum, s) => sum + s, 0);
  return { totalScore: total, questionScores: scores };
}
