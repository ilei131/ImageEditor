import React, { forwardRef, useState, useRef, useCallback, useEffect } from 'react';
import CropArea from './CropArea';

// 类型定义
interface ImageInfo {
  width: number;
  height: number;
}

interface CropAreaInfo {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface ImageDisplayProps {
  imageUrl: string;
  altText?: string;
  isDraggingOver?: boolean;
  imageInfo?: ImageInfo;
  isCropping?: boolean;
  onCropAreaChange?: (cropArea: CropAreaInfo) => void;
  onCropApply?: (cropArea: CropAreaInfo) => void;
  onCropCancel?: () => void;
}

const ImageDisplay = forwardRef<HTMLImageElement, ImageDisplayProps>(({ 
  imageUrl, 
  altText = '图片预览', 
  isDraggingOver = false,
  imageInfo,
  isCropping = false,
  onCropAreaChange,
  onCropApply,
  onCropCancel
}, ref) => {
  // 裁剪区域状态
  const [cropArea, setCropArea] = useState<CropAreaInfo | null>(null);
  
  // 图片引用
  const imageRef = ref as React.RefObject<HTMLImageElement>;
  const previewRef = useRef<HTMLDivElement>(null);
  
  // 监听裁剪模式变化，初始化或清除裁剪区域
  useEffect(() => {
    if (isCropping && imageInfo && imageRef.current) {
      // 初始化裁剪区域
      initializeCropArea();
    } else if (!isCropping) {
      // 清除裁剪区域
      setCropArea(null);
    }
  }, [isCropping, imageInfo]);
  
  // 初始化裁剪区域
  const initializeCropArea = useCallback(() => {
    if (!imageInfo || !imageRef.current) return;
    
    // 获取图片在预览区域中的实际显示尺寸
    const imageElement = imageRef.current;
    const displayedWidth = imageElement.clientWidth;
    const displayedHeight = imageElement.clientHeight;
    
    // 计算图片的宽高比
    const imageAspectRatio = imageInfo.width / imageInfo.height;
    const displayedAspectRatio = displayedWidth / displayedHeight;
    
    // 确定图片的实际显示尺寸（考虑object-fit: contain）
    let actualDisplayedWidth, actualDisplayedHeight;
    if (displayedAspectRatio > imageAspectRatio) {
      // 显示区域更宽，图片高度填满显示区域
      actualDisplayedHeight = displayedHeight;
      actualDisplayedWidth = displayedHeight * imageAspectRatio;
    } else {
      // 显示区域更高，图片宽度填满显示区域
      actualDisplayedWidth = displayedWidth;
      actualDisplayedHeight = displayedWidth / imageAspectRatio;
    }
    
    // 计算缩放比例 - 原图尺寸与实际显示尺寸的比例
    const scale = imageInfo.width / actualDisplayedWidth;
    
    // 设置一个居中显示的默认裁剪区域（基于实际显示的图片尺寸的50%，但添加最小和最大限制）
    const minDisplaySize = 100; // 最小显示尺寸（像素）
    const maxDisplaySize = Math.min(800, Math.min(actualDisplayedWidth, actualDisplayedHeight) * 0.8); // 最大显示尺寸
    
    // 计算默认显示尺寸，确保在合理范围内
    let defaultDisplayWidth = actualDisplayedWidth * 0.5;
    let defaultDisplayHeight = actualDisplayedHeight * 0.5;
    
    // 应用最小限制
    defaultDisplayWidth = Math.max(defaultDisplayWidth, minDisplaySize);
    defaultDisplayHeight = Math.max(defaultDisplayHeight, minDisplaySize);
    
    // 应用最大限制
    defaultDisplayWidth = Math.min(defaultDisplayWidth, maxDisplaySize, actualDisplayedWidth);
    defaultDisplayHeight = Math.min(defaultDisplayHeight, maxDisplaySize, actualDisplayedHeight);
    
    // 将显示尺寸转换为原图尺寸 - 使用相同的缩放比例保持宽高比
    const defaultWidth = defaultDisplayWidth * scale;
    const defaultHeight = defaultDisplayHeight * scale;
    
    // 计算居中位置（基于实际显示的图片尺寸）
    const defaultDisplayX = (actualDisplayedWidth - defaultDisplayWidth) / 2;
    const defaultDisplayY = (actualDisplayedHeight - defaultDisplayHeight) / 2;
    
    // 计算图片在显示容器中的偏移量（因为使用了object-fit: contain）
    const imageOffsetX = (displayedWidth - actualDisplayedWidth) / 2;
    const imageOffsetY = (displayedHeight - actualDisplayedHeight) / 2;
    
    // 将显示位置转换为原图位置（考虑图片在容器中的偏移）
    const defaultX = (imageOffsetX + defaultDisplayX) * scale;
    const defaultY = (imageOffsetY + defaultDisplayY) * scale;
    
    // 确保裁剪区域不会超出图片范围
    const finalX = Math.max(0, Math.min(defaultX, imageInfo.width - defaultWidth));
    const finalY = Math.max(0, Math.min(defaultY, imageInfo.height - defaultHeight));
    const finalWidth = Math.min(defaultWidth, imageInfo.width - finalX);
    const finalHeight = Math.min(defaultHeight, imageInfo.height - finalY);
    
    const newCropArea = {
      x: finalX,
      y: finalY,
      width: finalWidth,
      height: finalHeight
    };
    
    setCropArea(newCropArea);
    if (onCropAreaChange) {
      onCropAreaChange(newCropArea);
    }
  }, [imageInfo, onCropAreaChange]);
  
  // 处理裁剪区域变化
  const handleCropAreaChange = useCallback((newCropArea: CropAreaInfo) => {
    setCropArea(newCropArea);
    if (onCropAreaChange) {
      onCropAreaChange(newCropArea);
    }
  }, [onCropAreaChange]);
  
  return (
    <div className={`image-display ${isDraggingOver ? 'drag-over' : ''}`} ref={previewRef}>
      <img 
        ref={imageRef}
        src={imageUrl} 
        alt={altText} 
        className="displayed-image" 
      />
      
      {/* 裁剪区域 */}
      {isCropping && cropArea && imageInfo && (
        <CropArea
          cropArea={cropArea}
          selectedImage={imageInfo}
          onCropAreaChange={handleCropAreaChange}
          previewRef={previewRef}
          imageRef={imageRef}
        />
      )}
    </div>
  );
});

export default ImageDisplay;