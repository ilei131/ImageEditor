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
}

const CropArea: React.FC<CropAreaProps> = ({ 
  cropArea, 
  selectedImage, 
  onCropAreaChange, 
  previewRef,
  imageRef
}) => {
  const [isResizing, setIsResizing] = useState(false);
  const [isMoving, setIsMoving] = useState(false);
  const [resizeHandle, setResizeHandle] = useState<'nw' | 'se' | null>(null);
  const [cropStart, setCropStart] = useState<{ x: number; y: number } | null>(null);
  const [initialCropArea, setInitialCropArea] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  
  const cropRef = useRef<HTMLDivElement>(null);
  
  // 计算裁剪区域的CSS样式（基于图片显示尺寸的百分比）
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
      // 容器更宽，图片高度填满容器
      actualDisplayedHeight = containerHeight;
      actualDisplayedWidth = containerHeight * imageAspectRatio;
    } else {
      // 容器更高，图片宽度填满容器
      actualDisplayedWidth = containerWidth;
      actualDisplayedHeight = containerWidth / imageAspectRatio;
    }
    
    // 计算图片在容器中的偏移量
    const imageOffsetX = (containerWidth - actualDisplayedWidth) / 2;
    const imageOffsetY = (containerHeight - actualDisplayedHeight) / 2;
    
    // 计算缩放比例 - 原图尺寸与实际显示尺寸的比例
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
    
    // 使用百分比设置裁剪区域样式，确保裁剪框始终显示在正确位置
    return {
      left: `${xPercent}%`,
      top: `${yPercent}%`,
      width: `${widthPercent}%`,
      height: `${heightPercent}%`
    };
  }, [cropArea, selectedImage, imageRef]);
  
  // 处理鼠标按下事件（开始移动或调整大小）
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!cropRef.current || !imageRef.current) return;
    
    const cropRect = cropRef.current.getBoundingClientRect();
    const imageRect = imageRef.current.getBoundingClientRect();
    
    // 计算图片的宽高比
    const imageAspectRatio = selectedImage.width / selectedImage.height;
    const containerAspectRatio = imageRect.width / imageRect.height;
    
    // 确定图片的实际显示尺寸（考虑object-fit: contain）
    let actualDisplayedWidth, actualDisplayedHeight;
    if (containerAspectRatio > imageAspectRatio) {
      // 容器更宽，图片高度填满容器
      actualDisplayedHeight = imageRect.height;
      actualDisplayedWidth = imageRect.height * imageAspectRatio;
    } else {
      // 容器更高，图片宽度填满容器
      actualDisplayedWidth = imageRect.width;
      actualDisplayedHeight = imageRect.width / imageAspectRatio;
    }
    
    // 计算图片在容器中的偏移量
    const imageOffsetX = (imageRect.width - actualDisplayedWidth) / 2;
    const imageOffsetY = (imageRect.height - actualDisplayedHeight) / 2;
    
    // 计算缩放比例 - 原图尺寸与实际显示尺寸的比例
    const scale = selectedImage.width / actualDisplayedWidth;
    
    // 计算鼠标相对于裁剪框的位置
    const relativeX = e.clientX - cropRect.left;
    const relativeY = e.clientY - cropRect.top;
    
    // 计算鼠标在图片上的绝对位置（考虑图片在容器中的偏移）
    const mouseX = (e.clientX - imageRect.left - imageOffsetX) * scale;
    const mouseY = (e.clientY - imageRect.top - imageOffsetY) * scale;
    
    // 定义手柄尺寸（容器像素）
    const handleSize = 15;
    
    // 保存初始状态
    setInitialCropArea(cropArea);
    
    // 检查是否点击在左上角手柄
    if (relativeX <= handleSize && relativeY <= handleSize) {
      setIsResizing(true);
      setResizeHandle('nw');
      setCropStart({ x: mouseX, y: mouseY });
      return;
    }
    
    // 检查是否点击在右下角手柄
    if (relativeX >= cropRect.width - handleSize && relativeY >= cropRect.height - handleSize) {
      setIsResizing(true);
      setResizeHandle('se');
      setCropStart({ x: mouseX, y: mouseY });
      return;
    }
    
    // 点击在裁剪框内部，设置为移动模式
    setIsMoving(true);
    setCropStart({ x: mouseX, y: mouseY });
  };
  
  // 使用ref来跟踪上一次处理鼠标移动的位置
  const lastProcessedPosition = useRef<{ x: number; y: number } | null>(null);

  // 处理鼠标移动事件（原生DOM事件）
  const handleMouseMoveNative = useCallback((e: MouseEvent) => {
    // 更新光标样式
    if (!cropRef.current || !imageRef.current || !previewRef.current) return;
    
    const imageRect = imageRef.current.getBoundingClientRect();
    
    // 计算图片的宽高比
    const imageAspectRatio = selectedImage.width / selectedImage.height;
    const containerAspectRatio = imageRect.width / imageRect.height;
    
    // 确定图片的实际显示尺寸（考虑object-fit: contain）
    let actualDisplayedWidth, actualDisplayedHeight;
    if (containerAspectRatio > imageAspectRatio) {
      // 容器更宽，图片高度填满容器
      actualDisplayedHeight = imageRect.height;
      actualDisplayedWidth = imageRect.height * imageAspectRatio;
    } else {
      // 容器更高，图片宽度填满容器
      actualDisplayedWidth = imageRect.width;
      actualDisplayedHeight = imageRect.width / imageAspectRatio;
    }
    
    // 计算图片在容器中的偏移量
    const imageOffsetX = (imageRect.width - actualDisplayedWidth) / 2;
    const imageOffsetY = (imageRect.height - actualDisplayedHeight) / 2;
    
    // 计算缩放比例 - 原图尺寸与实际显示尺寸的比例
    const scale = selectedImage.width / actualDisplayedWidth;
    
    // 计算鼠标在图片上的位置（考虑图片在容器中的偏移）
    const mouseX = (e.clientX - imageRect.left - imageOffsetX) * scale;
    const mouseY = (e.clientY - imageRect.top - imageOffsetY) * scale;
    
    // 更新光标样式
    const handleSize = 15;
    let cursorStyle = 'default';
    
    // 将手柄大小从显示尺寸转换为原图尺寸
    const handleSizeOriginal = handleSize * scale; // 因为scale = 原图宽度 / 显示宽度
    
    // 检查是否在左上角手柄上
    if (mouseX >= cropArea.x - handleSizeOriginal && 
        mouseX <= cropArea.x + handleSizeOriginal && 
        mouseY >= cropArea.y - handleSizeOriginal && 
        mouseY <= cropArea.y + handleSizeOriginal) {
      cursorStyle = 'nw-resize';
    }
    // 检查是否在右下角手柄上
    else if (mouseX >= cropArea.x + cropArea.width - handleSizeOriginal && 
             mouseX <= cropArea.x + cropArea.width + handleSizeOriginal && 
             mouseY >= cropArea.y + cropArea.height - handleSizeOriginal && 
             mouseY <= cropArea.y + cropArea.height + handleSizeOriginal) {
      cursorStyle = 'se-resize';
    }
    // 检查是否在裁剪区域内
    else if (mouseX >= cropArea.x && mouseX <= cropArea.x + cropArea.width && 
             mouseY >= cropArea.y && mouseY <= cropArea.y + cropArea.height) {
      cursorStyle = 'move';
    }
    
    previewRef.current.style.cursor = cursorStyle;
    
    // 处理移动和调整大小逻辑
    if ((!isResizing && !isMoving) || !cropStart || !initialCropArea) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    // 计算鼠标在图片上的当前位置（考虑图片在容器中的偏移）
    const currentMouseX = (e.clientX - imageRect.left - imageOffsetX) * scale;
    const currentMouseY = (e.clientY - imageRect.top - imageOffsetY) * scale;
    
    // 计算鼠标移动的距离
    const deltaX = currentMouseX - cropStart.x;
    const deltaY = currentMouseY - cropStart.y;
    
    if (isResizing && resizeHandle) {
      // 调整大小
      if (resizeHandle === 'nw') {
        // 左上角调整
        let newWidth = initialCropArea.width - deltaX;
        let newHeight = initialCropArea.height - deltaY;
        let newX = initialCropArea.x + deltaX;
        let newY = initialCropArea.y + deltaY;
        
        // 确保裁剪区域宽度和高度大于0
        if (newWidth < 10 || newHeight < 10) return;
        
        // 确保裁剪区域在图片范围内
        newX = Math.max(0, newX);
        newY = Math.max(0, newY);
        newWidth = Math.min(selectedImage.width - newX, newWidth);
        newHeight = Math.min(selectedImage.height - newY, newHeight);
        
        onCropAreaChange({ x: newX, y: newY, width: newWidth, height: newHeight });
      } else if (resizeHandle === 'se') {
        // 右下角调整
        let newWidth = initialCropArea.width + deltaX;
        let newHeight = initialCropArea.height + deltaY;
        
        // 确保裁剪区域宽度和高度大于0
        if (newWidth < 10 || newHeight < 10) return;
        
        // 确保裁剪区域在图片范围内
        newWidth = Math.min(selectedImage.width - initialCropArea.x, newWidth);
        newHeight = Math.min(selectedImage.height - initialCropArea.y, newHeight);
        
        onCropAreaChange({ 
          x: initialCropArea.x, 
          y: initialCropArea.y, 
          width: newWidth, 
          height: newHeight 
        });
      }
    } else if (isMoving) {
      // 移动裁剪区域
      let newX = initialCropArea.x + deltaX;
      let newY = initialCropArea.y + deltaY;
      
      // 确保裁剪区域在图片范围内
      const finalX = Math.max(0, Math.min(newX, selectedImage.width - initialCropArea.width));
      const finalY = Math.max(0, Math.min(newY, selectedImage.height - initialCropArea.height));
      
      onCropAreaChange({ ...initialCropArea, x: finalX, y: finalY });
    }
  }, [isMoving, isResizing, cropStart, initialCropArea, resizeHandle, cropArea, selectedImage, onCropAreaChange]);
  
  // 处理鼠标释放事件
  const handleMouseUp = () => {
    setIsMoving(false);
    setIsResizing(false);
    setResizeHandle(null);
    setCropStart(null);
    setInitialCropArea(null);
    // 重置最后处理的位置
    lastProcessedPosition.current = null;
  };
  
  // 添加全局事件监听以确保鼠标释放事件总是能被捕获
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      setIsMoving(false);
      setIsResizing(false);
      setResizeHandle(null);
      setCropStart(null);
      setInitialCropArea(null);
    };
    
    document.addEventListener('mouseup', handleGlobalMouseUp);
    document.addEventListener('mousemove', handleMouseMoveNative);
    
    return () => {
      document.removeEventListener('mouseup', handleGlobalMouseUp);
      document.removeEventListener('mousemove', handleMouseMoveNative);
    };
  }, [handleMouseMoveNative]);
  
  // 处理鼠标移动事件（React事件）
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    handleMouseMoveNative(e.nativeEvent);
  }, [handleMouseMoveNative]);
  
  return (
    <div 
      className="crop-area"
      ref={cropRef}
      style={cropStyle}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      <div className="crop-info">
        {Math.round(cropArea.width)} × {Math.round(cropArea.height)}
      </div>
      {/* 实际的DOM元素作为裁剪手柄 */}
      <div className="resize-handle resize-handle-nw" />
      <div className="resize-handle resize-handle-se" />
    </div>
  );
};

export default CropArea;