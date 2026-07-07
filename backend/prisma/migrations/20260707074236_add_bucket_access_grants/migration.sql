-- CreateEnum
CREATE TYPE "GrantSubjectType" AS ENUM ('USER', 'API_KEY');

-- CreateTable
CREATE TABLE "bucket_access_grants" (
    "id" TEXT NOT NULL,
    "bucket_name" TEXT NOT NULL,
    "subject_type" "GrantSubjectType" NOT NULL,
    "subject_id" TEXT NOT NULL,
    "permissions" TEXT[],
    "prefix" TEXT NOT NULL DEFAULT '',
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bucket_access_grants_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "bucket_access_grants_subject_type_subject_id_idx" ON "bucket_access_grants"("subject_type", "subject_id");

-- CreateIndex
CREATE INDEX "bucket_access_grants_bucket_name_idx" ON "bucket_access_grants"("bucket_name");

-- CreateIndex
CREATE UNIQUE INDEX "bucket_access_grants_bucket_name_subject_type_subject_id_pr_key" ON "bucket_access_grants"("bucket_name", "subject_type", "subject_id", "prefix");
