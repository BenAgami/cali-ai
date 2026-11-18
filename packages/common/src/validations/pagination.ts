import { z } from "zod";

export const pageMetaSchema = z.object({
  limit: z.number().int(),
  offset: z.number().int(),
  hasMore: z.boolean(),
  nextOffset: z.number().int().nullable(),
});
export type PageMeta = z.infer<typeof pageMetaSchema>;

export const paginatedSchema = <T extends z.ZodTypeAny>(itemSchema: T) =>
  z.object({
    items: z.array(itemSchema),
    page: pageMetaSchema,
  });
