import { useState } from "react";
import { Database, Settings, Cpu, Plus, Trash2 } from "lucide-react";
import { AgentStatus, MemoryResult } from "../types";
import { StatusIndicator } from "./StatusIndicator"; // Need to create this

interface AgentOSSidebarProps {
  activeMemories: MemoryResult[];
  currentDir: string;
  sandboxConfig: { image: string; network: string; volumes: string };
  setSandboxConfig: (config: any) => void;
  plannerStatus: AgentStatus;
  executorStatus: AgentStatus;
  reviewerStatus: AgentStatus;
  sandboxStatus: AgentStatus;
  envVars: Record<string, string>;
  setEnvVars: (vars: Record<string, string>) => void;
}

export const AgentOSSidebar = ({
  activeMemories,
  currentDir,
  sandboxConfig,
  setSandboxConfig,
  plannerStatus,
  executorStatus,
  reviewerStatus,
  sandboxStatus,
  envVars,
  setEnvVars,
}: AgentOSSidebarProps) => {
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");

  const addEnvVar = () => {
    if (newKey && newValue) {
      setEnvVars({ ...envVars, [newKey]: newValue });
      setNewKey("");
      setNewValue("");
    }
  };

  const removeEnvVar = (key: string) => {
    const newVars = { ...envVars };
    delete newVars[key];
    setEnvVars(newVars);
  };
  return (
    <>
      <div className="mb-8">
        <h2 className="text-[10px] text-gray-500 uppercase tracking-[0.3em] font-bold mb-4 flex items-center gap-2 metallic-text">
          <Database className="w-4 h-4" /> Memory Core
        </h2>
        <div className="glass-panel border-white/5 rounded-2xl p-4 text-[10px] text-gray-400 space-y-4 shadow-lg">
          <div className="flex justify-between items-center">
            <span className="text-gray-500 font-medium">Status:</span>
            <span className="text-emerald-400 font-bold">Online</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-500 font-medium">Vectors:</span>
            <span className="text-blue-400 font-mono">1,024</span>
          </div>
          {activeMemories.length > 0 && (
            <div className="pt-4 border-t border-white/5">
              <p className="text-gray-500 font-bold uppercase tracking-widest text-[8px] mb-3">Active Context:</p>
              <div className="space-y-2">
                {activeMemories.map(mem => (
                  <div key={mem.id} className="bg-black/40 p-3 rounded-xl border border-white/5 shadow-inner">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-emerald-400 text-[8px] font-bold uppercase tracking-widest">{mem.type}</span>
                      <span className="text-blue-400 text-[8px] font-mono">{(mem.confidence * 100).toFixed(0)}% Match</span>
                    </div>
                    <p className="text-gray-300 truncate text-[9px] leading-relaxed" title={mem.content}>{mem.key ? `${mem.key}: ` : ''}{mem.content}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="pt-4 border-t border-white/5">
            <span className="text-gray-500 font-bold uppercase tracking-widest text-[8px] block mb-2">CWD:</span>
            <span className="truncate block text-emerald-500 font-mono bg-black/40 p-2 rounded-lg border border-white/5">{currentDir}</span>
          </div>
        </div>
      </div>

      <div className="mb-8">
        <h2 className="text-[10px] text-gray-500 uppercase tracking-[0.3em] font-bold mb-4 flex items-center gap-2 metallic-text">
          <Settings className="w-4 h-4" /> Environment Variables
        </h2>
        <div className="glass-panel border-white/5 rounded-2xl p-4 flex flex-col gap-4 text-[10px] shadow-lg">
          <div className="space-y-2">
            {Object.entries(envVars).map(([key, value]) => (
              <div key={key} className="flex justify-between items-center bg-black/40 p-2 rounded-lg border border-white/5">
                <span className="text-emerald-400 font-mono">{key}</span>
                <span className="text-gray-300 truncate max-w-[80px]">{value}</span>
                <button onClick={() => removeEnvVar(key)} className="text-red-500 hover:text-red-400"><Trash2 className="w-3 h-3" /></button>
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-2 pt-2 border-t border-white/5">
            <input type="text" value={newKey} onChange={e => setNewKey(e.target.value)} placeholder="Key" className="bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-gray-200 focus:outline-none focus:border-blue-500/50" />
            <input type="text" value={newValue} onChange={e => setNewValue(e.target.value)} placeholder="Value" className="bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-gray-200 focus:outline-none focus:border-blue-500/50" />
            <button onClick={addEnvVar} className="flex items-center justify-center gap-2 bg-blue-500/20 text-blue-400 rounded-xl py-2 hover:bg-blue-500/30">
              <Plus className="w-3 h-3" /> Add Variable
            </button>
          </div>
        </div>
      </div>

      <div>
        <h2 className="text-[10px] text-gray-500 uppercase tracking-[0.3em] font-bold mb-4 flex items-center gap-2 metallic-text">
          <Cpu className="w-4 h-4" /> System Status
        </h2>
        <div className="space-y-3">
          <StatusIndicator label="Planner" status={plannerStatus} />
          <StatusIndicator label="Executor" status={executorStatus} />
          <StatusIndicator label="Reviewer" status={reviewerStatus} />
          <StatusIndicator label="Sandbox" status={sandboxStatus} />
        </div>
        <div className="mt-8 pt-4 border-t border-white/5">
          <iframe 
            {...({ allowtransparency: "true" } as any)}
            scrolling="no" 
            frameBorder="no" 
            src="https://w.soundcloud.com/icon/?url=http%3A%2F%2Fsoundcloud.com%2Fyfndlr37-riggs&color=white_transparent&size=16" 
            style={{ width: "16px", height: "16px" }}
          />
        </div>
      </div>
    </>
  );
};
