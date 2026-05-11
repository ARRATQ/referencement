-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'GESTIONNAIRE', 'PARTICIPANT');
CREATE TYPE "RefType" AS ENUM ('SOLUTION', 'ACTION');
CREATE TYPE "Verdict" AS ENUM ('FAVORABLE', 'CONDITIONNEL', 'DEFAVORABLE');
CREATE TYPE "Decision" AS ENUM ('REFERENCE', 'CONDITIONNEL', 'REJETE');
CREATE TYPE "EvalStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'PARTICIPANT',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateTable
CREATE TABLE "Program" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "amiText" TEXT NOT NULL,
    "cvTemplate" TEXT NOT NULL,
    "categories" JSONB NOT NULL,
    "intCriteria" JSONB NOT NULL,
    "actionTypes" JSONB NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Program_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Program_code_key" ON "Program"("code");

-- CreateTable
CREATE TABLE "Evaluation" (
    "id" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "evaluatorId" TEXT NOT NULL,
    "referenceType" "RefType" NOT NULL,
    "actionDomain" TEXT,
    "jiraKeyPrestataire" TEXT,
    "jiraKeyIntervenant" TEXT,
    "jiraKeyCompetence" TEXT,
    "prestataire" TEXT NOT NULL,
    "solution" TEXT,
    "actionLabel" TEXT,
    "actionDescription" TEXT,
    "dateDemo" TIMESTAMP(3),
    "rapporteur" TEXT,
    "origine" TEXT,
    "nature" TEXT,
    "modeAcquisition" TEXT,
    "secteur" TEXT,
    "typeIntervenant" TEXT,
    "modules" JSONB NOT NULL DEFAULT '[]',
    "category" TEXT,
    "solScores" JSONB NOT NULL DEFAULT '{}',
    "solObservations" JSONB NOT NULL DEFAULT '{}',
    "solScorePct" INTEGER,
    "solVerdict" "Verdict",
    "intScores" JSONB NOT NULL DEFAULT '{}',
    "intObservations" JSONB NOT NULL DEFAULT '{}',
    "intScorePct" INTEGER,
    "intVerdict" "Verdict",
    "finalScorePct" INTEGER,
    "finalDecision" "Decision",
    "decisionDate" TIMESTAMP(3),
    "decisionMotive" TEXT,
    "conditions" TEXT,
    "commissionComments" TEXT,
    "pvText" TEXT,
    "cvAnalysis" TEXT,
    "attestationsAnalysis" TEXT,
    "briefingText" TEXT,
    "coherenceCheck" TEXT,
    "status" "EvalStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "submittedAt" TIMESTAMP(3),
    CONSTRAINT "Evaluation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "evaluationId" TEXT,
    "action" TEXT NOT NULL,
    "details" JSONB,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppConfig" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "encrypted" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AppConfig_pkey" PRIMARY KEY ("key")
);

-- AddForeignKey
ALTER TABLE "Evaluation" ADD CONSTRAINT "Evaluation_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Evaluation" ADD CONSTRAINT "Evaluation_evaluatorId_fkey" FOREIGN KEY ("evaluatorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_evaluationId_fkey" FOREIGN KEY ("evaluationId") REFERENCES "Evaluation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
