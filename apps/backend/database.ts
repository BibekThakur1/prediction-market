// Keep the API's database import relative so Vercel traces the shared Prisma
// package into the Express Function instead of leaving a workspace-only import.
export { Prisma, prisma } from "../../packages/db/index";
