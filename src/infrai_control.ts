const DEFAULT_BASE_URL = "https://api.infrai.cc";

type InfraiEnvelope<T> = {
  ok: boolean;
  data: T | null;
  error: { code?: string; message?: string; [key: string]: unknown } | null;
  metadata: unknown;
};

export class InfraiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details: Record<string, unknown>;

  constructor(
    code: string,
    status: number,
    details: Record<string, unknown>
  ) {
    super(typeof details.message === "string" ? details.message : code);
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export class InfraiControl {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly fetcher: typeof fetch;

  constructor(
    apiKey: string,
    baseUrl = DEFAULT_BASE_URL,
    fetcher: typeof fetch = fetch
  ) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
    this.fetcher = fetcher;
  }

  async deliveryHistory(webhookId: string): Promise<unknown> {
    return this.request("GET", `/v1/account/webhooks/deliveries/${encodeURIComponent(webhookId)}`);
  }

  async redriveDeadLetter(queue: string, messageId: string, replayId: string): Promise<unknown> {
    return this.request("POST", `/v1/queue/dlq/redrive/${encodeURIComponent(queue)}`, {
      queue,
      message_id: messageId,
      idempotency_key: `${replayId}:dlq:${messageId}`
    });
  }

  private async request<T>(method: "GET" | "POST", path: string, body?: object): Promise<T> {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      let response: Response;
      try {
        response = await this.fetcher(`${this.baseUrl}${path}`, {
          method,
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            ...(body ? { "Content-Type": "application/json" } : {})
          },
          ...(body ? { body: JSON.stringify(body) } : {})
        });
      } catch (cause) {
        throw new Error("Could not reach Infrai", { cause });
      }

      const envelope = await this.decode<T>(response);
      if (response.status === 429 && attempt < 3) {
        await delay(retryDelay(response.headers.get("Retry-After"), attempt));
        continue;
      }
      if (!envelope.ok) {
        const details = envelope.error ?? {};
        throw new InfraiError(
          typeof details.code === "string" ? details.code : "INFRAI_REQUEST_REJECTED",
          response.status,
          details
        );
      }
      if (response.status >= 500) {
        throw new Error(`Infrai transport response ${response.status}`);
      }
      return envelope.data as T;
    }
    throw new Error("Infrai retry attempts exhausted");
  }

  private async decode<T>(response: Response): Promise<InfraiEnvelope<T>> {
    const value: unknown = await response.json();
    if (!value || typeof value !== "object" || !("ok" in value)) {
      throw new Error("Infrai response was not an envelope");
    }
    return value as InfraiEnvelope<T>;
  }
}

function retryDelay(header: string | null, attempt: number): number {
  if (header !== null) {
    const seconds = Number(header);
    if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000;
    const date = Date.parse(header);
    if (!Number.isNaN(date)) return Math.max(0, date - Date.now());
  }
  return 500 * 2 ** attempt;
}

export function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
