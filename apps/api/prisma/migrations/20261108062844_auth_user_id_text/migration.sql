-- AlterTable
ALTER TABLE "auth_sessions" ALTER COLUMN "user_id" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "refresh_tokens" ALTER COLUMN "user_id" SET DATA TYPE TEXT;
