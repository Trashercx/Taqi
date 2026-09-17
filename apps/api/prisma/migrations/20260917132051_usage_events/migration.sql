-- CreateTable
CREATE TABLE "usage_events" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "metric" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usage_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usage_aggregates_hourly" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "metric" TEXT NOT NULL,
    "period_start" TIMESTAMP(3) NOT NULL,
    "total_quantity" INTEGER NOT NULL DEFAULT 0,
    "event_count" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "usage_aggregates_hourly_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usage_aggregates_daily" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "metric" TEXT NOT NULL,
    "period_start" TIMESTAMP(3) NOT NULL,
    "total_quantity" INTEGER NOT NULL DEFAULT 0,
    "event_count" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "usage_aggregates_daily_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "usage_events_organization_id_metric_occurred_at_idx" ON "usage_events"("organization_id", "metric", "occurred_at");

-- CreateIndex
CREATE UNIQUE INDEX "usage_aggregates_hourly_organization_id_metric_period_start_key" ON "usage_aggregates_hourly"("organization_id", "metric", "period_start");

-- CreateIndex
CREATE UNIQUE INDEX "usage_aggregates_daily_organization_id_metric_period_start_key" ON "usage_aggregates_daily"("organization_id", "metric", "period_start");

-- AddForeignKey
ALTER TABLE "usage_events" ADD CONSTRAINT "usage_events_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
