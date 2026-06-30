// Zod schemas — the single validation boundary for every API route (SPEC §4).
// Bodies are strict (unknown fields rejected); query schemas coerce strings
// from URLSearchParams and strip unknown keys.
import { z } from "zod";

export const roleSchema = z.enum(["ADMIN", "EDITOR", "VIEWER"]);
export type RoleInput = z.infer<typeof roleSchema>;

const password = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(200);

// ---------- Auth ----------
export const registerSchema = z
  .object({
    email: z.email().max(320),
    name: z.string().min(1, "Name is required").max(120),
    password,
    role: roleSchema.optional(),
  })
  .strict();
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z
  .object({
    email: z.email(),
    password: z.string().min(1, "Password is required"),
  })
  .strict();
export type LoginInput = z.infer<typeof loginSchema>;

// ---------- Articles ----------
export const createArticleSchema = z
  .object({
    title: z.string().min(1, "Title is required").max(300),
    body: z.string().max(1_000_000).default(""),
    tagIds: z.array(z.string().min(1)).max(50).default([]),
  })
  .strict();
export type CreateArticleInput = z.infer<typeof createArticleSchema>;

export const updateArticleSchema = z
  .object({
    title: z.string().min(1).max(300).optional(),
    body: z.string().max(1_000_000).optional(),
    tagIds: z.array(z.string().min(1)).max(50).optional(),
    changeSummary: z.string().max(500).optional(),
  })
  .strict()
  .refine(
    (v) =>
      v.title !== undefined ||
      v.body !== undefined ||
      v.tagIds !== undefined,
    { message: "Nothing to update" }
  );
export type UpdateArticleInput = z.infer<typeof updateArticleSchema>;

// ---------- Tags ----------
export const createTagSchema = z
  .object({ name: z.string().min(1, "Name is required").max(60) })
  .strict();
export type CreateTagInput = z.infer<typeof createTagSchema>;

export const updateTagSchema = createTagSchema;
export type UpdateTagInput = z.infer<typeof updateTagSchema>;

// ---------- Admin ----------
export const updateUserSchema = z
  .object({
    role: roleSchema.optional(),
    name: z.string().min(1).max(120).optional(),
  })
  .strict()
  .refine((v) => v.role !== undefined || v.name !== undefined, {
    message: "Nothing to update",
  });
export type UpdateUserInput = z.infer<typeof updateUserSchema>;

// ---------- Import ----------
export const importSchema = z
  .object({
    files: z
      .array(z.string().min(1))
      .min(1, "No files provided")
      .max(100, "Maximum 100 files per import request"),
  })
  .strict();
export type ImportInput = z.infer<typeof importSchema>;

// ---------- Query params ----------
export const paginationQuery = z.object({
  tag: z.string().min(1).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type PaginationQuery = z.infer<typeof paginationQuery>;

export const searchQuery = z.object({
  q: z.string().min(1, "Query is required").max(500, "Query too long"),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type SearchQuery = z.infer<typeof searchQuery>;

export const diffQuery = z.object({
  from: z.coerce.number().int().min(1),
  to: z.coerce.number().int().min(1),
});
export type DiffQuery = z.infer<typeof diffQuery>;

export const revisionsQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

/** Parse a URLSearchParams against a schema (entries -> object). */
export function parseQuery<T>(
  schema: { parse: (v: unknown) => T },
  params: URLSearchParams
): T {
  return schema.parse(Object.fromEntries(params.entries()));
}
