import "server-only";
import { randomUUID } from "node:crypto";
import { type BaseEvent, EventType } from "@ag-ui/client";
import {
  type AgentRunnerConnectRequest,
  InMemoryAgentRunner,
} from "@copilotkit/runtime/v2";
import { Observable, type Subscription } from "rxjs";
import { lissieHistory } from "./history";

/**
 * CopilotKit's in-memory runner, except that connecting to a thread with no live run
 * replays the conversation from Mastra memory. The in-memory runner forgets every thread
 * on restart; Mastra memory lives in SQLite and does not.
 * A connect during a run still goes to the in-memory runner, which holds the live stream.
 */
export class LissieRunner extends InMemoryAgentRunner {
  override connect(request: AgentRunnerConnectRequest): Observable<BaseEvent> {
    const { threadId } = request;
    const liveRun = () => super.connect(request);
    return new Observable<BaseEvent>((subscriber) => {
      let live: Subscription | undefined;
      (async () => {
        if (await this.isRunning({ threadId })) {
          live = liveRun().subscribe(subscriber);
          return;
        }
        const messages = await lissieHistory(threadId);
        if (messages.length > 0) {
          const runId = randomUUID();
          subscriber.next({ type: EventType.RUN_STARTED, threadId, runId });
          subscriber.next({ type: EventType.MESSAGES_SNAPSHOT, messages });
          subscriber.next({ type: EventType.RUN_FINISHED, threadId, runId });
        }
        subscriber.complete();
      })().catch((error: unknown) => subscriber.error(error));
      return () => live?.unsubscribe();
    });
  }
}
