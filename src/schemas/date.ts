import { z } from "zod";

const cityDateSchema = z.object({
  city: z.string().describe("City the date is for, e.g. 'Bangkok'."),
  dayOfTheWeek: z.enum(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]),
  day: z.number().int().describe("Day of the month, 1-31."),
  month: z.string().describe("Full month name, e.g. 'September'."),
  year: z.number().int().optional(),
});

// The API requires an object at the top level, so the list is wrapped in `dates`.
export const dateSchema = z.object({
  dates: z.array(cityDateSchema).describe("One entry per city the user asked about."),
});

export type DateOutput = z.infer<typeof dateSchema>;
