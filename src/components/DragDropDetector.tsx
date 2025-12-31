import React, { useState, useRef, useEffect } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { listen, TauriEvent, UnlistenFn } from '@tauri-apps/api/event';
import { useI18n } from '../contexts/I18nContext';

interface DragDropEventPayload {
  paths: string[];
  position: { x: number; y: number };
}

interface DragDropDetectorProps {
  onImageDrop: (file: File | string) => void;
  onDragStateChange?: (isDragging: boolean) => void;
  disabled?: boolean;
}

const DragDropDetector: React.FC<DragDropDetectorProps> = ({ onImageDrop, onDragStateChange, disabled = false }) => {
  const { t } = useI18n();
  const [isDragging, setIsDragging] = useState(false);
  const detectorRef = useRef<HTMLDivElement>(null);
  
  // Refs for unlisten functions
  const dragEnterUnlistenRef = useRef<UnlistenFn | null>(null);
  const dragLeaveUnlistenRef = useRef<UnlistenFn | null>(null);
  const dragOverUnlistenRef = useRef<UnlistenFn | null>(null);
  const dragDropUnlistenRef = useRef<UnlistenFn | null>(null);

  // 使用Tauri 2的拖拽事件监听
  useEffect(() => {
    console.log("DragDropDetector: useEffect mounted");
    
    // 如果组件被禁用，不设置任何事件监听器
    if (disabled) {
      console.log("DragDropDetector: Component is disabled, skipping event listener setup");
      return;
    }
    
    // 设置拖拽事件监听器
    const setupDragListeners = async () => {
      // 监听拖拽开始事件
      dragEnterUnlistenRef.current = await listen(TauriEvent.DRAG_ENTER, () => {
        console.log("DragDropDetector: TauriEvent.DRAG_ENTER triggered");
        setIsDragging(true);
        if (onDragStateChange) {
          onDragStateChange(true);
        }
      });

      // 监听拖拽离开事件
      dragLeaveUnlistenRef.current = await listen(TauriEvent.DRAG_LEAVE, () => {
        console.log("DragDropDetector: TauriEvent.DRAG_LEAVE triggered");
        setIsDragging(false);
        if (onDragStateChange) {
          onDragStateChange(false);
        }
      });

      // 监听拖拽悬停事件
      dragOverUnlistenRef.current = await listen(TauriEvent.DRAG_OVER, () => {
        console.log("DragDropDetector: TauriEvent.DRAG_OVER triggered");
        // 可以在这里设置拖拽效果
      });

      // 监听拖拽完成事件
      dragDropUnlistenRef.current = await listen<DragDropEventPayload>(TauriEvent.DRAG_DROP, (event) => {
        console.log("DragDropDetector: TauriEvent.DRAG_DROP triggered");
        console.log("DragDropDetector: DragDropEventPayload:", event.payload);
        
        setIsDragging(false);
        if (onDragStateChange) {
          onDragStateChange(false);
        }

        // 获取拖拽的文件路径
        const { paths } = event.payload;
        if (paths && paths.length > 0) {
          const filePath = paths[0];
          console.log("Dropped file path:", filePath);
          
          // 检查文件扩展名
          const extension = filePath.split('.').pop()?.toLowerCase();
          const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'bmp'];
          
          if (extension && imageExtensions.includes(extension)) {
            // 将文件路径传递给父组件
            onImageDrop(filePath);
          } else {
            alert(t('dragDrop.error'));
          }
        }
      });
    };

    // 执行设置监听器函数
    setupDragListeners();

    // 处理点击选择文件
    const handleClick = async () => {
      console.log("DragDropDetector: handleClick triggered");
      try {
        const selected = await open({
          directory: false,
          multiple: false,
          filters: [
            { name: "Images", extensions: ["jpg", "jpeg", "png", "gif", "bmp"] }
          ],
          title: t('app.selectImage')
        });
        
        if (selected && typeof selected === "string") {
          // 直接将路径传递给父组件处理
          onImageDrop(selected);
        }
      } catch (error) {
        console.error("Failed to select image:", error);
      }
    };

    // 添加点击事件监听器
    const element = detectorRef.current;
    if (element) {
      element.addEventListener('click', handleClick);
    }

    // 清理事件监听器
    return () => {
      console.log("DragDropDetector: useEffect unmounted");
      if (dragEnterUnlistenRef.current) dragEnterUnlistenRef.current();
      if (dragLeaveUnlistenRef.current) dragLeaveUnlistenRef.current();
      if (dragOverUnlistenRef.current) dragOverUnlistenRef.current();
      if (dragDropUnlistenRef.current) dragDropUnlistenRef.current();
      if (element) {
        element.removeEventListener('click', handleClick);
      }
    };
  }, [onImageDrop, onDragStateChange, disabled]);


  return (
    <div
      ref={detectorRef}
      className={`drag-drop-detector ${isDragging ? 'dragging' : ''}`}
      // 移除React事件监听，使用原生DOM事件
    >
      <div className="drag-drop-content">
        <div className="drag-drop-icon">
          🌸
        </div>
        <h3>{t('dragDrop.title')}</h3>
        <p>{t('dragDrop.supported')}</p>
        <p className="drag-drop-hint">{t('dragDrop.hint')}</p>
      </div>
    </div>
  );
};

export default DragDropDetector;