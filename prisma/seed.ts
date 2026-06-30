/**
 * TeamWiki seed — realistic sample data for local development.
 *
 * Creates:
 *   - Users across all three roles (ADMIN / EDITOR / VIEWER), argon2id-hashed.
 *   - A set of tags.
 *   - Articles, each with an append-only Revision history (some edited several
 *     times) and the Article's `currentRevisionId` pointing at the latest.
 *
 * Re-runnable: wipes existing rows first. Never run against dev/prod data
 * (uses DATABASE_URL — point it at a disposable DB).
 *
 *   npm run db:seed
 */
import { PrismaClient, Role } from "@prisma/client";
import argon2 from "argon2";

const prisma = new PrismaClient();

// Shared password for every seeded account (dev only).
const SEED_PASSWORD = "Password123!";

/** Minimal, dependency-free slugify matching the app's intent. */
function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

type RevisionSeed = {
  title: string;
  body: string;
  changeSummary?: string;
  /** Hours-ago offset so timestamps tell a coherent story. */
  hoursAgo: number;
};

type ArticleSeed = {
  authorEmail: string;
  tagNames: string[];
  revisions: RevisionSeed[]; // ordered oldest -> newest (>= 1)
};

async function reset() {
  // Order matters: Article.currentRevisionId -> Revision uses NO ACTION, so
  // detach those pointers before deleting revisions.
  await prisma.session.deleteMany();
  await prisma.article.updateMany({ data: { currentRevisionId: null } });
  await prisma.revision.deleteMany();
  await prisma.article.deleteMany();
  await prisma.tag.deleteMany();
  await prisma.user.deleteMany();
}

