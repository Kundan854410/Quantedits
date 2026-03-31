"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { motion, AnimatePresence } from "framer-motion";
import { Film, Upload, Zap } from "lucide-react";

export type DroppedFile = {
  file: File;
  previewUrl: string;
  durationEstimate: string;
};

interface VideoDropZoneProps {
  onFileDrop: (dropped: DroppedFile) => void;
}

export default function VideoDropZone({ onFileDrop }: VideoDropZoneProps) {
  const [isDragActive, setIsDragActive] = useState(false);

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (!file) return;
      const previewUrl = URL.createObjectURL(file);
      // Estimate duration label based on file size (rough heuristic for demo)
      const sizeMB = file.size / (1024 * 1024);
      const durationEstimate =
        sizeMB > 500
          ? "~2 hr documentary"
          : sizeMB > 100
            ? "~30 min video"
            : "~5 min clip";
      onFileDrop({ file, previewUrl, durationEstimate });
    },
    [onFileDrop]
  );

  const { getRootProps, getInputProps } = useDropzone({
    onDrop,
    onDragEnter: () => setIsDragActive(true),
    onDragLeave: () => setIsDragActive(false),
    onDropAccepted: () => setIsDragActive(false),
    accept: { "video/*": [".mp4", ".mov", ".mkv", ".avi", ".webm"] },
    maxFiles: 1,
  });

  return (
    <div
      {...getRootProps()}
      className="relative flex flex-col items-center justify-center w-full h-full min-h-[320px] rounded-2xl border-2 border-dashed cursor-pointer select-none transition-all duration-300"
      style={{
        borderColor: isDragActive ? "#7C3AED" : "#2a2a3e",
        background: isDragActive
          ? "rgba(124,58,237,0.07)"
          : "rgba(19,19,26,0.6)",
      }}
    >
      <input {...getInputProps()} />

      <AnimatePresence mode="wait">
        {isDragActive ? (
          <motion.div
            key="drag-active"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="flex flex-col items-center gap-4"
          >
            <motion.div
              animate={{ y: [0, -10, 0] }}
              transition={{ repeat: Infinity, duration: 0.8 }}
            >
              <Zap size={52} className="text-purple-400" />
            </motion.div>
            <p className="text-purple-300 text-xl font-semibold tracking-wide">
              Release to process
            </p>
          </motion.div>
        ) : (
          <motion.div
            key="idle"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center gap-5 px-8 text-center"
          >
            {/* Animated film icon */}
            <motion.div
              whileHover={{ rotate: 5, scale: 1.05 }}
              className="relative"
            >
              <div className="absolute inset-0 rounded-full blur-xl bg-purple-700/30" />
              <Film size={56} className="relative text-purple-400" />
            </motion.div>

            <div>
              <p className="text-lg font-semibold text-[#E8E8F0] mb-1">
                Drop your raw video here
              </p>
              <p className="text-sm text-[#5a5a7a]">
                MP4 · MOV · MKV · AVI · WebM
              </p>
            </div>

            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium text-white"
              style={{
                background: "linear-gradient(135deg, #7C3AED 0%, #06B6D4 100%)",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <Upload size={15} />
              Browse Files
            </motion.button>

            <p className="text-xs text-[#3a3a5a]">
              Or drag & drop — AI processing starts instantly
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Corner grid dots for "After Effects" aesthetic */}
      {[
        "top-3 left-3",
        "top-3 right-3",
        "bottom-3 left-3",
        "bottom-3 right-3",
      ].map((pos) => (
        <span
          key={pos}
          className={`absolute ${pos} w-2 h-2 rounded-full bg-[#2a2a3e]`}
        />
      ))}
    </div>
  );
}
