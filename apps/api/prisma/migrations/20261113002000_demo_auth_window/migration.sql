CREATE TABLE "DemoAuthWindow" (
    "id" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DemoAuthWindow_pkey" PRIMARY KEY ("id")
);