async function main() {
  console.log("Resetting existing data…");
  await reset();

  const passwordHash = await argon2.hash(SEED_PASSWORD, { type: argon2.argon2id });

  console.log("Seeding users…");
  const users = await Promise.all(
    [
      { email: "admin@teamwiki.dev", name: "Ada Admin", role: Role.ADMIN },
      { email: "edie@teamwiki.dev", name: "Edie Editor", role: Role.EDITOR },
      { email: "evan@teamwiki.dev", name: "Evan Editor", role: Role.EDITOR },
      { email: "vera@teamwiki.dev", name: "Vera Viewer", role: Role.VIEWER },
      { email: "victor@teamwiki.dev", name: "Victor Viewer", role: Role.VIEWER },
    ].map((u) => prisma.user.create({ data: { ...u, passwordHash } }))
  );
  const userByEmail = new Map(users.map((u) => [u.email, u]));

  console.log("Seeding tags…");
  const tagNames = [
    "Engineering",
    "Onboarding",
    "Security",
    "Frontend",
    "Backend",
    "Database",
    "DevOps",
    "Process",
  ];
  const tags = await Promise.all(
    tagNames.map((name) =>
      prisma.tag.create({ data: { name, slug: slugify(name) } })
    )
  );
  const tagByName = new Map(tags.map((t) => [t.name, t]));

  console.log("Seeding articles + revisions…");
  const now = Date.now();
  const at = (hoursAgo: number) => new Date(now - hoursAgo * 3_600_000);

  const articleSeeds: ArticleSeed[] = [
    {
      authorEmail: "edie@teamwiki.dev",
      tagNames: ["Onboarding", "Process"],
      revisions: [
        {
          title: "New Hire Onboarding",
          body: "# Welcome to the team\n\nThis guide walks you through your first week.\n\n1. Get your accounts provisioned by an admin.\n2. Clone the main repositories.\n3. Read the architecture overview.",
          hoursAgo: 240,
        },
        {
          title: "New Hire Onboarding",
          body: "# Welcome to the team\n\nThis guide walks you through your first week.\n\n1. Get your accounts provisioned by an admin.\n2. Clone the main repositories and run the setup script.\n3. Read the architecture overview.\n4. Pair with your onboarding buddy on a starter ticket.",
          changeSummary: "Add setup script + onboarding buddy step",
          hoursAgo: 72,
        },
        {
          title: "New Hire Onboarding Guide",
          body: "# Welcome to the team\n\nThis guide walks you through your first week.\n\n## Day 1\n1. Get your accounts provisioned by an admin.\n2. Clone the main repositories and run `./scripts/setup.sh`.\n\n## Day 2–5\n3. Read the architecture overview.\n4. Pair with your onboarding buddy on a starter ticket.\n5. Ship a small change to production behind a flag.",
          changeSummary: "Restructure into Day 1 / Day 2–5, retitle",
          hoursAgo: 5,
        },
      ],
    },
    {
      authorEmail: "evan@teamwiki.dev",
      tagNames: ["Engineering", "Backend", "Database"],
      revisions: [
        {
          title: "PostgreSQL Full-Text Search",
          body: "# Full-text search in Postgres\n\nWe use a generated `tsvector` column with a GIN index. Queries go through `websearch_to_tsquery` and rank with `ts_rank`.\n\nNever filter in application code — let the index do the work.",
          hoursAgo: 120,
        },
        {
          title: "PostgreSQL Full-Text Search",
          body: "# Full-text search in Postgres\n\nWe use a generated `tsvector` column with a GIN index. The vector weights the title above the body (`A` vs `B`).\n\nQueries go through `websearch_to_tsquery` and rank with `ts_rank`; snippets come from `ts_headline`.\n\nNever filter in application code — let the index do the work. Verify with `EXPLAIN ANALYZE`.",
          changeSummary: "Document weighting, ts_headline, EXPLAIN check",
          hoursAgo: 30,
        },
      ],
    },
    {
      authorEmail: "edie@teamwiki.dev",
      tagNames: ["Security", "Backend"],
      revisions: [
        {
          title: "Authentication & Authorization",
          body: "# Auth model\n\nAccess tokens are short-lived JWTs held in memory. Refresh tokens live in an httpOnly, Secure, SameSite=Strict cookie and are hashed in the `Session` table.\n\nEvery protected route gates auth first: 401 then 403, before any work.",
          hoursAgo: 96,
        },
      ],
    },
    {
      authorEmail: "evan@teamwiki.dev",
      tagNames: ["Frontend"],
      revisions: [
        {
          title: "Markdown Editor & Live Preview",
          body: "# Editor\n\nThe editor is built on CodeMirror 6. A live preview renders the same Markdown pipeline used for reading (react-markdown + rehype-sanitize), so what you write is what you get.\n\nRaw HTML and `<script>` are sanitized — never rendered.",
          hoursAgo: 60,
        },
        {
          title: "Markdown Editor & Live Preview",
          body: "# Editor\n\nThe editor is built on CodeMirror 6. A live preview renders the same Markdown pipeline used for reading (react-markdown + rehype-sanitize), so what you write is what you get.\n\nRaw HTML and `<script>` are sanitized — never rendered. Use the change-summary field to describe each edit; it shows up in the revision history.",
          changeSummary: "Mention change-summary field",
          hoursAgo: 12,
        },
      ],
    },
    {
      authorEmail: "admin@teamwiki.dev",
      tagNames: ["DevOps", "Process"],
      revisions: [
        {
          title: "CI/CD Pipeline",
          body: "# Pipeline\n\nGitHub Actions runs four stages: Test → Build → Security → Deploy.\n\n- **Test**: lint, type-check, unit + integration against an ephemeral Postgres.\n- **Build**: `next build`.\n- **Security**: dependency audit, SAST, secret scan.\n- **Deploy**: only on merge to `main` after all stages pass.",
          hoursAgo: 48,
        },
      ],
    },
    {
      authorEmail: "edie@teamwiki.dev",
      tagNames: ["Database", "Engineering"],
      revisions: [
        {
          title: "Revision History & Diffing",
          body: "# Revisions\n\nEvery edit appends an immutable `Revision` row (version N+1) and repoints the article's `currentRevisionId`. Revisions are never updated.\n\nDiffs between two versions are computed on read — they are not stored.",
          hoursAgo: 18,
        },
      ],
    },
  ];

  for (const seed of articleSeeds) {
    const author = userByEmail.get(seed.authorEmail);
    if (!author) throw new Error(`Unknown author: ${seed.authorEmail}`);

    const latest = seed.revisions[seed.revisions.length - 1];
    const baseSlug = slugify(seed.revisions[0].title);

    // Create the article in its latest state, connect tags.
    const article = await prisma.article.create({
      data: {
        slug: baseSlug,
        title: latest.title,
        body: latest.body,
        authorId: author.id,
        createdAt: at(seed.revisions[0].hoursAgo),
        updatedAt: at(latest.hoursAgo),
        tags: {
          connect: seed.tagNames.map((name) => {
            const tag = tagByName.get(name);
            if (!tag) throw new Error(`Unknown tag: ${name}`);
            return { id: tag.id };
          }),
        },
      },
    });

    // Append the revision history (version 1..N), editor = article author here.
    let lastRevisionId = "";
    for (let i = 0; i < seed.revisions.length; i++) {
      const r = seed.revisions[i];
      const rev = await prisma.revision.create({
        data: {
          articleId: article.id,
          editorId: author.id,
          version: i + 1,
          title: r.title,
          body: r.body,
          changeSummary: r.changeSummary ?? null,
          createdAt: at(r.hoursAgo),
        },
      });
      lastRevisionId = rev.id;
    }

    // Point the article at its latest revision.
    await prisma.article.update({
      where: { id: article.id },
      data: { currentRevisionId: lastRevisionId },
    });
  }

  // Counts for a quick sanity log.
  const [userCount, tagCount, articleCount, revisionCount] = await Promise.all([
    prisma.user.count(),
    prisma.tag.count(),
    prisma.article.count(),
    prisma.revision.count(),
  ]);

  console.log("Seed complete:");
  console.log(`  users:     ${userCount}`);
  console.log(`  tags:      ${tagCount}`);
  console.log(`  articles:  ${articleCount}`);
  console.log(`  revisions: ${revisionCount}`);
  console.log(`\n  Login with any seeded email and password: ${SEED_PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
