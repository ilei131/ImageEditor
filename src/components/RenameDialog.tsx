import React, { useState, useEffect } from 'react';

interface RenameDialogProps {
  isOpen: boolean;
  fileName: string;
  onClose: () => void;
  onConfirm: (newName: string, overwrite: boolean) => void;
  targetExists?: boolean;
}

export const RenameDialog: React.FC<RenameDialogProps> = ({
  isOpen,
  fileName,
  onClose,
  onConfirm,
  targetExists = false
}) => {
  const [newName, setNewName] = useState(fileName);
  const [showOverwriteWarning, setShowOverwriteWarning] = useState(false);
  const [overwrite, setOverwrite] = useState(false);

  // 当对话框打开时，重置状态
  useEffect(() => {
    if (isOpen) {
      setNewName(fileName);
      setShowOverwriteWarning(false);
      setOverwrite(false);
    }
  }, [isOpen, fileName]);

  // 当targetExists变化时，更新覆盖警告状态
  useEffect(() => {
    setShowOverwriteWarning(targetExists);
  }, [targetExists]);

  if (!isOpen) return null;

  const handleSubmit = () => {
    if (newName.trim() && newName !== fileName) {
      onConfirm(newName.trim(), overwrite);
    } else {
      onClose();
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSubmit();
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <div className="rename-overlay">
      <div className="rename-dialog">
        <div className="rename-header">
          <h3>重命名</h3>
          <button className="rename-close" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="rename-content">
          <div className="rename-input-container">
            <label htmlFor="new-name">新名称:</label>
            <input
              type="text"
              id="new-name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyPress={handleKeyPress}
              autoFocus
              className="rename-input"
            />
          </div>

          {showOverwriteWarning && (
            <div className="rename-warning">
              <div className="warning-icon">⚠️</div>
              <div className="warning-text">
                <p>文件或文件夹 "{newName}" 已存在。</p>
                <p>是否覆盖它？</p>
              </div>
            </div>
          )}

          {showOverwriteWarning && (
            <div className="rename-overwrite-option">
              <input
                type="checkbox"
                id="overwrite"
                checked={overwrite}
                onChange={(e) => setOverwrite(e.target.checked)}
              />
              <label htmlFor="overwrite">覆盖现有文件/文件夹</label>
            </div>
          )}
        </div>
        <div className="rename-actions">
          <button className="rename-button cancel" onClick={onClose}>
            取消
          </button>
          <button
            className="rename-button confirm"
            onClick={handleSubmit}
            disabled={!newName.trim() || (newName === fileName)}
          >
            确认
          </button>
        </div>
      </div>
    </div>
  );
};
