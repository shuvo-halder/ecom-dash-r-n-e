import { z } from "zod";

export const SUPPORTED_ARCHIVE_ENTITIES = [
  "products",
  "variants",
  "product-images",
  "categories",
  "brands",
  "orders",
  "payments",
  "refunds",
  "returns",
  "shipments",
  "coupons",
  "promotions",
  "marketing-campaigns",
  "banners",
  "popups",
  "pages",
  "landing-pages",
  "blog-posts",
  "faqs",
  "reviews",
  "users",
  "roles",
] as const;

export type SupportedArchiveEntityType = (typeof SUPPORTED_ARCHIVE_ENTITIES)[number];

export const archiveEntityTypeSchema = z.enum(SUPPORTED_ARCHIVE_ENTITIES);

export const archiveListQuerySchema = z.object({
  page: z
    .preprocess((val) => (val !== undefined && val !== null && val !== "" ? parseInt(String(val), 10) : 1), z.number().int().min(1).default(1)),
  limit: z
    .preprocess((val) => (val !== undefined && val !== null && val !== "" ? parseInt(String(val), 10) : 20), z.number().int().min(1).max(100).default(20)),
  search: z.string().trim().optional(),
  from: z
    .string()
    .trim()
    .refine((val) => !val || !isNaN(Date.parse(val)), {
      message: "Invalid 'from' date format (must be YYYY-MM-DD or ISO date string)",
    })
    .optional(),
  to: z
    .string()
    .trim()
    .refine((val) => !val || !isNaN(Date.parse(val)), {
      message: "Invalid 'to' date format (must be YYYY-MM-DD or ISO date string)",
    })
    .optional(),
});

export type ArchiveListQuery = z.infer<typeof archiveListQuerySchema>;

export const hardDeleteBodySchema = z.object({
  reason: z
    .string()
    .trim()
    .min(3, "Reason must be at least 3 characters long")
    .max(500, "Reason cannot exceed 500 characters"),
});

export type HardDeleteBody = z.infer<typeof hardDeleteBodySchema>;
