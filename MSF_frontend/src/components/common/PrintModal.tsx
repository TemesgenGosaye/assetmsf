import React, { useEffect } from 'react';

interface PrintModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

export const PrintModal: React.FC<PrintModalProps> = ({ open, onClose, title, children }) => {
  useEffect(() => {
    if (open) {
      // delay to allow rendering
      const timer = setTimeout(() => {
        window.print();
        onClose();
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white bg-opacity-90 backdrop-blur-sm">
      <div className="max-w-4xl w-full p-6 overflow-auto border rounded-lg shadow-lg bg-background">
        {title && <h2 className="text-2xl font-bold mb-4">{title}</h2>}
        <div className="print-content">{children}</div>
      </div>
    </div>
  );
};
