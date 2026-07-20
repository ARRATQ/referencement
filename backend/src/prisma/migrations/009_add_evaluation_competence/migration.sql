CREATE TABLE IF NOT EXISTS "EvaluationCompetence" (
    "id" TEXT NOT NULL,

    "jiraKeyCompetence" TEXT NOT NULL,
    "jiraKeyIntervenant" TEXT,
    "jiraKeyPrestataire" TEXT,

    "programCode" TEXT,
    "actionAReferencer" TEXT,
    "categoryKey" TEXT,
    "categorySuggested" JSONB,
    "solutionReferencee" TEXT,
    "modules" JSONB NOT NULL DEFAULT '[]',
    "secteur" TEXT,
    "modeAcquisition" TEXT,
    "origine" TEXT,
    "natureParticipant" TEXT,
    "typeIntervenant" TEXT,

    "sources" JSONB NOT NULL DEFAULT '[]',
    "webInsights" TEXT,
    "webConsulted" BOOLEAN NOT NULL DEFAULT false,

    "theoScores" JSONB NOT NULL DEFAULT '{}',
    "theoJustifs" JSONB NOT NULL DEFAULT '{}',
    "theoEnabled" JSONB NOT NULL DEFAULT '{}',
    "theoScorePct" INTEGER,
    "theoVerdict" "Verdict",
    "theoById" TEXT,
    "theoAt" TIMESTAMP(3),

    "demoScores" JSONB NOT NULL DEFAULT '{}',
    "demoJustifs" JSONB NOT NULL DEFAULT '{}',
    "demoScorePct" INTEGER,
    "demoVerdict" "Verdict",
    "demoById" TEXT,
    "demoAt" TIMESTAMP(3),

    "briefingText" TEXT,
    "briefingById" TEXT,
    "briefingAt" TIMESTAMP(3),

    "linkedEvaluationIntervenantId" TEXT,

    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "pushedAt" TIMESTAMP(3),
    "evaluatorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "EvaluationCompetence_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "EvaluationCompetence_jiraKeyCompetence_idx" ON "EvaluationCompetence"("jiraKeyCompetence");

ALTER TABLE "EvaluationCompetence"
  ADD CONSTRAINT "EvaluationCompetence_evaluatorId_fkey"
  FOREIGN KEY ("evaluatorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
