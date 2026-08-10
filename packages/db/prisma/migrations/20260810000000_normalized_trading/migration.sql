-- Replace JSON order books with normalized, auditable trading records.
CREATE TYPE "MarketStatus" AS ENUM ('OPEN', 'CLOSED', 'RESOLVED', 'CANCELLED');
CREATE TYPE "Outcome" AS ENUM ('YES', 'NO');
CREATE TYPE "OrderSide" AS ENUM ('BUY', 'SELL');
CREATE TYPE "OrderStatus" AS ENUM ('OPEN', 'PARTIALLY_FILLED', 'FILLED', 'CANCELLED');
CREATE TYPE "LedgerAsset" AS ENUM ('CASH', 'YES', 'NO');
CREATE TYPE "LedgerReason" AS ENUM ('DEPOSIT', 'WITHDRAWAL', 'ORDER_RESERVE', 'ORDER_RELEASE', 'TRADE_SETTLEMENT', 'SPLIT', 'MERGE', 'RESOLUTION');
CREATE TYPE "TransferType" AS ENUM ('DEPOSIT', 'WITHDRAWAL');
CREATE TYPE "TransferStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'CANCELLED');

ALTER TABLE "User" RENAME COLUMN "usdBalance" TO "availableBalance";
ALTER TABLE "User" ADD COLUMN "reservedBalance" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "Market" DROP COLUMN "yesOrderbook", DROP COLUMN "noOrderbook", DROP COLUMN "totalQty", DROP COLUMN "resolution";
ALTER TABLE "Market" ADD COLUMN "category" TEXT NOT NULL DEFAULT 'General',
  ADD COLUMN "status" "MarketStatus" NOT NULL DEFAULT 'OPEN',
  ADD COLUMN "closesAt" TIMESTAMP(3),
  ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

DROP INDEX "Position_userId_marketId_type_key";
ALTER TABLE "Position" ADD COLUMN "outcome" "Outcome";
UPDATE "Position" SET "outcome" = CASE WHEN "type"::text = 'Yes' THEN 'YES'::"Outcome" ELSE 'NO'::"Outcome" END;
ALTER TABLE "Position" ALTER COLUMN "outcome" SET NOT NULL;
ALTER TABLE "Position" DROP COLUMN "type";
ALTER TABLE "Position" RENAME COLUMN "qty" TO "availableQty";
ALTER TABLE "Position" ADD COLUMN "reservedQty" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

DROP TABLE "OrderHistory";
DROP TYPE "OrderType";
DROP TYPE "PositionType";

