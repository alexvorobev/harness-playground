import getCurrentDate from "./get_current_date/index.js";

const allTools = [getCurrentDate];

// What we send to Claude.
export const toolDefinitions = allTools.map((t) => t.toolDefinition);

// How we find the handler when Claude asks for a tool by name.
export const toolsByName = new Map(
  allTools.map((t) => [t.toolDefinition.name, t]),
);
