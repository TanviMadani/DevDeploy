-- AlterEnum
ALTER TYPE "DeploymentStatus" ADD VALUE 'RUNNING';

-- AlterTable
ALTER TABLE "Deployment" ADD COLUMN     "runtimePort" INTEGER;
