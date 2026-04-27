import { Activity, Zap } from "lucide-react";

export const LiveSidebar = () => {
  return (
    <>
      <div className="mb-8">
        <h2 className="text-[10px] text-gray-500 uppercase tracking-[0.3em] font-bold mb-4 flex items-center gap-2 metallic-text">
          <Activity className="w-4 h-4" /> Session Telemetry
        </h2>
        <div className="glass-panel border-white/5 rounded-2xl p-4 text-[10px] space-y-4 shadow-lg">
          <div className="flex justify-between items-center">
            <span className="text-gray-500 font-medium">Latency:</span>
            <span className="text-emerald-400 font-mono font-bold">142ms</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-500 font-medium">Frame Rate:</span>
            <span className="text-blue-400 font-mono font-bold">2 FPS</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-500 font-medium">Bitrate:</span>
            <span className="text-purple-400 font-mono font-bold">1.2 Mbps</span>
          </div>
        </div>
      </div>
      <div className="mb-8 md:pb-0 pb-20">
        <h2 className="text-[10px] text-gray-500 uppercase tracking-[0.3em] font-bold mb-4 flex items-center gap-2 metallic-text">
          <Zap className="w-4 h-4" /> Tool Permissions
        </h2>
        <div className="space-y-3">
          {['Task Creation', 'Exploration', 'System Control'].map(tool => (
            <div key={tool} className="flex items-center justify-between glass-panel border-white/5 p-3 rounded-2xl text-[10px] shadow-md hover:border-white/10 transition-colors">
              <span className="text-gray-300 font-medium">{tool}</span>
              <div className="w-10 h-5 bg-emerald-500/10 border border-emerald-500/30 rounded-full flex items-center px-1">
                <div className="w-3 h-3 bg-emerald-500 rounded-full ml-auto shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
};
