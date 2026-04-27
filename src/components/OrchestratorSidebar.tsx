import { BarChart, Filter } from "lucide-react";
import { motion } from "motion/react";
import { Task } from "../types"; // Need to update types

interface OrchestratorSidebarProps {
  tasks: Task[];
}

export const OrchestratorSidebar = ({ tasks }: OrchestratorSidebarProps) => {
  return (
    <>
      <div className="mb-8">
        <h2 className="text-[10px] text-gray-500 uppercase tracking-[0.3em] font-bold mb-4 flex items-center gap-2 metallic-text">
          <BarChart className="w-4 h-4" /> Project Stats
        </h2>
        <div className="glass-panel border-white/5 rounded-2xl p-5 shadow-lg space-y-5">
          <div className="flex justify-between items-center text-[10px] uppercase tracking-widest font-bold">
            <span className="text-gray-500">Total Tasks</span>
            <span className="text-white">{tasks.length}</span>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between text-[9px] uppercase tracking-widest font-bold">
              <span className="text-emerald-400">Done</span>
              <span className="text-gray-400">{tasks.filter(t => t.status === 'done').length}</span>
            </div>
            <div className="w-full bg-black/60 h-2 rounded-full overflow-hidden border border-white/5">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${(tasks.filter(t => t.status === 'done').length / (tasks.length || 1)) * 100}%` }}
                className="bg-emerald-500 h-full shadow-[0_0_10px_rgba(16,185,129,0.5)]" 
              />
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between text-[9px] uppercase tracking-widest font-bold">
              <span className="text-blue-400">In Progress</span>
              <span className="text-gray-400">{tasks.filter(t => t.status === 'in-progress').length}</span>
            </div>
            <div className="w-full bg-black/60 h-2 rounded-full overflow-hidden border border-white/5">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${(tasks.filter(t => t.status === 'in-progress').length / (tasks.length || 1)) * 100}%` }}
                className="bg-blue-500 h-full shadow-[0_0_10px_rgba(59,130,246,0.5)]" 
              />
            </div>
          </div>
        </div>
      </div>
      <div className="mb-8 md:pb-0 pb-20">
        <h2 className="text-[10px] text-gray-500 uppercase tracking-[0.3em] font-bold mb-4 flex items-center gap-2 metallic-text">
          <Filter className="w-4 h-4" /> Priority View
        </h2>
        <div className="flex flex-col gap-3">
          {['high', 'medium', 'low'].map(p => (
            <div key={p} className="flex items-center justify-between glass-panel border-white/5 p-3 rounded-2xl text-[10px] shadow-md hover:border-white/10 transition-all">
              <span className={`uppercase tracking-widest font-bold ${p === 'high' ? 'text-red-400' : p === 'medium' ? 'text-orange-400' : 'text-blue-400'}`}>{p}</span>
              <span className="text-gray-500 font-mono">{tasks.filter(t => t.priority === p).length}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
};
