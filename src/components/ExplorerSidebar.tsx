import { History, Globe } from "lucide-react";

interface ExplorerSidebarProps {
  explorerLogs: { query: string }[];
}

export const ExplorerSidebar = ({ explorerLogs }: ExplorerSidebarProps) => {
  return (
    <>
      <div className="mb-8">
        <h2 className="text-[10px] text-gray-500 uppercase tracking-[0.3em] font-bold mb-4 flex items-center gap-2 metallic-text">
          <History className="w-4 h-4" /> Research History
        </h2>
        <div className="space-y-3">
          {explorerLogs.slice(-5).reverse().map((log, i) => (
            <div key={i} className="glass-panel border-white/5 rounded-2xl p-3 text-[10px] text-gray-400 truncate hover:text-white hover:border-orange-500/30 cursor-pointer transition-all shadow-md">
              {log.query}
            </div>
          ))}
        </div>
      </div>
      <div className="mb-8 md:pb-0 pb-20">
        <h2 className="text-[10px] text-gray-500 uppercase tracking-[0.3em] font-bold mb-4 flex items-center gap-2 metallic-text">
          <Globe className="w-4 h-4" /> Active Sources
        </h2>
        <div className="glass-panel border-white/5 rounded-2xl p-4 text-[10px] space-y-3 shadow-lg">
          <div className="flex items-center gap-3 text-emerald-400 font-bold">
            <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
            Google Search
          </div>
          <div className="flex items-center gap-3 text-gray-500">
            <div className="w-2 h-2 rounded-full bg-gray-700" />
            Local File System
          </div>
          <div className="flex items-center gap-3 text-gray-500">
            <div className="w-2 h-2 rounded-full bg-gray-700" />
            External API Proxy
          </div>
        </div>
      </div>
    </>
  );
};
