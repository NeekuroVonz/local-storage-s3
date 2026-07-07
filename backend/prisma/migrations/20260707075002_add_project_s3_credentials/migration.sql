-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "s3_access_key_id" TEXT,
ADD COLUMN     "s3_credentials_provisioned_at" TIMESTAMP(3),
ADD COLUMN     "s3_key_name" TEXT,
ADD COLUMN     "s3_secret_access_key_enc" TEXT;
