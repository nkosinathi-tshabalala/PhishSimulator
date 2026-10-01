// Player page: email training, shown as an inbox

import { Inbox } from "lucide-react";
import { MessageText } from "./simulation/MessageText";
import { AttachmentChip, SenderLine, parseSender } from "./simulation/EmailParts";
import { SimulationShell, type MessageActions } from "./simulation/SimulationShell";
import type { MessageView } from "../../types/catch";

interface EmailSimulationProps {
  onBack: () => void;
  onNavigate: (page: string) => void;
}

/** Email training page. */
export function EmailSimulation({ onBack, onNavigate }: EmailSimulationProps) {
  return (
    <SimulationShell
      channel="EMAIL"
      title="Email Phishing Simulation"
      reportLabel="Report as Phishing"
      onBack={onBack}
      onNavigate={onNavigate}
      renderMessage={(scenario, actions) => <EmailView scenario={scenario} actions={actions} />}
    />
  );
}

/** A simple inbox: the message list on the left, the open email on the right. */
function EmailView({ scenario, actions }: { scenario: MessageView; actions?: MessageActions }) {
  const subject = scenario.subject || "(no subject)";

  return (
    <div className="h-full flex">
      <aside className="hidden lg:block w-72 border-r bg-black/10">
        <div className="p-3 border-b bg-muted/30 flex items-center gap-2 text-sm font-semibold">
          <Inbox className="w-4 h-4 text-sky-300" />
          Inbox
          <span className="ml-auto rounded-full bg-sky-500/20 px-2 text-xs text-sky-200">1</span>
        </div>
        <div className="p-4 border-b bg-sky-500/10 border-l-2 border-l-sky-400">
          <div className="flex items-center justify-between gap-2">
            <span className="font-semibold text-sm truncate">{parseSender(scenario.sender).name}</span>
            <span className="text-[10px] text-muted-foreground">now</span>
          </div>
          <div className="text-sm truncate">{subject}</div>
          <div className="text-xs text-muted-foreground truncate">{scenario.message.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")}</div>
        </div>
      </aside>

      <EmailReader scenario={scenario} actions={actions} />
    </div>
  );
}

/** The open email. Also used by the inbox triage challenge. */
export function EmailReader({ scenario, actions }: { scenario: MessageView; actions?: MessageActions }) {
  return (
    <section className="flex-1 flex flex-col min-w-0">
      <div className="px-6 pt-6 pb-4 border-b">
        <h3 className="text-xl font-semibold mb-4">{scenario.subject || "(no subject)"}</h3>
        <SenderLine sender={scenario.sender} />
      </div>
      <div className="flex-1 p-6 space-y-4">
        <div className="rounded-xl border border-border bg-card/70 p-6 shadow-sm">
          <MessageText text={scenario.message} onLinkClick={actions?.onLinkClick} />
        </div>
        {scenario.attachment && (
          <div>
            <div className="text-xs text-muted-foreground mb-2">1 attachment</div>
            <AttachmentChip name={scenario.attachment} onOpen={actions?.onOpenAttachment} />
          </div>
        )}
      </div>
    </section>
  );
}
