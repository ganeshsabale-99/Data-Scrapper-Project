-- AlterTable
ALTER TABLE "AdminUser" ADD COLUMN     "city" TEXT,
ADD COLUMN     "state" TEXT,
ALTER COLUMN "role" SET DEFAULT 'SALES_EXECUTIVE';

-- AlterTable
ALTER TABLE "FundingNews" ADD COLUMN     "contact_email" TEXT,
ADD COLUMN     "contact_person" TEXT,
ADD COLUMN     "contact_phone" TEXT,
ADD COLUMN     "contact_status" "Status" DEFAULT 'NOT_CONTACTED';
