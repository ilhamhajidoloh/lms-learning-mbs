"use client";

import { useParams } from "next/navigation";
import { QuizReviewPage } from "../../_components/QuizReviewPage";

export default function TeacherQuizReviewRoute() {
  const params = useParams<{ submissionId: string }>();
  return <QuizReviewPage submissionId={params.submissionId} />;
}
