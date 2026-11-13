import React from 'react';
import { motion } from 'framer-motion';
import logoImage from '../assets/logos/clustr-network-logo.png';

export default function Logo({
  className = '',
  withWordmark = true,
  wordmark = 'Clustr',
  wordmarkClassName = '',
  darkMode = false,
}) {
  const safeClassName = typeof className === 'string' ? className : '';
  const safeWordmarkClassName =
    typeof wordmarkClassName === 'string' ? wordmarkClassName : '';
  const safeWordmark =
    typeof wordmark === 'string' || typeof wordmark === 'number'
      ? wordmark
      : 'Clustr';

  return (
    <div className={`flex items-center gap-0 ${safeClassName}`}>
      <motion.span
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
        className="flex h-full shrink-0 items-center justify-center px-2">
        <img
          src={logoImage}
          alt="Clustr"
          className="h-full w-auto shrink-0 object-contain"
        />
      </motion.span>

      {withWordmark && (
        <motion.span
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className={`whitespace-nowrap text-[20px] font-black leading-none tracking-tight transition-colors duration-300 ${
            darkMode ? 'text-[#eef2ff]' : 'text-[#1a1f45]'
          } ${safeWordmarkClassName}`}
        >
          {safeWordmark}
        </motion.span>
      )}
    </div>
  );
}
