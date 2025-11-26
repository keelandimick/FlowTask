import React, { useEffect, useRef } from 'react';

interface ContextMenuOption {
  label: string;
  icon: string;
  onClick: () => void;
  disabled?: boolean;
}

interface ContextMenuProps {
  x: number;
  y: number;
  options: ContextMenuOption[];
  onClose: () => void;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({ x, y, options, onClose }) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    // Add listeners with a small delay to avoid immediate closing
    setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }, 0);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  // Adjust position to keep menu on screen
  useEffect(() => {
    if (menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      let adjustedX = x;
      let adjustedY = y;

      // Adjust horizontal position if menu goes off right edge
      if (x + rect.width > viewportWidth) {
        adjustedX = viewportWidth - rect.width - 8;
      }

      // Adjust vertical position if menu goes off bottom edge
      if (y + rect.height > viewportHeight) {
        adjustedY = viewportHeight - rect.height - 8;
      }

      menuRef.current.style.left = `${adjustedX}px`;
      menuRef.current.style.top = `${adjustedY}px`;
    }
  }, [x, y]);

  return (
    <div
      ref={menuRef}
      className="fixed z-50 bg-white rounded-lg shadow-lg border border-gray-200 py-1 min-w-[180px]"
      style={{ left: x, top: y }}
    >
      {options.map((option, index) => (
        <button
          key={index}
          onClick={() => {
            if (!option.disabled) {
              option.onClick();
              onClose();
            }
          }}
          disabled={option.disabled}
          className={`w-full px-4 py-2 text-left text-sm flex items-center gap-3 transition-colors ${
            option.disabled
              ? 'text-gray-400 cursor-not-allowed'
              : 'text-gray-700 hover:bg-gray-100'
          }`}
        >
          <span className="text-base">{option.icon}</span>
          <span>{option.label}</span>
        </button>
      ))}
    </div>
  );
};
