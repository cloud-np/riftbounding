/**
 * Outstanding Task handler registry — rule 333.
 *
 * Module-level table of pure functions filled at import time. It holds no game state; the room
 * is always an argument. New task kinds register from `tasks/<domain>.ts`.
 */
import type { Room, Task, TaskKind } from "@rift/protocol";
import type { RulesStepContext } from "../../types";
import { keyedRegistry } from "../../registry-table";

export type TaskResult = "continue" | "await";

export interface TaskHandlerContext {
  room: Room;
  task: Task;
  step: RulesStepContext;
  playerId: string;
}

export type TaskHandler = (context: TaskHandlerContext) => TaskResult;

const TASK_HANDLERS: Partial<Record<TaskKind, TaskHandler>> = {};

/** G1: one handler per task kind; a second registration throws (tests: `src/testing.ts`). */
export const TASK_HANDLER_REGISTRY = keyedRegistry<TaskHandler>("task handler", TASK_HANDLERS as Record<string, TaskHandler>);

export function registerTaskHandler(kind: TaskKind, handler: TaskHandler): void {
  TASK_HANDLER_REGISTRY.register(kind, handler);
}

export function getTaskHandler(kind: TaskKind): TaskHandler | undefined {
  return TASK_HANDLERS[kind];
}

export function taskHandlerKinds(): TaskKind[] {
  return TASK_HANDLER_REGISTRY.keys() as TaskKind[];
}

export { TASK_HANDLERS };
