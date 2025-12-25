import React from 'react';

interface CustomAlertProps {
  isOpen: boolean;
  message: string;
  onClose: () => void;
}

export const CustomAlert: React.FC<CustomAlertProps> = ({ isOpen, message, onClose }) => {
  if (!isOpen) return null;

  const handleOverlayClick = () => {
    onClose();
  };

  const handleAlertClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  return (
    <div className="custom-alert-overlay" onClick={handleOverlayClick}>
      <div className="custom-alert" onClick={handleAlertClick}>
        <div className="custom-alert-content">
          <p>{message}</p>
        </div>
        <div className="custom-alert-footer">
          <button className="custom-alert-button" onClick={onClose}>
            确定
          </button>
        </div>
      </div>
    </div>
  );
};


