"use client";

import { motion } from "framer-motion";
import { Sparkles, Settings, Bell, ChevronDown } from "lucide-react";

export default function Topbar() {
  return (
    <header
      className="flex items-center px-5 shrink-0 h-12 select-none"
      style={{
        background: "#13131A",
        borderBottom: "1px solid #1E1E2E",
      }}
    >
      {/* Logo */}
      <div className="flex items-center gap-2 mr-8">
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center"
          style={{
            background: "linear-gradient(135deg, #7C3AED 0%, #06B6D4 100%)",
          }}
        >
          <Sparkles size={14} className="text-white" />
        </div>
        <span className="font-bold text-[#E8E8F0] text-sm tracking-wide">
          Quant<span className="text-purple-400">edits</span>
        </span>
        <span
          className="text-[10px] font-mono px-1.5 py-0.5 rounded ml-1"
          style={{ background: "#1E1E2E", color: "#5a5a7a" }}
        >
          v1.0
        </span>
      </div>

      {/* Workspace tabs */}
      <nav className="flex items-center gap-1">
        {["Canvas", "Assets", "Effects", "Export"].map((tab, i) => (
          <motion.button
            key={tab}
            whileHover={{ backgroundColor: "#1E1E2E" }}
            className="px-3 py-1 rounded text-xs font-medium transition-colors"
            style={{
              color: i === 0 ? "#E8E8F0" : "#5a5a7a",
              background: i === 0 ? "#1E1E2E" : "transparent",
            }}
          >
            {tab}
          </motion.button>
        ))}
      </nav>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Right section */}
      <div className="flex items-center gap-3">
        {/* Project name */}
        <button
          className="flex items-center gap-1.5 text-xs text-[#8888aa] hover:text-[#E8E8F0] transition-colors"
        >
          <span>Untitled Project</span>
          <ChevronDown size={12} />
        </button>

        <div className="w-px h-4 bg-[#1E1E2E]" />

        {/* Bell */}
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          className="w-7 h-7 rounded-lg flex items-center justify-center text-[#5a5a7a] hover:text-[#E8E8F0] transition-colors"
          style={{ background: "#1E1E2E" }}
        >
          <Bell size={14} />
        </motion.button>

        {/* Settings */}
        <motion.button
          whileHover={{ scale: 1.1, rotate: 20 }}
          whileTap={{ scale: 0.9 }}
          className="w-7 h-7 rounded-lg flex items-center justify-center text-[#5a5a7a] hover:text-[#E8E8F0] transition-colors"
          style={{ background: "#1E1E2E" }}
        >
          <Settings size={14} />
        </motion.button>

        {/* Avatar */}
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white"
          style={{
            background: "linear-gradient(135deg, #7C3AED 0%, #EC4899 100%)",
          }}
        >
          Q
        </div>
      </div>
    </header>
  );
}
