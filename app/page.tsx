import Chat from "@/components/Chat";
import { ApplianceControl } from "@/components/ApplianceControl";
import { RightPanel } from "@/components/RightPanel";

export default function Home() {
  return (
    <div className="flex h-[calc(100vh-3.5rem)] divide-x">
      <aside className="w-[280px] flex-shrink-0 overflow-y-auto">
        <ApplianceControl />
      </aside>
      <main className="flex-1">
        <Chat />
      </main>
      <aside className="w-[320px] flex-shrink-0 overflow-y-auto border-l">
        <RightPanel />
      </aside>
    </div>
  );
}
