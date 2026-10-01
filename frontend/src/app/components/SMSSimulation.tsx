// Player page: SMS training, shown on a phone

import { Smartphone } from "lucide-react";
import { MessageText } from "./simulation/MessageText";
import { SimulationShell, type MessageActions } from "./simulation/SimulationShell";
import type { MessageView } from "../../types/catch";

interface SMSSimulationProps {
  onBack: () => void;
  onNavigate: (page: string) => void;
}

/** SMS training page. */
export function SMSSimulation({ onBack, onNavigate }: SMSSimulationProps) {
  return (
    <SimulationShell
      channel="SMS"
      title="SMS Phishing Simulation"
      reportLabel="Report as Smishing"
      onBack={onBack}
      onNavigate={onNavigate}
      renderMessage={(scenario, actions) => <PhoneView scenario={scenario} actions={actions} />}
    />
  );
}

/** The text message shown on a phone screen. */
export function PhoneView({ scenario, actions }: { scenario: MessageView; actions?: MessageActions }) {
  return (
    <div className="h-full flex items-center justify-center p-6 bg-muted/20">
      <div className="w-full max-w-sm rounded-[2rem] border-4 border-slate-700 bg-background shadow-xl overflow-hidden">
        <div className="bg-slate-800 px-4 py-3 flex items-center gap-2">
          <Smartphone className="w-4 h-4 text-slate-300" />
          <div>
            <div className="text-sm font-semibold text-white">
              {scenario.sender || "Unknown number"}
            </div>
            <div className="text-[10px] text-slate-400">Text message</div>
          </div>
        </div>
        <div className="p-4 min-h-64">
          <div className="bg-muted rounded-2xl rounded-tl-none p-4 max-w-[90%]">
            <MessageText text={scenario.message} className="text-sm" onLinkClick={actions?.onLinkClick} />
            <div className="text-[10px] text-muted-foreground mt-2">now</div>
          </div>
        </div>
      </div>
    </div>
  );
}
