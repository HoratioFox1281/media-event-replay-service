import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { ZodError } from "zod";
import { InfraiControl, InfraiError } from "./infrai_control.js";
import { replayRequestSchema } from "./media_replay.js";
import { replayMediaWindow } from "./replay_coordinator.js";

const port = Number(process.env.PORT ?? 3000);

createServer(async (request, response) => {
  if (request.method !== "POST" || request.url !== "/replays") {
    return json(response, 404, { error: "Route not found" });
  }

  try {
    const apiKey = process.env.INFRAI_API_KEY;
    if (!apiKey) return json(response, 503, { error: "INFRAI_API_KEY is required" });

    const input = replayRequestSchema.parse(await readJson(request));
    const result = await replayMediaWindow(input, new InfraiControl(apiKey));
    return json(response, 200, result);
  } catch (error) {
    if (error instanceof ZodError) return json(response, 400, { error: "Invalid replay request", issues: error.issues });
    if (error instanceof SyntaxError) return json(response, 400, { error: "Request body must be valid JSON" });
    if (error instanceof InfraiError) {
      const status = error.status >= 400 && error.status < 500 ? error.status : 502;
      return json(response, status, { error: error.code, message: error.message });
    }
    return json(response, 502, { error: error instanceof Error ? error.message : "Replay failed" });
  }
}).listen(port, () => console.log(`Media replay service listening on http://localhost:${port}`));

async function readJson(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.from(chunk);
    size += buffer.length;
    if (size > 1_000_000) throw new Error("Request body is too large");
    chunks.push(buffer);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function json(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(body));
}
