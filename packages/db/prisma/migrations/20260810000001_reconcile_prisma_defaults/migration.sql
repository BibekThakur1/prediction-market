-- Align database defaults and optional relation delete actions with the Prisma schema.
ALTER TABLE "LedgerEntry" DROP CONSTRAINT "LedgerEntry_orderId_fkey";
ALTER TABLE "LedgerEntry" DROP CONSTRAINT "LedgerEntry_tradeId_fkey";
ALTER TABLE "LedgerEntry" DROP CONSTRAINT "LedgerEntry_transferId_fkey";

ALTER TABLE "Market" ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "Order" ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "Position" ALTER COLUMN "availableQty" SET DEFAULT 0;
ALTER TABLE "Position" ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "availableBalance" SET DEFAULT 0;
ALTER TABLE "User" ALTER COLUMN "updatedAt" DROP DEFAULT;

ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_tradeId_fkey" FOREIGN KEY ("tradeId") REFERENCES "Trade"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_transferId_fkey" FOREIGN KEY ("transferId") REFERENCES "Transfer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
