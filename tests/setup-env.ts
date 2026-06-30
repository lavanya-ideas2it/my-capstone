// Runs before every test file: force the test database + secrets into the env
// BEFORE any app module (and its Prisma singleton) is imported.
import { config } from "dotenv";

config({ path: ".env.test", override: true });