CREATE TABLE "Order" (
  "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "marketId" TEXT NOT NULL,
  "outcome" "Outcome" NOT NULL, "side" "OrderSide" NOT NULL,
  "price" INTEGER NOT NULL, "quantity" INTEGER NOT NULL, "filledQuantity" INTEGER NOT NULL DEFAULT 0,
  "status" "OrderStatus" NOT NULL DEFAULT 'OPEN', "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "cancelledAt" TIMESTAMP(3),
  CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Trade" (
  "id" TEXT NOT NULL, "marketId" TEXT NOT NULL, "outcome" "Outcome" NOT NULL,
  "price" INTEGER NOT NULL, "quantity" INTEGER NOT NULL, "buyerId" TEXT NOT NULL, "sellerId" TEXT NOT NULL,
  "makerOrderId" TEXT NOT NULL, "takerOrderId" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Trade_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Transfer" (
  "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "type" "TransferType" NOT NULL,
  "status" "TransferStatus" NOT NULL DEFAULT 'COMPLETED', "amount" INTEGER NOT NULL,
  "externalRef" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "completedAt" TIMESTAMP(3),
  CONSTRAINT "Transfer_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LedgerEntry" (
  "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "marketId" TEXT, "orderId" TEXT, "tradeId" TEXT, "transferId" TEXT,
  "asset" "LedgerAsset" NOT NULL, "availableDelta" INTEGER NOT NULL, "reservedDelta" INTEGER NOT NULL,
  "reason" "LedgerReason" NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LedgerEntry_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MarketResolution" (
  "id" TEXT NOT NULL, "marketId" TEXT NOT NULL, "outcome" "Outcome" NOT NULL,
  "source" TEXT NOT NULL, "evidence" TEXT, "resolvedBy" TEXT NOT NULL, "resolvedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MarketResolution_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Position_userId_marketId_outcome_key" ON "Position"("userId", "marketId", "outcome");
CREATE INDEX "Position_marketId_outcome_idx" ON "Position"("marketId", "outcome");
CREATE INDEX "Market_status_createdAt_idx" ON "Market"("status", "createdAt");
CREATE INDEX "Market_category_idx" ON "Market"("category");
CREATE INDEX "Order_marketId_outcome_side_status_price_createdAt_idx" ON "Order"("marketId", "outcome", "side", "status", "price", "createdAt");
CREATE INDEX "Order_userId_createdAt_idx" ON "Order"("userId", "createdAt");
CREATE INDEX "Trade_marketId_createdAt_idx" ON "Trade"("marketId", "createdAt");
CREATE INDEX "Trade_buyerId_createdAt_idx" ON "Trade"("buyerId", "createdAt");
CREATE INDEX "Trade_sellerId_createdAt_idx" ON "Trade"("sellerId", "createdAt");
CREATE UNIQUE INDEX "Transfer_externalRef_key" ON "Transfer"("externalRef");
CREATE INDEX "Transfer_userId_createdAt_idx" ON "Transfer"("userId", "createdAt");
CREATE INDEX "LedgerEntry_userId_createdAt_idx" ON "LedgerEntry"("userId", "createdAt");
CREATE INDEX "LedgerEntry_orderId_idx" ON "LedgerEntry"("orderId");
CREATE INDEX "LedgerEntry_tradeId_idx" ON "LedgerEntry"("tradeId");
CREATE UNIQUE INDEX "MarketResolution_marketId_key" ON "MarketResolution"("marketId");

ALTER TABLE "Order" ADD CONSTRAINT "Order_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Order" ADD CONSTRAINT "Order_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Trade" ADD CONSTRAINT "Trade_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Trade" ADD CONSTRAINT "Trade_makerOrderId_fkey" FOREIGN KEY ("makerOrderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Trade" ADD CONSTRAINT "Trade_takerOrderId_fkey" FOREIGN KEY ("takerOrderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Transfer" ADD CONSTRAINT "Transfer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_tradeId_fkey" FOREIGN KEY ("tradeId") REFERENCES "Trade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_transferId_fkey" FOREIGN KEY ("transferId") REFERENCES "Transfer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MarketResolution" ADD CONSTRAINT "MarketResolution_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "User" ADD CONSTRAINT "User_balances_nonnegative" CHECK ("availableBalance" >= 0 AND "reservedBalance" >= 0);
ALTER TABLE "Position" ADD CONSTRAINT "Position_quantities_nonnegative" CHECK ("availableQty" >= 0 AND "reservedQty" >= 0);
ALTER TABLE "Order" ADD CONSTRAINT "Order_values_valid" CHECK ("price" BETWEEN 1 AND 99 AND "quantity" > 0 AND "filledQuantity" >= 0 AND "filledQuantity" <= "quantity");
ALTER TABLE "Trade" ADD CONSTRAINT "Trade_values_valid" CHECK ("price" BETWEEN 1 AND 99 AND "quantity" > 0);
ALTER TABLE "Transfer" ADD CONSTRAINT "Transfer_amount_positive" CHECK ("amount" > 0);

CREATE FUNCTION prevent_ledger_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'LedgerEntry records are immutable';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "LedgerEntry_immutable"
BEFORE UPDATE OR DELETE ON "LedgerEntry"
FOR EACH ROW EXECUTE FUNCTION prevent_ledger_mutation();
