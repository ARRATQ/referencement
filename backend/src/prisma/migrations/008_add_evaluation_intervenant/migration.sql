CREATE TABLE IF NOT EXISTS "EvaluationIntervenant" (
    "id" TEXT NOT NULL,
    "jiraKey" TEXT NOT NULL,
    "evaluatorId" TEXT NOT NULL,
    "cvSource" TEXT NOT NULL DEFAULT 'jira',
    "cvFilename" TEXT,
    "proposed" JSONB NOT NULL DEFAULT '{}',
    "validated" JSONB NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "pushedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "EvaluationIntervenant_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "EvaluationIntervenant_jiraKey_idx" ON "EvaluationIntervenant"("jiraKey");

ALTER TABLE "EvaluationIntervenant"
  ADD CONSTRAINT "EvaluationIntervenant_evaluatorId_fkey"
  FOREIGN KEY ("evaluatorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
