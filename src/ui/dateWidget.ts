import boxen from "boxen";
import chalk from "chalk";
import type { DateOutput } from "../schemas/date.js";

// One row per city, city names aligned into a column.
export const renderDates = ({ dates }: DateOutput): string => {
  const cityWidth = Math.max(0, ...dates.map((d) => d.city.length));

  const rows = dates.map((d) =>
    [
      chalk.cyan.bold(d.city.padEnd(cityWidth)),
      chalk.yellow(d.dayOfTheWeek),
      `${d.day} ${d.month}${d.year ? ` ${d.year}` : ""}`,
    ].join("  "),
  );

  return boxen(rows.join("\n") || "No dates.", {
    title: "📅 Dates",
    padding: { left: 1, right: 1 },
    borderStyle: "round",
    borderColor: "green",
  });
};
