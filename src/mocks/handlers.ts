import { getGetHealthMockHandler200 } from "@/api/generated/health/health.msw";

// Orval's default mocks return random strings; each handler here pins what the real API sends.
export const handlers = [getGetHealthMockHandler200({ status: "ok" })];
