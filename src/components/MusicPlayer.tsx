import { useState } from "react";
import { Play, X, Music, Link as LinkIcon } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export const MusicPlayer = () => {
  const [url, setUrl] = useState("");
  const [embedUrl, setEmbedUrl] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const getEmbedUrl = (inputUrl: string, autoPlay: boolean = false) => {
    const suffix = autoPlay ? "&auto_play=true" : "";
    if (inputUrl.includes("youtube.com") || inputUrl.includes("youtu.be")) {
      const videoId = inputUrl.split("v=")[1]?.split("&")[0] || inputUrl.split("/").pop();
      return `https://www.youtube.com/embed/${videoId}?autoplay=${autoPlay ? 1 : 0}`;
    }
    if (inputUrl.includes("soundcloud.com")) {
      return `https://w.soundcloud.com/player/?url=${encodeURIComponent(inputUrl)}${suffix}`;
    }
    if (inputUrl.includes("spotify.com")) {
      return inputUrl.replace("open.spotify.com", "open.spotify.com/embed") + (autoPlay ? "?autoplay=1" : "");
    }
    return null;
  };

  const handlePlay = () => {
    const embed = getEmbedUrl(url, true);
    if (embed) {
      setEmbedUrl(embed);
    }
  };

  const handleOpenInBrowser = () => {
    window.open(url, "_blank");
  };

  return (
    <motion.div 
      drag 
      dragMomentum={false}
      className="fixed bottom-6 right-6 z-50 cursor-grab active:cursor-grabbing"
    >
      <motion.div
        initial={false}
        animate={{ opacity: isOpen ? 1 : 0, y: isOpen ? 0 : 20, scale: isOpen ? 1 : 0.9, display: isOpen ? 'block' : 'none' }}
        className="w-80 glass-panel border-white/10 rounded-3xl p-4 shadow-2xl mb-4"
      >
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Music className="w-4 h-4 text-pink-500" /> Streamer
          </h3>
          <button onClick={() => setIsOpen(false)} className="text-gray-500 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
        
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Paste URL (YT, SC, Spotify)"
            className="flex-1 bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-gray-200 focus:outline-none focus:border-pink-500/50"
          />
          <button onClick={handlePlay} className="p-2 bg-pink-500/20 text-pink-400 rounded-xl hover:bg-pink-500/30">
            <Play className="w-4 h-4" />
          </button>
          {url.includes("soundcloud.com") && (
            <button onClick={handleOpenInBrowser} className="p-2 bg-gray-500/20 text-gray-400 rounded-xl hover:bg-gray-500/30">
              <LinkIcon className="w-4 h-4" />
            </button>
          )}
        </div>

        {embedUrl && (
          <div className="aspect-video rounded-2xl overflow-hidden bg-black mb-4">
            <iframe
              src={embedUrl}
              width="100%"
              height="100%"
              frameBorder="0"
              allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
              allowFullScreen
            />
          </div>
        )}
        
        <div className="rounded-2xl overflow-hidden bg-black/40 border border-white/10">
          <iframe 
            width="100%" 
            height="300" 
            scrolling="no" 
            frameBorder="0" 
            allow="autoplay" 
            src="https://w.soundcloud.com/player/?url=https%3A//api.soundcloud.com/playlists/soundcloud%3Aplaylists%3A1810055392%3Fsecret_token%3Ds-HGkN2WINOW0&color=%231b120f&auto_play=true&hide_related=false&show_comments=true&show_user=true&show_reposts=false&show_teaser=true&visual=true"
          ></iframe>
        </div>
      </motion.div>

      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-12 h-12 rounded-full bg-pink-500/20 border border-pink-500/30 flex items-center justify-center text-pink-400 hover:bg-pink-500/30 transition-all shadow-lg"
      >
        <Music className="w-6 h-6" />
      </button>
    </motion.div>
  );
};
