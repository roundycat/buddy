import { describe, expect, it } from "vitest";
import {
  runToolAgent,
  type AgentTool,
  type ToolAgentConverse,
} from "./tool-agent";
import type { LlmToolSpec } from "@/backend/shared/llm/types";

const lookupSpec: LlmToolSpec = {
  name: "lookup_emotional_guidance",
  description: "guidance",
  inputSchema: { type: "object", properties: {}, required: [] },
};

const submitSpec: LlmToolSpec = {
  name: "submit_mission_plan",
  description: "submit",
  inputSchema: {
    type: "object",
    properties: { scene: { type: "string" } },
    required: ["scene"],
  },
};

function tools(handlers?: {
  lookup?: (input: Record<string, unknown>) => Promise<unknown>;
}): AgentTool[] {
  return [
    {
      spec: lookupSpec,
      run: handlers?.lookup ?? (async () => ({ cards: [{ id: "c1" }] })),
    },
    {
      spec: submitSpec,
      run: async (input) => input,
      terminal: true,
    },
  ];
}

describe("runToolAgent", () => {
  it("executes a tool then stops on terminal submit", async () => {
    let turn = 0;
    const converse: ToolAgentConverse = async () => {
      turn += 1;
      if (turn === 1) {
        return {
          text: "",
          stopReason: "tool_use",
          toolUses: [
            {
              toolUseId: "u1",
              name: "lookup_emotional_guidance",
              input: { tags: ["treatment_anxiety"] },
            },
          ],
        };
      }
      return {
        text: "done",
        stopReason: "tool_use",
        toolUses: [
          {
            toolUseId: "u2",
            name: "submit_mission_plan",
            input: {
              scene: "treatment",
              reasoning: "검사 날",
              focusSignals: ["치료 일정"],
              avoid: ["야외"],
              questKinds: ["chat", "observe", "photo"],
            },
          },
        ],
      };
    };

    const outcome = await runToolAgent({
      feature: "test.agent",
      system: "sys",
      task: "plan today",
      tools: tools(),
      converse,
      maxIterations: 4,
      budgetMs: 10_000,
    });

    expect(outcome.exhausted).toBe(false);
    expect(outcome.submitted?.scene).toBe("treatment");
    expect(outcome.toolCalls.map((c) => c.name)).toEqual([
      "lookup_emotional_guidance",
      "submit_mission_plan",
    ]);
    expect(outcome.toolCalls[0]?.ok).toBe(true);
    expect(outcome.toolCalls[0]?.output).toEqual({ cards: [{ id: "c1" }] });
    expect(outcome.iterations).toBe(2);
  });

  it("returns unknown-tool errors to the model instead of throwing", async () => {
    let sawErrorResult = false;
    let turn = 0;
    const converse: ToolAgentConverse = async ({ turns }) => {
      turn += 1;
      if (turn === 1) {
        return {
          text: "",
          stopReason: "tool_use",
          toolUses: [
            {
              toolUseId: "bad",
              name: "not_a_real_tool",
              input: {},
            },
          ],
        };
      }
      const last = turns[turns.length - 1];
      if (last?.role === "toolResult") {
        sawErrorResult = Boolean(last.results[0]?.isError);
      }
      return {
        text: "",
        stopReason: "tool_use",
        toolUses: [
          {
            toolUseId: "ok",
            name: "submit_mission_plan",
            input: { scene: "sunny" },
          },
        ],
      };
    };

    const outcome = await runToolAgent({
      feature: "test.agent",
      system: "sys",
      task: "plan",
      tools: tools(),
      converse,
    });

    expect(sawErrorResult).toBe(true);
    expect(outcome.submitted?.scene).toBe("sunny");
    expect(outcome.toolCalls[0]?.ok).toBe(false);
    expect(outcome.toolCalls[0]?.error).toMatch(/unknown tool/);
  });

  it("marks exhausted when the model never submits", async () => {
    const converse: ToolAgentConverse = async () => ({
      text: "still thinking",
      stopReason: "tool_use",
      toolUses: [
        {
          toolUseId: "u",
          name: "lookup_emotional_guidance",
          input: { tags: ["play"] },
        },
      ],
    });

    const outcome = await runToolAgent({
      feature: "test.agent",
      system: "sys",
      task: "plan",
      tools: tools(),
      converse,
      maxIterations: 3,
      budgetMs: 10_000,
    });

    // Last iteration forces terminal toolChoice; if converse still returns
    // lookup only, we keep looping until exhausted without a submit.
    expect(outcome.submitted).toBeNull();
    expect(outcome.exhausted).toBe(true);
    expect(outcome.iterations).toBe(3);
  });

  it("ends cleanly when the model answers in text", async () => {
    const converse: ToolAgentConverse = async () => ({
      text: "오늘은 쉬는 게 좋겠어요.",
      stopReason: "end_turn",
      toolUses: [],
    });

    const outcome = await runToolAgent({
      feature: "test.agent",
      system: "sys",
      task: "plan",
      tools: tools(),
      converse,
    });

    expect(outcome.submitted).toBeNull();
    expect(outcome.exhausted).toBe(false);
    expect(outcome.finalText).toContain("쉬는");
    expect(outcome.iterations).toBe(1);
  });

  it("surfaces tool run failures as isError results", async () => {
    let turn = 0;
    const converse: ToolAgentConverse = async () => {
      turn += 1;
      if (turn === 1) {
        return {
          text: "",
          stopReason: "tool_use",
          toolUses: [
            {
              toolUseId: "u1",
              name: "lookup_emotional_guidance",
              input: {},
            },
          ],
        };
      }
      return {
        text: "",
        stopReason: "tool_use",
        toolUses: [
          {
            toolUseId: "u2",
            name: "submit_mission_plan",
            input: { scene: "rainy" },
          },
        ],
      };
    };

    const outcome = await runToolAgent({
      feature: "test.agent",
      system: "sys",
      task: "plan",
      tools: tools({
        lookup: async () => {
          throw new Error("store down");
        },
      }),
      converse,
    });

    expect(outcome.toolCalls[0]?.ok).toBe(false);
    expect(outcome.toolCalls[0]?.error).toContain("store down");
    expect(outcome.submitted?.scene).toBe("rainy");
  });
});
