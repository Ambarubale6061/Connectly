import React, { useEffect, useRef } from 'react';
import data from '@emoji-mart/data';
// FIXED: Removed curly braces around Picker
import Picker from '@emoji-mart/react';
import { motion } from 'framer-motion';

export default function EmojiPicker({ onSelect, onClose }) {
  const pickerRef = useRef(null);

  // Outside click logic
  useEffect(() => {
    function handleClickOutside(event) {
      if (pickerRef.current && !pickerRef.current.contains(event.target)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  return (
    <motion.div
      ref={pickerRef}
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 30 }}
      className="w-full h-full bg-white flex flex-col shadow-2xl rounded-t-[24px] overflow-hidden border-t border-gray-100"
    >
      {/* Handle */}
      <div className="w-full flex justify-center py-3 shrink-0">
        <div className="w-10 h-1 rounded-full bg-gray-200" />
      </div>

      <div className="flex-1 overflow-hidden emoji-custom-styles">
        <Picker
          data={data}
          onEmojiSelect={(emoji) => onSelect(emoji.native)}
          theme="light"
          set="native"
          icons="outline"
          navPosition="bottom"
          previewPosition="none"
          skinTonePosition="none"
          searchPosition="sticky"
          perLine={8}
          maxFrequentRows={1}
          emojiSize={22}
          emojiButtonSize={38}
        />
      </div>

      {/* Extreme Customization CSS */}
      <style>{`
        .emoji-custom-styles em-emoji-picker {
          width: 100% !important;
          height: 100% !important;
          border: none !important;
          --em-rgb-background: 255, 255, 255;
          --em-rgb-input: 243, 244, 246;
          --em-rgb-accent: 124, 58, 237;
          --em-font-family: inherit;
        }

        .emoji-custom-styles em-emoji-picker::part(search-input) {
          border-radius: 12px;
          border: 1px solid rgba(0,0,0,0.05);
          margin-bottom: 10px;
        }

        .emoji-custom-styles em-emoji-picker::part(nav) {
          border-top: 1px solid #f3f4f6;
          padding: 5px 0;
        }
      `}</style>
    </motion.div>
  );
}