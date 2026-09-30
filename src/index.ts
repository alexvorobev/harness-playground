#!/usr/bin/env node

import type Anthropic from "@anthropic-ai/sdk";
import { createMessage } from "./llm/anthropic.js";
import { toApiSchema } from "./llm/jsonSchema.js";
import { dateSchema } from "./schemas/date.js";
import { toolDefinitions, toolsByName } from "./tools/index.js";

// Only the last MEMORY_LIMIT messages are sent.
const MEMORY_LIMIT = 20;

// How many finished answers from Claude we want.
const MAX_TURNS = 1;

// Safety net: max tool rounds, so a tool-calling cycle can't go on forever.
const MAX_TOOL_ROUNDS = 5;

const memory: Anthropic.MessageParam[] = [
  {
    role: "user",
    content: "What's the day is today?",
  },
];

const system =
  "Chat openly with the user. Follow the dialog naturally. Don't greet if you already did.";

async function main(): Promise<void> {
  let turn = 0;
  let toolRounds = 0;
  const tokens = { calls: 0, input: 0, output: 0 };

  while (turn < MAX_TURNS && toolRounds < MAX_TOOL_ROUNDS) {
    const reply = await createMessage({
      model: "claude-opus-5-5",
      max_tokens: 16000,
      system,
      messages: memory.slice(-MEMORY_LIMIT),
      tools: toolDefinitions,
      output_config: {
        format: { type: "json_schema", schema: toApiSchema(dateSchema) },
      },
    });

    tokens.calls++;
    tokens.input += reply.usage.input_tokens;
    tokens.output += reply.usage.output_tokens;
    console.log(
      `[call ${tokens.calls}] input: ${reply.usage.input_tokens}, output: ${reply.usage.output_tokens}`,
    );

    // Add record before action to store state in case of failure
    memory.push({ role: "assistant", content: reply.content });

    if (reply.stop_reason === "tool_use") {
      toolRounds++;
      const results: Anthropic.ToolResultBlockParam[] = [];

      for (const block of reply.content) {
        if (block.type !== "tool_use") continue;
        console.log(`Tool requested: ${block.name}`, block.input);

        const handler = toolsByName.get(block.name);
        try {
          if (!handler) throw new Error(`Unknown tool: ${block.name}`);
          results.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: handler.tool(block.input),
          });
        } catch (error) {
          // Send the error back so Claude can see it and retry.
          results.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: (error as Error).message,
            is_error: true,
          });
        }
      }

      // All results go back together in one user message.
      memory.push({ role: "user", content: results });
      continue;
    }

    // anything but tools use is bumping turns
    turn++;
    console.log(`Stopped: ${reply.stop_reason}`);
    // prevent return of thinking block
    const textBlock = reply.content.find((block) => block.type === "text");
    console.log("Final output:", textBlock?.text);
  }

  console.log(
    `Tokens: ${tokens.calls} calls, input ${tokens.input}, output ${tokens.output}, total ${tokens.input + tokens.output}`,
  );
}

main();
