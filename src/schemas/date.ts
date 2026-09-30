import { z } from "zod";

export const dateSchema = z.object({
  dayOfTheWeek: z.enum(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]),
  day: z.number().int().describe("Day of the month, 1-31."),
  month: z.string().describe("Full month name, e.g. 'September'."),
  year: z.number().int().optional(),
});

export type DateOutput = z.infer<typeof dateSchema>;
