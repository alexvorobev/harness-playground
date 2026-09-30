import type Anthropic from "@anthropic-ai/sdk";

const toolDefinition: Anthropic.Tool = {
  name: "get_current_date",
  description:
    "Returns the current date, day of the week, and time. Use whenever the answer depends on today's date. Do not guess the date; call this tool instead.",
  input_schema: {
    type: "object",
    properties: {
      timezone: {
        type: "string",
        description: "IANA timezone, e.g. 'Asia/Tokyo'. Defaults to UTC.",
      },
    },
    required: [],
  },
};

// Claude sends tool arguments as untyped JSON -> need to narrow the input
const readTimezone = (input: unknown): string => {
  if (typeof input !== "object" || input === null || !("timezone" in input)) {
    return "UTC";
  }
  const { timezone } = input;
  if (typeof timezone !== "string") {
    throw new Error("`timezone` must be a string, e.g. 'Asia/Tokyo'.");
  }
  return timezone;
};

const tool = (input: unknown): string => {
  const timezone = readTimezone(input);

  let formatter: Intl.DateTimeFormat;
  try {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      weekday: "long",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    });
  } catch {
    throw new Error(
      `Unknown timezone '${timezone}'. Use an IANA name like 'Europe/London'.`,
    );
  }

  const parts = formatter.formatToParts(new Date());
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "";

  return JSON.stringify({
    date: `${part("year")}-${part("month")}-${part("day")}`,
    day_of_week: part("weekday"),
    time: `${part("hour")}:${part("minute")}:${part("second")}`,
    timezone,
  });
};

export default {
  toolDefinition,
  tool,
};
