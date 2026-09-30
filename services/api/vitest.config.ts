import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    fileParallelism: false,
    testTimeout: 20_000,
    env: {
      STAGE: "test",
      DATABASE_URL: process.env.TEST_DATABASE_URL ?? "postgres://postgres@localhost:5432/pavielle_test",
      DEV_AUTH: "1",
      PAYHERE_MERCHANT_ID: "1211149",
      PAYHERE_MERCHANT_SECRET: "test-secret",
      PAYHERE_SANDBOX: "1",
    },
  },
});
