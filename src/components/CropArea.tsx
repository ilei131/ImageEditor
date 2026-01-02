import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';

interface CropAreaProps {
  cropArea: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  selectedImage: {
    width: number;
    height: number;
  };
  onCropAreaChange: (cropArea: { x: number; y: number; width: number; height: number }) => void;
  previewRef: React.RefObject<HTMLDivElement | null>;
  imageRef: React.RefObject<HTMLImageElement>;
  backgroundInfo?: {
    is_dark: boolean;
    brightness: number;
  } | null;
}

type ResizeHandle = 
  | 'nw' | 'n' | 'ne' 
  | 'w' | 'center' | 'e'
  | 'sw' | 's' | 'se';

const CropArea: React.FC<CropAreaProps> = ({ 
  cropArea, 
  selectedImage, 
  onCropAreaChange, 
  previewRef,
  imageRef,
  backgroundInfo
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [resizeHandle, setResizeHandle] = useState<ResizeHandle | null>(null);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [initialCropArea, setInitialCropArea] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [hoveredHandle, setHoveredHandle] = useState<ResizeHandle | null>(null);
  
  const cropRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLDivElement>(null);

  // 计算裁剪区域的CSS样式
  const cropStyle = useMemo(() => {
    if (!imageRef.current) return {};
    
    const imageElement = imageRef.current;
    const containerWidth = imageElement.clientWidth;
    const containerHeight = imageElement.clientHeight;
    
    // 计算图片的宽高比
    const imageAspectRatio = selectedImage.width / selectedImage.height;
    const containerAspectRatio = containerWidth / containerHeight;
    
    // 确定图片的实际显示尺寸（考虑object-fit: contain）
    let actualDisplayedWidth, actualDisplayedHeight;
    if (containerAspectRatio > imageAspectRatio) {
      actualDisplayedHeight = containerHeight;
      actualDisplayedWidth = containerHeight * imageAspectRatio;
    } else {
      actualDisplayedWidth = containerWidth;
      actualDisplayedHeight = containerWidth / imageAspectRatio;
    }
    
    // 计算图片在容器中的偏移量
    const imageOffsetX = (containerWidth - actualDisplayedWidth) / 2;
    const imageOffsetY = (containerHeight - actualDisplayedHeight) / 2;
    
    // 计算缩放比例
    const scale = selectedImage.width / actualDisplayedWidth;
    
    // 计算裁剪区域在实际显示尺寸中的位置和大小
    const cropDisplayedX = cropArea.x / scale;
    const cropDisplayedY = cropArea.y / scale;
    const cropDisplayedWidth = cropArea.width / scale;
    const cropDisplayedHeight = cropArea.height / scale;
    
    // 计算相对于容器的百分比
    const xPercent = ((imageOffsetX + cropDisplayedX) / containerWidth) * 100;
    const yPercent = ((imageOffsetY + cropDisplayedY) / containerHeight) * 100;
    const widthPercent = (cropDisplayedWidth / containerWidth) * 100;
    const heightPercent = (cropDisplayedHeight / containerHeight) * 100;
    
    // 根据背景亮度确定虚线颜色
    const borderColor = backgroundInfo?.is_dark 
      ? 'rgba(255, 255, 255, 0.9)'  // 深色背景用白色虚线
      : 'rgba(0, 0, 0, 0.8)';       // 浅色背景用黑色虚线

    return {
      left: `${xPercent}%`,
      top: `${yPercent}%`,
      width: `${widthPercent}%`,
      height: `${heightPercent}%`,
      border: `1px dashed ${borderColor}`,
      boxShadow: '0 0 0 1px rgba(0, 0, 0, 0.1)'
    };
  }, [cropArea, selectedImage, imageRef, backgroundInfo]);

  // 获取控制点的样式（尺寸和颜色等，不包含位置）
  const getHandleStyle = (handle: ResizeHandle) => {
    const baseSize = 8;
    const hoverSize = 12;
    const size = hoveredHandle === handle ? hoverSize : baseSize;
    
    return {
      width: `${size}px`,
      height: `${size}px`,
      backgroundColor: hoveredHandle === handle ? '#0051d5' : '#007aff',
      border: '2px solid white',
      borderRadius: '50%',
      cursor: getCursorStyle(handle),
      boxShadow: hoveredHandle === handle 
        ? '0 4px 12px rgba(0, 122, 255, 0.6), 0 0 0 1px rgba(0, 122, 255, 0.4)'
        : '0 2px 8px rgba(0, 122, 255, 0.4), 0 0 0 1px rgba(0, 122, 255, 0.3)',
      zIndex: 1000,
      transition: 'all 0.2s ease'
    };
  };

  // 获取光标样式
  const getCursorStyle = (handle: ResizeHandle): string => {
    const cursorMap: Record<ResizeHandle, string> = {
      'nw': 'nw-resize',
      'n': 'n-resize',
      'ne': 'ne-resize',
      'w': 'w-resize',
      'center': 'move',
      'e': 'e-resize',
      'sw': 'sw-resize',
      's': 's-resize',
      'se': 'se-resize'
    };
    return cursorMap[handle];
  };

  // 获取分辨率标签位置
  const getLabelPosition = (handle: ResizeHandle | null) => {
    if (!handle) {
      return {
        top: '-40px',
        left: '50%',
        transform: 'translateX(-50%)'
      };
    }
    
    const offset = 12; // 标签距离控制点的偏移量
    
    switch (handle) {
      case 'nw':
        return {
          top: `${offset}px`,
          left: `${offset}px`
        };
      case 'n':
        return {
          top: `${offset}px`,
          left: '50%',
          transform: 'translateX(-50%)'
        };
      case 'ne':
        return {
          top: `${offset}px`,
          right: `${offset}px`
        };
      case 'w':
        return {
          top: '50%',
          left: `${offset}px`,
          transform: 'translateY(-50%)'
        };
      case 'e':
        return {
          top: '50%',
          right: `${offset}px`,
          transform: 'translateY(-50%)'
        };
      case 'sw':
        return {
          bottom: `${offset}px`,
          left: `${offset}px`
        };
      case 's':
        return {
          bottom: `${offset}px`,
          left: '50%',
          transform: 'translateX(-50%)'
        };
      case 'se':
        return {
          bottom: `${offset}px`,
          right: `${offset}px`
        };
      default:
        return {
          top: '-40px',
          left: '50%',
          transform: 'translateX(-50%)'
        };
    }
  };

  // 检测点击在哪个控制点上
  const getHandleAtPosition = (clientX: number, clientY: number): ResizeHandle | null => {
    if (!cropRef.current || !imageRef.current) return null;
    
    const cropRect = cropRef.current.getBoundingClientRect();
    const imageRect = imageRef.current.getBoundingClientRect();
    
    // 计算图片的宽高比和显示尺寸
    const imageAspectRatio = selectedImage.width / selectedImage.height;
    const containerAspectRatio = imageRect.width / imageRect.height;
    
    let actualDisplayedWidth, actualDisplayedHeight;
    if (containerAspectRatio > imageAspectRatio) {
      actualDisplayedHeight = imageRect.height;
      actualDisplayedWidth = imageRect.height * imageAspectRatio;
    } else {
      actualDisplayedWidth = imageRect.width;
      actualDisplayedHeight = imageRect.width / imageAspectRatio;
    }
    
    const imageOffsetX = (imageRect.width - actualDisplayedWidth) / 2;
    const imageOffsetY = (imageRect.height - actualDisplayedHeight) / 2;
    const scale = selectedImage.width / actualDisplayedWidth;
    
    // 计算鼠标在图片上的位置
    const mouseX = (clientX - imageRect.left - imageOffsetX) * scale;
    const mouseY = (clientY - imageRect.top - imageOffsetY) * scale;
    
    // 检查是否在控制点上（增加检测范围）
    const handleSize = 20 * scale; // 检测范围
    const { x, y, width, height } = cropArea;
    
    // 角点检测
    if (mouseX >= x - handleSize && mouseX <= x + handleSize &&
        mouseY >= y - handleSize && mouseY <= y + handleSize) {
      return 'nw';
    }
    if (mouseX >= x + width - handleSize && mouseX <= x + width + handleSize &&
        mouseY >= y - handleSize && mouseY <= y + handleSize) {
      return 'ne';
    }
    if (mouseX >= x - handleSize && mouseX <= x + handleSize &&
        mouseY >= y + height - handleSize && mouseY <= y + height + handleSize) {
      return 'sw';
    }
    if (mouseX >= x + width - handleSize && mouseX <= x + width + handleSize &&
        mouseY >= y + height - handleSize && mouseY <= y + height + handleSize) {
      return 'se';
    }
    
    // 边点检测
    if (mouseY >= y - handleSize && mouseY <= y + handleSize &&
        mouseX >= x && mouseX <= x + width) {
      return 'n';
    }
    if (mouseY >= y + height - handleSize && mouseY <= y + height + handleSize &&
        mouseX >= x && mouseX <= x + width) {
      return 's';
    }
    if (mouseX >= x - handleSize && mouseX <= x + handleSize &&
        mouseY >= y && mouseY <= y + height) {
      return 'w';
    }
    if (mouseX >= x + width - handleSize && mouseX <= x + width + handleSize &&
        mouseY >= y && mouseY <= y + height) {
      return 'e';
    }
    
    // 检查是否在裁剪区域内（移动模式）
    if (mouseX >= x && mouseX <= x + width &&
        mouseY >= y && mouseY <= y + height) {
      return 'center';
    }
    
    return null;
  };

  // 处理鼠标按下事件
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    const handle = getHandleAtPosition(e.clientX, e.clientY);
    if (!handle) return;
    
    setIsDragging(true);
    setResizeHandle(handle);
    
    if (!imageRef.current) return;
    
    const imageRect = imageRef.current.getBoundingClientRect();
    const imageAspectRatio = selectedImage.width / selectedImage.height;
    const containerAspectRatio = imageRect.width / imageRect.height;
    
    let actualDisplayedWidth, actualDisplayedHeight;
    if (containerAspectRatio > imageAspectRatio) {
      actualDisplayedHeight = imageRect.height;
      actualDisplayedWidth = imageRect.height * imageAspectRatio;
    } else {
      actualDisplayedWidth = imageRect.width;
      actualDisplayedHeight = imageRect.width / imageAspectRatio;
    }
    
    const imageOffsetX = (imageRect.width - actualDisplayedWidth) / 2;
    const imageOffsetY = (imageRect.height - actualDisplayedHeight) / 2;
    const scale = selectedImage.width / actualDisplayedWidth;
    
    const mouseX = (e.clientX - imageRect.left - imageOffsetX) * scale;
    const mouseY = (e.clientY - imageRect.top - imageOffsetY) * scale;
    
    setDragStart({ x: mouseX, y: mouseY });
    setInitialCropArea(cropArea);
    
    // 更新光标
    if (previewRef.current) {
      previewRef.current.style.cursor = getCursorStyle(handle);
    }
  };

  // 处理鼠标移动事件
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!imageRef.current || !previewRef.current) return;
    
    if (!isDragging || !resizeHandle || !dragStart || !initialCropArea) {
      // 更新hover状态和光标
      const handle = getHandleAtPosition(e.clientX, e.clientY);
      setHoveredHandle(handle);
      
      if (previewRef.current) {
        previewRef.current.style.cursor = handle ? getCursorStyle(handle) : 'default';
      }
      return;
    }
    
    const imageRect = imageRef.current.getBoundingClientRect();
    const imageAspectRatio = selectedImage.width / selectedImage.height;
    const containerAspectRatio = imageRect.width / imageRect.height;
    
    let actualDisplayedWidth, actualDisplayedHeight;
    if (containerAspectRatio > imageAspectRatio) {
      actualDisplayedHeight = imageRect.height;
      actualDisplayedWidth = imageRect.height * imageAspectRatio;
    } else {
      actualDisplayedWidth = imageRect.width;
      actualDisplayedHeight = imageRect.width / imageAspectRatio;
    }
    
    const imageOffsetX = (imageRect.width - actualDisplayedWidth) / 2;
    const imageOffsetY = (imageRect.height - actualDisplayedHeight) / 2;
    const scale = selectedImage.width / actualDisplayedWidth;
    
    const currentMouseX = (e.clientX - imageRect.left - imageOffsetX) * scale;
    const currentMouseY = (e.clientY - imageRect.top - imageOffsetY) * scale;
    
    const deltaX = currentMouseX - dragStart.x;
    const deltaY = currentMouseY - dragStart.y;
    
    let newCropArea = { ...initialCropArea };
    
    // 根据控制点类型调整裁剪区域
    switch (resizeHandle) {
      case 'nw': // 左上角 - 同时调整宽高
        newCropArea.x = initialCropArea.x + deltaX;
        newCropArea.y = initialCropArea.y + deltaY;
        newCropArea.width = initialCropArea.width - deltaX;
        newCropArea.height = initialCropArea.height - deltaY;
        break;
        
      case 'ne': // 右上角 - 同时调整宽高
        newCropArea.y = initialCropArea.y + deltaY;
        newCropArea.width = initialCropArea.width + deltaX;
        newCropArea.height = initialCropArea.height - deltaY;
        break;
        
      case 'sw': // 左下角 - 同时调整宽高
        newCropArea.x = initialCropArea.x + deltaX;
        newCropArea.width = initialCropArea.width - deltaX;
        newCropArea.height = initialCropArea.height + deltaY;
        break;
        
      case 'se': // 右下角 - 同时调整宽高
        newCropArea.width = initialCropArea.width + deltaX;
        newCropArea.height = initialCropArea.height + deltaY;
        break;
        
      case 'n': // 上边 - 只调整高度
        newCropArea.y = initialCropArea.y + deltaY;
        newCropArea.height = initialCropArea.height - deltaY;
        break;
        
      case 's': // 下边 - 只调整高度
        newCropArea.height = initialCropArea.height + deltaY;
        break;
        
      case 'w': // 左边 - 只调整宽度
        newCropArea.x = initialCropArea.x + deltaX;
        newCropArea.width = initialCropArea.width - deltaX;
        break;
        
      case 'e': // 右边 - 只调整宽度
        newCropArea.width = initialCropArea.width + deltaX;
        break;
        
      case 'center': // 移动裁剪区域
        newCropArea.x = initialCropArea.x + deltaX;
        newCropArea.y = initialCropArea.y + deltaY;
        break;
    }
    
    // 确保裁剪区域不超出图片边界
    newCropArea.x = Math.max(0, Math.min(newCropArea.x, selectedImage.width - newCropArea.width));
    newCropArea.y = Math.max(0, Math.min(newCropArea.y, selectedImage.height - newCropArea.height));
    newCropArea.width = Math.min(newCropArea.width, selectedImage.width - newCropArea.x);
    newCropArea.height = Math.min(newCropArea.height, selectedImage.height - newCropArea.y);
    
    onCropAreaChange(newCropArea);
    
    e.preventDefault();
    e.stopPropagation();
  }, [isDragging, resizeHandle, dragStart, initialCropArea, selectedImage, onCropAreaChange]);

  // 处理鼠标释放事件
  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    setResizeHandle(null);
    setDragStart(null);
    setInitialCropArea(null);
    setHoveredHandle(null);
    
    if (previewRef.current) {
      previewRef.current.style.cursor = 'default';
    }
  }, [previewRef]);

  // 添加全局事件监听
  useEffect(() => {
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  return (
    <div 
      className="crop-area"
      ref={cropRef}
      style={cropStyle}
      onMouseDown={handleMouseDown}
    >
      {/* 实时尺寸显示标签 */}
      <div 
        ref={labelRef}
        className="crop-dimensions-label"
        style={{
          position: 'absolute',
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          color: 'white',
          padding: '4px 8px',
          borderRadius: '4px',
          fontSize: '12px',
          fontWeight: 'bold',
          whiteSpace: 'nowrap',
          zIndex: 1001,
          pointerEvents: 'none',
          visibility: isDragging && resizeHandle ? 'visible' : 'hidden',
          ...getLabelPosition(resizeHandle)
        }}
      >
        {Math.round(cropArea.width)} × {Math.round(cropArea.height)}
      </div>
      
      {/* 8个控制点 */}
      <div className="resize-handle resize-handle-nw" style={getHandleStyle('nw')} />
      <div className="resize-handle resize-handle-n" style={getHandleStyle('n')} />
      <div className="resize-handle resize-handle-ne" style={getHandleStyle('ne')} />
      <div className="resize-handle resize-handle-w" style={getHandleStyle('w')} />
      <div className="resize-handle resize-handle-e" style={getHandleStyle('e')} />
      <div className="resize-handle resize-handle-sw" style={getHandleStyle('sw')} />
      <div className="resize-handle resize-handle-s" style={getHandleStyle('s')} />
      <div className="resize-handle resize-handle-se" style={getHandleStyle('se')} />
    </div>
  );
};

export default CropArea;