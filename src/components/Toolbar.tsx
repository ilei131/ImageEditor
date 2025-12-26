import React, { useState, useEffect, useRef } from 'react';
import './Toolbar.css';
import { useI18n } from '../contexts/I18nContext';

interface ToolbarItem {
  id: string;
  label: string;
  icon?: string;
  children?: ToolbarItem[];
}

interface ToolbarProps {
  onToolSelect: (toolId: string) => void;
  disabled?: boolean;
}

const Toolbar: React.FC<ToolbarProps> = ({ onToolSelect, disabled = false }) => {
  const [openMenus, setOpenMenus] = useState<string[]>([]);
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  
  // 点击外部区域关闭菜单
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (toolbarRef.current && !toolbarRef.current.contains(event.target as Node)) {
        setOpenMenus([]);
      }
    };
    
    // 添加事件监听器
    document.addEventListener('mousedown', handleClickOutside);
    
    // 清理函数
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const { t, language, setLanguage } = useI18n();

  // 工具栏数据结构
  const toolbarItems: ToolbarItem[] = [
    {
      id: 'file',
      label: t('toolbar.file'),
      children: [
        { id: 'open', label: t('toolbar.file.open') },
        { id: 'save-as', label: t('toolbar.file.save-as') },
      ]
    },
    {
      id: 'edit',
      label: t('toolbar.edit'),
      children: [
        { id: 'resize', label: t('toolbar.edit.resize') },
        { id: 'toggle-crop', label: t('toolbar.edit.toggle-crop') },
        // { id: 'rotate', label: t('toolbar.edit.rotate') },
        // { id: 'flip', label: t('toolbar.edit.flip') },
      ]
    },
    {
      id: 'language',
      label: language === 'zh-CN' ? '中文' : 'English',
      children: [
        { id: 'zh-CN', label: '中文' },
        { id: 'en-US', label: 'English' },
      ]
    }
  ];

  const handleItemClick = (item: ToolbarItem) => {
    if (item.children) {
      // 切换子菜单的展开状态
      if (openMenus.includes(item.id)) {
        // 如果当前菜单已打开，则关闭它
        setOpenMenus(openMenus.filter(id => id !== item.id));
      } else {
        // 如果当前菜单未打开，则关闭所有其他菜单，然后打开它
        setOpenMenus([item.id]);
      }
    } else {
      // 处理语言切换
      if (item.id === 'zh-CN' || item.id === 'en-US') {
        setLanguage(item.id as 'zh-CN' | 'en-US');
      } else {
        // 执行工具选择回调
        onToolSelect(item.id);
      }
      // 关闭所有菜单
      setOpenMenus([]);
    }
  };

  const handleMouseEnter = (itemId: string) => {
    setHoveredItem(itemId);
    // 如果有父级菜单打开，则自动展开此菜单
    const parentMenu = toolbarItems.find(menu => 
      menu.children?.some(child => child.id === itemId)
    );
    if (parentMenu && !openMenus.includes(parentMenu.id)) {
      setOpenMenus([parentMenu.id]);
    }
  };

  const handleMouseLeave = () => {
    setHoveredItem(null);
  };

  const isMenuOpen = (menuId: string) => openMenus.includes(menuId);

  return (
    <div className="toolbar" ref={toolbarRef} onMouseLeave={handleMouseLeave}>
      <ul className="toolbar-menu">
        {toolbarItems.map((item) => (
          <li
            key={item.id}
            className={`toolbar-item ${isMenuOpen(item.id) ? 'open' : ''}`}
            onMouseEnter={() => handleMouseEnter(item.id)}
          >
            <button
              className="toolbar-button"
              onClick={() => handleItemClick(item)}
              disabled={disabled}
            >
              {item.label}
            </button>
            
            {item.children && isMenuOpen(item.id) && (
              <ul className="submenu">
                {item.children.map((child) => (
                  <li
                    key={child.id}
                    className={`submenu-item ${hoveredItem === child.id ? 'hovered' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleItemClick(child);
                    }}
                  >
                    <span className="submenu-label">{child.label}</span>
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default Toolbar;