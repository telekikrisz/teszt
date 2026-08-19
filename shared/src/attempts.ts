import { z } from "zod";

export const startAttemptSchema = z.object({
  testId: z.string().uuid("Érvénytelen teszt azonosító."),
});

export const saveAttemptAnswerSchema = z.object({
  testQuestionId: z.string().uuid("Érvénytelen kérdés azonosító."),
  testQuestionAnswerId: z.string().uuid("Érvénytelen válasz azonosító."),
});

export const demoEvaluateSchema = z.object({
  answers: z.array(
    z.object({
      testQuestionId: z.string().uuid(),
      testQuestionAnswerId: z.string().uuid().nullable(),
    }),
  ),
});

export const resultsFilterSchema = z.object({
  testId: z.string().uuid().optional(),
  studentId: z.string().uuid().optional(),
});

export type StartAttemptInput = z.infer<typeof startAttemptSchema>;
export type SaveAttemptAnswerInput = z.infer<typeof saveAttemptAnswerSchema>;
export type DemoEvaluateInput = z.infer<typeof demoEvaluateSchema>;
export type ResultsFilter = z.infer<typeof resultsFilterSchema>;
