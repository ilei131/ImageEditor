import React from 'react';
import './ColorDrawer.css';

interface ColorItem {
  hex: string;
  percentage: number;
}

interface ColorDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  colors: ColorItem[];
  loading: boolean;
}

const ColorDrawer: React.FC<ColorDrawerProps> = ({ isOpen, onClose, colors, loading }) => {
  // 复制颜色值到剪贴板
  const copyColor = (hex: string) => {
    navigator.clipboard.writeText(hex)
      .then(() => {
        // 可以添加一个短暂的提示
        const colorBlock = document.querySelector(`[data-color="${hex}"]`);
        if (colorBlock) {
          const originalText = colorBlock.textContent;
          colorBlock.textContent = '已复制!';
          setTimeout(() => {
            colorBlock.textContent = originalText;
          }, 1000);
        }
      })
      .catch(err => {
        console.error('复制失败:', err);
      });
  };

  return (
    <div className={`color-drawer ${isOpen ? 'open' : ''}`}>
      <div className="color-drawer-overlay" onClick={onClose}></div>
      <div className="color-drawer-content">
        <div className="color-drawer-header">
          <h2>主要颜色</h2>
          <button className="color-drawer-close" onClick={onClose}>
            ✕
          </button>
        </div>
        
        <div className="color-drawer-body">
          {loading ? (
            <div className="color-drawer-loading">
              <p>提取颜色中...</p>
            </div>
          ) : (
            <ul className="color-list">
              {colors.map((color, index) => (
                <li key={index} className="color-item">
                  <div 
                    className="color-block"
                    style={{ backgroundColor: color.hex }}
                  ></div>
                  <div className="color-info">
                    <span 
                      className="color-hex"
                      data-color={color.hex}
                      onClick={() => copyColor(color.hex)}
                    >
                      {color.hex}
                    </span>
                    <span className="color-percentage">
                      {color.percentage.toFixed(1)}%
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

export default ColorDrawer;