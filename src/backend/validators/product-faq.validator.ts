import { z } from "zod";

export const assignProductFaqSchema = z
  .object({
    faqId: z.string().uuid("Invalid FAQ ID (must be a valid UUID)"),
    sortOrder: z.number().int().min(0, "sortOrder must be a non-negative integer").optional(),
  })
  .strict();

export const reorderProductFaqsSchema = z
  .object({
    faqIds: z
      .array(z.string().uuid("Invalid FAQ ID (must be a valid UUID)"))
      .min(1, "faqIds must contain at least one FAQ ID")
      .refine((ids) => new Set(ids).size === ids.length, {
        message: "Duplicate FAQ IDs are not allowed in reorder",
      }),
  })
  .strict();

export type AssignProductFaqInput = z.infer<typeof assignProductFaqSchema>;
export type ReorderProductFaqsInput = z.infer<typeof reorderProductFaqsSchema>;
