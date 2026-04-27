import { Maximize, ImageIcon } from "lucide-react";

export const MediaSidebar = () => {
  return (
    <>
      <div className="mb-8">
        <h2 className="text-[10px] text-gray-500 uppercase tracking-[0.3em] font-bold mb-4 flex items-center gap-2 metallic-text">
          <Maximize className="w-4 h-4" /> Studio Settings
        </h2>
        <div className="glass-panel border-white/5 rounded-2xl p-4 text-[10px] space-y-4 shadow-lg">
          <div>
            <label className="block text-gray-500 font-bold uppercase tracking-widest text-[8px] mb-2">Aspect Ratio</label>
            <select className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-gray-200 focus:outline-none focus:border-pink-500/50 transition-colors">
              <option>1:1 (Square)</option>
              <option>16:9 (Landscape)</option>
              <option>9:16 (Portrait)</option>
            </select>
          </div>
          <div>
            <label className="block text-gray-500 font-bold uppercase tracking-widest text-[8px] mb-2">Quality</label>
            <select className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-gray-200 focus:outline-none focus:border-pink-500/50 transition-colors">
              <option>Standard</option>
              <option>HD (1080p)</option>
              <option>Ultra (4K)</option>
            </select>
          </div>
        </div>
      </div>
      <div className="mb-8 md:pb-0 pb-20">
        <h2 className="text-[10px] text-gray-500 uppercase tracking-[0.3em] font-bold mb-4 flex items-center gap-2 metallic-text">
          <ImageIcon className="w-4 h-4" /> Gallery
        </h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="aspect-square glass-panel border-white/5 rounded-2xl flex items-center justify-center text-gray-700 hover:border-pink-500/30 transition-all cursor-pointer group shadow-md">
            <ImageIcon className="w-6 h-6 group-hover:text-pink-500/40 transition-colors" />
          </div>
          <div className="aspect-square glass-panel border-white/5 rounded-2xl flex items-center justify-center text-gray-700 hover:border-pink-500/30 transition-all cursor-pointer group shadow-md">
            <ImageIcon className="w-6 h-6 group-hover:text-pink-500/40 transition-colors" />
          </div>
        </div>
      </div>
    </>
  );
};
