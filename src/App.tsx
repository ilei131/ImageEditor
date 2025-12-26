import { useState, useRef, useEffect } from "react";
import { invoke, convertFileSrc } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import { readFile } from "@tauri-apps/plugin-fs";
import "./App.css";
import Toolbar from "./components/Toolbar";
import ResizeDialog from "./components/ResizeDialog";
import CropArea from "./components/CropArea";
import DragDropDetector from "./components/DragDropDetector";
import ImageDisplay from "./components/ImageDisplay";
import "./components/ImageDisplay.css";

// 类型定义
interface ImageInfo {
  path?: string;
  name: string;
  width: number;
  height: number;
  size: number;
}

interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

function App() {
  const [selectedImage, setSelectedImage] = useState<ImageInfo | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [newWidth, setNewWidth] = useState<number>(0);
  const [newHeight, setNewHeight] = useState<number>(0);

  const [cropArea, setCropArea] = useState<CropArea | null>(null);
  const [isCropping, setIsCropping] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [showResizeDialog, setShowResizeDialog] = useState(false);
  const [isBooting] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  
  // 移除全局拖拽事件监听，避免与DragDropDetector组件的事件冲突
  // 全局拖拽事件可能会阻止组件内部事件的正确触发
  useEffect(() => {
    // 我们不再需要全局拖拽事件监听，因为DragDropDetector组件会处理自己的拖拽事件
    return () => {
      // 确保没有残留的全局事件监听
    };
  }, []);

  // // 启动页面过渡逻辑
  // useEffect(() => {
  //   // 设置启动页面显示时间（1秒）
  //   const timer = setTimeout(() => {
  //     setIsBooting(false);
  //   }, 100);

  //   return () => clearTimeout(timer);
  // }, []);
  


  // 加载图片（从文件路径）
  const loadImageFromPath = async (path: string) => {
    try {
      // 获取图片信息
      const result = await invoke<ImageInfo>("get_image_info", { path });
      setSelectedImage(result);
      setNewWidth(result.width);
      setNewHeight(result.height);
      
      // 读取图片文件并转换为DataURL
      const buffer = await readFile(path);
      const blob = new Blob([buffer], { type: getImageMimeType(path) });
      const url = URL.createObjectURL(blob);
      setPreviewUrl(url);
      setCropArea(null);
    } catch (error) {
      console.error("Failed to load image:", error);
    }
  };
  
  // 加载图片（从File对象）
  const loadImageFromFile = (file: File) => {
    try {
      console.log("Loading image from file:", file);
      // 创建Blob URL用于预览
      const url = URL.createObjectURL(file);
      console.log("Created blob URL:", url);
      
      // 直接设置图片信息，不等待Image.onload
      setSelectedImage({
        name: file.name,
        width: 0, // 初始值，会在Image.onload中更新
        height: 0, // 初始值，会在Image.onload中更新
        size: file.size
      });
      
      // 设置预览URL
      setPreviewUrl(url);
      
      // 创建Image对象获取实际尺寸
      const image = new Image();
      image.onload = () => {
        console.log("Image loaded, dimensions:", image.width, "x", image.height);
        setSelectedImage(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            width: image.width,
            height: image.height
          };
        });
        setNewWidth(image.width);
        setNewHeight(image.height);
        setCropArea(null);
      };
      image.onerror = (error) => {
        console.error("Image loading failed:", error);
        // 清除预览和选中的图片
        URL.revokeObjectURL(url);
        setPreviewUrl(null);
        setSelectedImage(null);
      };
      image.src = url;
    } catch (error) {
      console.error("Failed to load image from file:", error);
    }
  };

  // 选择单张图片（通过对话框）
  const handleSelectImage = async () => {
    try {
      const selected = await open({
        directory: false,
        multiple: false,
        filters: [
          { name: "Images", extensions: ["jpg", "jpeg", "png", "gif", "bmp"] }
        ],
        title: "选择图片"
      });
      
      if (selected && typeof selected === "string") {
        await loadImageFromPath(selected);
      }
    } catch (error) {
      console.error("Failed to select image:", error);
    }
  };

  // 处理拖拽事件 - 简化版本
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.classList.add('drag-over');
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.classList.remove('drag-over');
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    
    // 移除拖拽状态
    e.currentTarget.classList.remove('drag-over');
    
    // 获取拖拽的文件
    const files = Array.from(e.dataTransfer.files);
    
    if (files.length > 0) {
      const file = files[0];
      
      // 检查文件类型是否为图片
      if (file.type.startsWith('image/')) {
        // 使用File对象直接加载图片
        loadImageFromFile(file);
      }
    }
  };

  // 处理来自DragDropDetector的图片，支持File对象（拖拽）和字符串路径（点击）
  const handleDropFromDetector = async (fileOrPath: File | string) => {
    try {
      console.log("Received:", fileOrPath);
      if (fileOrPath instanceof File) {
        // 拖拽操作，接收File对象
        loadImageFromFile(fileOrPath);
      } else {
        // 点击操作，接收文件路径
        await loadImageFromPath(fileOrPath);
      }
    } catch (error) {
      console.error('加载图片失败:', error);
      alert('加载图片失败，请重试');
    }
  };
  
  // 获取图片MIME类型
  const getImageMimeType = (path: string): string => {
    const ext = path.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'png': return 'image/png';
      case 'gif': return 'image/gif';
      case 'bmp': return 'image/bmp';
      default: return 'image/jpeg';
    }
  };
  
  // 处理裁剪区域变化
  const handleCropAreaChange = (newCropArea: CropArea) => {
    setCropArea(newCropArea);
  };
  
  // 应用裁剪
  const handleApplyCrop = async () => {
    if (!selectedImage || !cropArea || !selectedImage.path) return;
    
    setLoading(true);
    try {
      // 计算裁剪区域的比例值（相对于原图大小）
      const x = cropArea.x / selectedImage.width;
      const y = cropArea.y / selectedImage.height;
      const width = cropArea.width / selectedImage.width;
      const height = cropArea.height / selectedImage.height;
      
      // 使用后端裁剪图片
      const result = await invoke<boolean>("crop_image", {
        path: selectedImage.path,
        x,
        y,
        width,
        height
      });
      
      if (result) {
        // 重新加载图片预览
        const buffer = await readFile(selectedImage.path);
        const blob = new Blob([buffer], { type: getImageMimeType(selectedImage.path) });
        const url = URL.createObjectURL(blob);
        setPreviewUrl(url);
        
        // 更新图片信息
        const updatedImage = await invoke<ImageInfo>("get_image_info", { path: selectedImage.path });
        setSelectedImage(updatedImage);
        setNewWidth(updatedImage.width);
        setNewHeight(updatedImage.height);
        
        // 清除裁剪区域并退出裁剪模式
        setCropArea(null);
        setIsCropping(false);
      }
    } catch (error) {
      console.error("Failed to crop image:", error);
    } finally {
      setLoading(false);
    }
  };
  
  // 调整图片分辨率
  const handleResizeConfirm = async (width: number, height: number) => {
    if (!selectedImage) return;
    
    setLoading(true);
    try {
      if (selectedImage.path) {
        // 有路径的图片，使用resize_image命令
        const result = await invoke<boolean>("resize_image", {
          path: selectedImage.path,
          width: width,
          height: height
        });
        
        if (result) {
          // 重新加载图片预览
          const buffer = await readFile(selectedImage.path);
          const blob = new Blob([buffer], { type: getImageMimeType(selectedImage.path) });
          const url = URL.createObjectURL(blob);
          setPreviewUrl(url);
          
          // 更新图片信息
          const updatedImage = await invoke<ImageInfo>("get_image_info", { path: selectedImage.path });
          setSelectedImage(updatedImage);
          setNewWidth(updatedImage.width);
          setNewHeight(updatedImage.height);
        }
      } else {
        // 没有路径的图片（如拖拽的图片），使用resize_image_from_data命令
        // 从previewUrl获取图片数据
        const response = await fetch(previewUrl || '');
        const blob = await response.blob();
        const arrayBuffer = await blob.arrayBuffer();
        const buffer = new Uint8Array(arrayBuffer);
        
        // 调用后端命令调整图片大小
        const resizedData = await invoke<Uint8Array>("resize_image_from_data", {
          data: Array.from(buffer),
          width: width,
          height: height
        });
        
        // 创建新的预览URL
        const resizedBlob = new Blob([resizedData], { type: 'image/png' });
        const newPreviewUrl = URL.createObjectURL(resizedBlob);
        
        // 更新预览和图片信息
        setPreviewUrl(newPreviewUrl);
        setSelectedImage({
          ...selectedImage,
          width: width,
          height: height
        });
        setNewWidth(width);
        setNewHeight(height);
      }
    } catch (error) {
      console.error("Failed to resize image:", error);
      alert("调整图片大小失败，请重试");
    } finally {
      setLoading(false);
    }
  };
  
  // 另存为
  const handleSaveAs = async () => {
    if (!selectedImage || !selectedImage.path) return;
    
    try {
      const defaultName = selectedImage.name.replace(/\.[^/.]+$/, ".png");
      const savedPath = await save({
        filters: [
          { name: "PNG", extensions: ["png"] },
          { name: "JPEG", extensions: ["jpg", "jpeg"] },
          { name: "ICO", extensions: ["ico"] },
          { name: "All Images", extensions: ["jpg", "jpeg", "png", "gif", "bmp", "ico"] }
        ],
        title: "另存为",
        defaultPath: defaultName
      });
      
      if (savedPath) {
        console.log("savedPath:" + savedPath);
        setLoading(true);
        // 使用后端保存图片为不同格式
        await invoke<boolean>("save_as", {
          path: selectedImage.path,
          output: savedPath
        });
        setLoading(false);
      }
    } catch (error) {
      console.error("Failed to save image:", error);
      setLoading(false);
    }
  };

  // 处理工具选择
  const handleToolSelect = (toolId: string) => {
    switch (toolId) {
      case 'open':
        handleSelectImage();
        break;
      case 'save-as':
        handleSaveAs();
        break;
      case 'resize':
        if (selectedImage && selectedImage.path) {
          setShowResizeDialog(true);
        } else {
          console.error("No image path available for resizing");
        }
        break;
      case 'toggle-crop':
        // 开启裁剪模式
        if (selectedImage) {
          setIsCropping(true);
        }
        break;
      // 其他工具可以在这里添加
      default:
        console.log(`Selected tool: ${toolId}`);
    }
  };



  return (
    <div className="app">
      <header className="app-header">
        {/* 工具栏组件移到这里 */}
        <Toolbar onToolSelect={handleToolSelect} disabled={loading} />
        <div className="header-buttons">
          {isCropping && (
            <>
              <button className="apply-btn" onClick={handleApplyCrop} disabled={loading}>
                应用裁剪
              </button>
              <button className="cancel-btn" onClick={() => {
                setIsCropping(false);
                setCropArea(null);
              }} disabled={loading}>
                取消
              </button>
            </>
          )}
        </div>
      </header>

      <main className="app-main">
        {isBooting ? (
          <div className="welcome-screen">
            <div className="welcome-container">
              <div className="welcome-icon">🌸</div>
              <h1 className="welcome-title">Hello</h1>
              <div className="welcome-loader"></div>
            </div>
          </div>
        ) : !selectedImage ? (
          <div className="welcome-content">
            <h2>欢迎使用</h2>
            <DragDropDetector 
                  onImageDrop={handleDropFromDetector} 
                  onDragStateChange={setIsDraggingOver} 
                />
          </div>
        ) : (
          <div className="image-container">
            
            {/* 分辨率调整对话框 */}
            <ResizeDialog
              isOpen={showResizeDialog}
              onClose={() => setShowResizeDialog(false)}
              onConfirm={handleResizeConfirm}
              currentWidth={newWidth}
              currentHeight={newHeight}
            />
            
            {/* 图片预览区域 */}
            <div className="image-preview-container">
              <div
                ref={previewRef}
                className={`preview-area ${isDraggingOver ? 'drag-over' : ''}`}
                onDragOver={handleDragOver}
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                {loading ? (
                  <div className="loading">处理中...</div>
                ) : (
                  <ImageDisplay
                    ref={imageRef}
                    imageUrl={previewUrl || (selectedImage.path ? convertFileSrc(selectedImage.path) : '')}
                    altText={selectedImage.name}
                    isDraggingOver={isDraggingOver}
                    imageInfo={selectedImage}
                    isCropping={isCropping}
                    onCropAreaChange={handleCropAreaChange}
                  />
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;