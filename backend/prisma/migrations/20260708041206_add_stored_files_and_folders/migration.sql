-- CreateTable
CREATE TABLE "storage_folders" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parent_id" TEXT,
    "project_id" TEXT,
    "bucket_name" TEXT NOT NULL,
    "prefix" TEXT NOT NULL DEFAULT '',
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "storage_folders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stored_files" (
    "id" TEXT NOT NULL,
    "bucket_name" TEXT NOT NULL,
    "object_key" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "original_name" TEXT NOT NULL,
    "content_type" TEXT NOT NULL,
    "size" BIGINT NOT NULL,
    "content_hash" TEXT NOT NULL,
    "module" TEXT NOT NULL DEFAULT 'default',
    "owner_id" TEXT NOT NULL,
    "project_id" TEXT,
    "folder_id" TEXT,
    "description" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "custom_metadata" JSONB NOT NULL DEFAULT '{}',
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stored_files_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "storage_folders_project_id_idx" ON "storage_folders"("project_id");

-- CreateIndex
CREATE INDEX "storage_folders_parent_id_idx" ON "storage_folders"("parent_id");

-- CreateIndex
CREATE INDEX "storage_folders_bucket_name_idx" ON "storage_folders"("bucket_name");

-- CreateIndex
CREATE INDEX "storage_folders_name_idx" ON "storage_folders"("name");

-- CreateIndex
CREATE UNIQUE INDEX "storage_folders_project_id_code_key" ON "storage_folders"("project_id", "code");

-- CreateIndex
CREATE INDEX "stored_files_owner_id_idx" ON "stored_files"("owner_id");

-- CreateIndex
CREATE INDEX "stored_files_module_idx" ON "stored_files"("module");

-- CreateIndex
CREATE INDEX "stored_files_folder_id_idx" ON "stored_files"("folder_id");

-- CreateIndex
CREATE INDEX "stored_files_project_id_idx" ON "stored_files"("project_id");

-- CreateIndex
CREATE INDEX "stored_files_deleted_at_idx" ON "stored_files"("deleted_at");

-- CreateIndex
CREATE INDEX "stored_files_original_name_idx" ON "stored_files"("original_name");

-- CreateIndex
CREATE INDEX "stored_files_content_type_idx" ON "stored_files"("content_type");

-- CreateIndex
CREATE INDEX "stored_files_size_idx" ON "stored_files"("size");

-- CreateIndex
CREATE INDEX "stored_files_created_at_idx" ON "stored_files"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "stored_files_bucket_name_object_key_key" ON "stored_files"("bucket_name", "object_key");

-- CreateIndex
CREATE UNIQUE INDEX "stored_files_bucket_name_path_key" ON "stored_files"("bucket_name", "path");

-- AddForeignKey
ALTER TABLE "storage_folders" ADD CONSTRAINT "storage_folders_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "storage_folders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "storage_folders" ADD CONSTRAINT "storage_folders_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "storage_folders" ADD CONSTRAINT "storage_folders_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stored_files" ADD CONSTRAINT "stored_files_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stored_files" ADD CONSTRAINT "stored_files_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stored_files" ADD CONSTRAINT "stored_files_folder_id_fkey" FOREIGN KEY ("folder_id") REFERENCES "storage_folders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
