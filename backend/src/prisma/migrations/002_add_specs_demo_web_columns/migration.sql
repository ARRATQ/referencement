-- Add columns that were added to schema.prisma after the initial migration
ALTER TABLE "Evaluation" ADD COLUMN IF NOT EXISTS "specsAnalysis" TEXT;
ALTER TABLE "Evaluation" ADD COLUMN IF NOT EXISTS "demoScenario" TEXT;
ALTER TABLE "Evaluation" ADD COLUMN IF NOT EXISTS "webInsights" TEXT;
