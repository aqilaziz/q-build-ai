export type AgentName =
  | "Customer"
  | "Intake Agent"
  | "Repair Diagnosis Agent"
  | "Product RAG Agent"
  | "Quantity Tool Agent"
  | "Quotation Agent"
  | "Critic Agent"
  | "Audit Agent";

export type AgentMessage = {
  id: string;
  from: AgentName;
  to: AgentName;
  type: string;
  summary: string;
  payload?: unknown;
  createdAt: string;
};

export type AgentCommunicationLogEntry = Pick<
  AgentMessage,
  "from" | "to" | "type" | "summary"
>;

export class AgentChannel {
  private readonly messages: AgentMessage[] = [];

  send(message: Omit<AgentMessage, "id" | "createdAt">) {
    const item: AgentMessage = {
      ...message,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };

    this.messages.push(item);
    return item;
  }

  inbox(agent: AgentName) {
    return this.messages.filter((message) => message.to === agent);
  }

  latest(agent: AgentName, type?: string) {
    return [...this.inbox(agent)]
      .reverse()
      .find((message) => !type || message.type === type);
  }

  transcript() {
    return [...this.messages];
  }

  compactLog(): AgentCommunicationLogEntry[] {
    return this.messages.map(({ from, to, type, summary }) => ({
      from,
      to,
      type,
      summary,
    }));
  }
}

export function createAgentChannel() {
  return new AgentChannel();
}
