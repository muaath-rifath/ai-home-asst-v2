import Chat from "@/components/Chat";
import { ApplianceControl } from "@/components/ApplianceControl";
import { RightPanel } from "@/components/RightPanel";
import { SwipeableContainer } from "@/components/SwipeableContainer";

export default function Home() {
  return (
    <>
      {/* Desktop Layout */}
      <div className="hidden lg:flex h-[calc(100vh-3.5rem)] divide-x">
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

      {/* Mobile/Tablet Layout */}
      <div className="lg:hidden">
        <SwipeableContainer
          leftPanel={<ApplianceControl />}
          mainContent={<Chat />}
          rightPanel={<RightPanel />}
        />
      </div>
    </>
  );
}
