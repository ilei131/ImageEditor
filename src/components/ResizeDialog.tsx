import React, { useState, useEffect } from 'react';
import './ResizeDialog.css';
import { useI18n } from '../contexts/I18nContext';

interface ResizeDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (width: number, height: number, maintainRatio: boolean) => void;
  currentWidth: number;
  currentHeight: number;
}

const ResizeDialog: React.FC<ResizeDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  currentWidth,
  currentHeight
}) => {
  const { t } = useI18n();
  const [width, setWidth] = useState(currentWidth);
  const [height, setHeight] = useState(currentHeight);
  const [maintainAspectRatio, setMaintainAspectRatio] = useState(true);
  const [originalAspectRatio, setOriginalAspectRatio] = useState(currentWidth / currentHeight);
  
  // 当currentWidth或currentHeight变化时，更新本地状态
  useEffect(() => {
    setWidth(currentWidth);
    setHeight(currentHeight);
    setOriginalAspectRatio(currentWidth / currentHeight);
  }, [currentWidth, currentHeight]);

  const handleWidthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newWidth = parseInt(e.target.value) || 0;
    setWidth(newWidth);
    
    if (maintainAspectRatio) {
      setHeight(Math.round(newWidth / originalAspectRatio));
    }
  };

  const handleHeightChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newHeight = parseInt(e.target.value) || 0;
    setHeight(newHeight);
    
    if (maintainAspectRatio) {
      setWidth(Math.round(newHeight * originalAspectRatio));
    }
  };

  const handleConfirm = () => {
    onConfirm(width, height, maintainAspectRatio);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="dialog-overlay">
      <div className="dialog">
        <div className="dialog-header">
          <h3>{t('resizeDialog.title')}</h3>
          <button className="close-button" onClick={onClose}>×</button>
        </div>
        
        <div className="dialog-body">
          <div className="size-inputs">
            <div className="input-group">
              <label>{t('resizeDialog.width')}</label>
              <input
                type="number"
                value={width}
                onChange={handleWidthChange}
                min="1"
              />
            </div>
            
            <div className="input-group">
              <label>{t('resizeDialog.height')}</label>
              <input
                type="number"
                value={height}
                onChange={handleHeightChange}
                min="1"
              />
            </div>
          </div>
          
          <div className="aspect-ratio-control">
            <label>
              <input
                type="checkbox"
                checked={maintainAspectRatio}
                onChange={(e) => setMaintainAspectRatio(e.target.checked)}
              />
              {t('resizeDialog.maintainRatio')}
            </label>
          </div>
        </div>
        
        <div className="dialog-footer">
          <button className="cancel-button" onClick={onClose}>
            {t('resizeDialog.cancel')}
          </button>
          <button className="confirm-button" onClick={handleConfirm}>
            {t('resizeDialog.confirm')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ResizeDialog;