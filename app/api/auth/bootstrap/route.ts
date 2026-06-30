import { handleRoute, json } from "@/lib/http";
import { prisma } from "@/lib/prisma";

// GET /api/auth/bootstrap — public. Tells the UI whether the first-admin
// bootstrap window is still open (zero users exist). Used to conditionally
// show the "Set up your account" link on the login page.
export async function GET() {
  return handleRoute(async () => {
    const count = await prisma.user.count();
    return json({ needsBootstrap: count === 0 });
  });
}
