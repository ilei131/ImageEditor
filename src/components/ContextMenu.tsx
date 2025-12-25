// 文件信息接口定义
export interface FileInfo {
  name: string;
  path: string;
  size: number;
  isDirectory: boolean;
  modifiedTime: number;
  // 为了兼容旧的属性名
  is_directory?: boolean;
  modified_time?: number;
  [key: string]: any;
}

// 右键菜单属性接口
export interface ContextMenuProps {
  visible: boolean;
  position: { x: number; y: number };
  fileInfo: FileInfo | null;
  onClose: () => void;
  onShowInExplorer: (fileInfo: FileInfo) => Promise<void>;
  onRename: (fileInfo: FileInfo) => Promise<void>;
  onCopy: (fileInfo: FileInfo) => void;
  onCut?: (fileInfo: FileInfo) => void;
  onPaste: () => void;
  onDelete: (fileInfo: FileInfo) => Promise<void>;
}

// 右键菜单组件
export function ContextMenu({ 
  visible, 
  position, 
  fileInfo, 
  onClose, 
  onShowInExplorer, 
  onRename, 
  onCopy, 
  onCut: _onCut, 
  onPaste, 
  onDelete 
}: ContextMenuProps) {
  if (!visible || !fileInfo) return null;

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999 }} onClick={onClose}>
      {/* 右键菜单 - 基于点击位置显示 */}
      <div 
        style={{
          position: 'fixed',
          // 确保位置不为0，如果为0则使用鼠标当前位置
          left: `${(position.x || 0) + 10}px`,
          top: `${(position.y || 0) + 10}px`,
          backgroundColor: 'white',
          border: '1px solid #ccc',
          borderRadius: '4px',
          boxShadow: '0 2px 10px rgba(0, 0, 0, 0.2)',
          padding: '4px 0',
          minWidth: '180px',
          zIndex: 10000,
          opacity: 1,
          visibility: 'visible',
          pointerEvents: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 粘贴选项 - 只有在没有选择文件时显示 */}
        {!fileInfo && (
          <div 
            style={{
              padding: '8px 16px',
              cursor: 'pointer',
              fontSize: '0.9rem',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
            onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.backgroundColor = '#f0f0f0'}
            onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'}
            onClick={() => {
              onPaste();
              onClose();
            }}
          >
            📌 粘贴
          </div>
        )}
        <div 
          style={{
            padding: '8px 16px',
            cursor: 'pointer',
            fontSize: '0.9rem',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
          onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.backgroundColor = '#f0f0f0'}
          onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'}
          onClick={() => {
            onShowInExplorer(fileInfo);
            onClose();
          }}
        >
          📁 在文件资源管理器中显示
        </div>
        <div 
          style={{
            padding: '8px 16px',
            cursor: 'pointer',
            fontSize: '0.9rem',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
          onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.backgroundColor = '#f0f0f0'}
          onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'}
          onClick={() => {
            onRename(fileInfo);
            onClose();
          }}
        >
          ✏️ 重命名
        </div>
        <div 
          style={{
            padding: '8px 16px',
            cursor: 'pointer',
            fontSize: '0.9rem',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
          onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.backgroundColor = '#f0f0f0'}
          onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'}
          onClick={() => {
            onCopy(fileInfo);
            onClose();
          }}
        >
          📋 复制
        </div>
        {/* <div 
          style={{
            padding: '8px 16px',
            cursor: 'pointer',
            fontSize: '0.9rem',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
          onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.backgroundColor = '#f0f0f0'}
          onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'}
          onClick={() => {
            onCut(fileInfo);
            onClose();
          }}
        >
          ✂️ 剪切
        </div> */}
        <div 
          style={{
            padding: '8px 16px',
            cursor: 'pointer',
            fontSize: '0.9rem',
            color: '#e74c3c',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
          onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.backgroundColor = '#ffebee'}
          onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'}
          onClick={() => {
            onDelete(fileInfo);
            onClose();
          }}
        >
          🗑️ 删除
        </div>
      </div>
      
      {/* 点击空白处关闭菜单 */}
      <div 
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        onClick={onClose}
      />
    </div>
  );
}
