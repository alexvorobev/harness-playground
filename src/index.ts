#!/usr/bin/env node

import type Anthropic from "@anthropic-ai/sdk";
import { createInterface } from "node:readline/promises";
import { createMessage } from "./llm/anthropic.js";
import { toApiSchema } from "./llm/jsonSchema.js";
import { dateSchema } from "./schemas/date.js";
import { toolDefinitions, toolsByName } from "./tools/index.js";
import { renderDates } from "./ui/dateWidget.js";

// Only the last MEMORY_LIMIT messages are sent.
const MEMORY_LIMIT = 20;

// How many finished answers from Claude we want.
const MAX_TURNS = 1;

// Safety net: max tool rounds, so a tool-calling cycle can't go on forever.
const MAX_TOOL_ROUNDS = 5;

// Filled as the user types; Claude sees the whole conversation.
const memory: Anthropic.MessageParam[] = [];

const system =
  "Chat openly with the user. Follow the dialog naturally. Don't greet if you already did.";

// Totals for the whole session, printed on exit.
const tokens = { calls: 0, input: 0, output: 0 };

// The agent loop: answers the latest user message, calling tools as needed.
async function answer(): Promise<void> {
  let turn = 0;
  let toolRounds = 0;

  while (turn < MAX_TURNS && toolRounds < MAX_TOOL_ROUNDS) {
    const reply = await createMessage({
      model: "claude-haiku-4-5",
      max_tokens: 16000,
      system,
      messages: memory.slice(-MEMORY_LIMIT),
      tools: toolDefinitions,
      // Structured output only once a tool has run; small talk stays plain text.
      ...(toolRounds > 0 && {
        output_config: {
          format: { type: "json_schema", schema: toApiSchema(dateSchema) },
        },
      }),
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
          const output = handler.tool(block.input);
          console.log(`Tool result: ${block.name}`, output);
          results.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: output,
          });
        } catch (error) {
          // Send the error back so Claude can see it and retry.
          const message = (error as Error).message;
          console.log(`Tool error: ${block.name}`, message);
          results.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: message,
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
    const text = textBlock?.text ?? "";

    if (toolRounds === 0) {
      console.log(text);
      continue;
    }

    // A tool ran, so the answer follows dateSchema: show it as a widget.
    try {
      console.log(renderDates(dateSchema.parse(JSON.parse(text))));
    } catch {
      console.log(text); // e.g. cut off by max_tokens: show the raw text instead
    }
  }
}

// The conversation loop: one pass per line the user types.
async function main(): Promise<void> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  rl.setPrompt("> ");
  rl.prompt();

  // Ends on /exit, or when input closes (Ctrl+D).
  for await (const line of rl) {
    const input = line.trim();
    if (input === "/exit") break;

    if (input) {
      memory.push({ role: "user", content: input });
      await answer();
    }
    rl.prompt();
  }

  rl.close();
  console.log(
    `Tokens: ${tokens.calls} calls, input ${tokens.input}, output ${tokens.output}, total ${tokens.input + tokens.output}`,
  );
}

main();
