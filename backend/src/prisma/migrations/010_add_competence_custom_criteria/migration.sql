ALTER TABLE "EvaluationCompetence"
  ADD COLUMN IF NOT EXISTS "customCriteria" JSONB NOT NULL DEFAULT '[]';
