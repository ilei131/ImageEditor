import { useState, useRef, useEffect } from "react";
import { invoke, convertFileSrc } from "@tauri-apps/api/core";
import { open, save, message } from "@tauri-apps/plugin-dialog";
import { readFile } from "@tauri-apps/plugin-fs";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { PhysicalPosition } from "@tauri-apps/api/window";
import { listen, emit } from "@tauri-apps/api/event";
import "./App.css";
import Toolbar from "./components/Toolbar";
import ResizeDialog from "./components/ResizeDialog";
import CropArea from "./components/CropArea";
import DragDropDetector from "./components/DragDropDetector";
import ImageDisplay from "./components/ImageDisplay";
import ColorDrawer from "./components/ColorDrawer";
import "./components/ImageDisplay.css";
import { useI18n } from "./contexts/I18nContext";

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

interface ColorItem {
  hex: string;
  percentage: number;
}

function App() {
  const { t } = useI18n();
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
  const colorPickerWindowRef = useRef<WebviewWindow | null>(null);
  const intervalIdRef = useRef<number | null>(null);
  const pickedColorRef = useRef("#000000");
  
  // 颜色提取相关状态
  const [isColorDrawerOpen, setIsColorDrawerOpen] = useState(false);
  const [colors, setColors] = useState<ColorItem[]>([]);
  const [isExtractingColors, setIsExtractingColors] = useState(false);
  
  // 移除全局拖拽事件监听，避免与DragDropDetector组件的事件冲突
  // 全局拖拽事件可能会阻止组件内部事件的正确触发
  useEffect(() => {
    // 我们不再需要全局拖拽事件监听，因为DragDropDetector组件会处理自己的拖拽事件
    return () => {
      // 确保没有残留的全局事件监听
    };
  }, []);

  // 组件挂载时清理任何残留的颜色拾取窗口
  useEffect(() => {
    const cleanupExistingWindow = async () => {
      try {
        const existingWindow = await WebviewWindow.getByLabel("color-picker");
        if (existingWindow) {
          console.log("发现残留的颜色拾取窗口，正在关闭...");
          await existingWindow.close();
        }
      } catch (error) {
        // 忽略错误，窗口可能不存在
      }
    };
    
    cleanupExistingWindow().catch(console.error);
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
        title: t('app.selectImage')
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
        title: t('app.saveAs'),
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

  // 生成icns
  const handleGenerateICNS = async () => {
    if (!selectedImage || !selectedImage.path) return;
    
    try {
      // 在打开保存窗口前检查图片分辨率
      if (selectedImage.width < 1024 || selectedImage.height < 1024) {
        // 显示分辨率不足的错误提示
        await message(
          `${t('icns.error.sizeTooSmall')} ${selectedImage.width}x${selectedImage.height}. ${t('icns.error.requiredSize')} 1024x1024.`,
          {
            title: t('icns.error.title'),
            kind: "error"
          }
        );
        return;
      }
      
      const defaultName = selectedImage.name.replace(/\.[^/.]+$/, ".icns");
      const savedPath = await save({
        filters: [
          { name: "ICNS", extensions: ["icns"] },
          { name: "All Files", extensions: ["*"] }
        ],
        title: t('app.generateICNS'),
        defaultPath: defaultName
      });
      
      if (savedPath) {
        console.log("savedPath:" + savedPath);
        setLoading(true);
        // 使用后端生成icns文件
        await invoke<boolean>("generate_icns", {
          path: selectedImage.path,
          output: savedPath
        });
        setLoading(false);
        // 显示成功提示
        await message(t('icns.success.message'), {
          title: t('icns.success.title'),
          kind: "info"
        });
      }
    } catch (error) {
      console.error("Failed to generate ICNS:", error);
      // 显示错误提示对话框
      await message(error instanceof Error ? error.message : String(error), {
        title: t('icns.error.title'),
        kind: "error"
      });
      setLoading(false);
    }
  };

  // 旋转图片
  const handleRotateImage = async () => {
    if (!selectedImage || !selectedImage.path) {
      console.error("No image path available for rotating");
      return;
    }

    try {
      setLoading(true);
      // 调用后端旋转图片
      await invoke<boolean>("rotate_image", {
        path: selectedImage.path
      });
      // 更新图片信息
      const updatedImageInfo = await invoke<ImageInfo>("get_image_info", {
        path: selectedImage.path
      });
      // 更新预览URL
      const buffer = await readFile(selectedImage.path);
      const blob = new Blob([buffer], { type: getImageMimeType(selectedImage.path) });
      setPreviewUrl(URL.createObjectURL(blob));
      setSelectedImage(updatedImageInfo);
      setLoading(false);
    } catch (error) {
      console.error("Failed to rotate image:", error);
      // 显示错误提示对话框
      await message(error instanceof Error ? error.message : String(error), {
        title: t('app.error.title'),
        kind: "error"
      });
      setLoading(false);
    }
  };

  // 提取图片颜色
  const handleExtractColors = async () => {
    if (!selectedImage || !selectedImage.path) {
      console.error("No image path available for extracting colors");
      return;
    }

    try {
      setIsExtractingColors(true);
      setIsColorDrawerOpen(true);
      
      // 调用后端颜色提取命令
      const extractedColors = await invoke<ColorItem[]>("extract_colors", {
        path: selectedImage.path
      });
      
      // 更新颜色列表
      setColors(extractedColors);
    } catch (error) {
      console.error("Failed to extract colors:", error);
      // 显示错误提示对话框
      await message(error instanceof Error ? error.message : String(error), {
        title: t('app.error.title'),
        kind: "error"
      });
    } finally {
      setIsExtractingColors(false);
    }
  };

  // 颜色拾取相关状态
  const [isColorPicking, setIsColorPicking] = useState(false);
  const [pickedColor, setPickedColor] = useState("#000000");

  // 统一的资源清理函数
  const cleanupColorPickerResources = () => {
    if (intervalIdRef.current) {
      clearInterval(intervalIdRef.current);
      intervalIdRef.current = null;
    }
    if (colorPickerWindowRef.current) {
      try {
        colorPickerWindowRef.current.close();
      } catch (error) {
      }
      colorPickerWindowRef.current = null;
    }
    setIsColorPicking(false);
  };

  // 处理颜色拾取
  const handleColorPick = async () => {
    console.log("尝试开始颜色拾取...");
    
    // 如果当前正在拾取，先清理资源
    if (isColorPicking) {
      console.log("当前正在颜色拾取中，先清理资源...");
      cleanupColorPickerResources();
    }
    
    // 确保资源已经清理完毕
    await new Promise(resolve => setTimeout(resolve, 100));
    
    if (!isColorPicking && !colorPickerWindowRef.current) {
      console.log("资源清理完毕，开始新的颜色拾取...");
      setIsColorPicking(true);
    } else {
      console.error("资源清理不完整，无法开始新的颜色拾取:", {
        isColorPicking,
        hasWindowRef: !!colorPickerWindowRef.current
      });
    }
  };

  // 复制颜色并退出拾取模式
  const copyColorAndExit = async () => {
    if (isColorPicking) {
      console.log("setIsColorPicking:", isColorPicking);
      setIsColorPicking(false);
      console.log("setIsColorPicking:", isColorPicking);
    }
    const colorToCopy = pickedColorRef.current;
    if (colorToCopy) {
      try {
        await navigator.clipboard.writeText(colorToCopy);
        console.log("Color copied to clipboard:", colorToCopy);
      } catch (error) {
        console.error("Failed to copy color:", error);
      }
      
      // 使用统一的清理函数
      cleanupColorPickerResources();
    }
  };

  // 停止颜色拾取
  const stopColorPicking = () => {
    setIsColorPicking(false);
  };

  // 定期更新鼠标位置和颜色
  useEffect(() => {
    if (!isColorPicking) {
      // 如果不是拾取模式，使用统一清理函数
      cleanupColorPickerResources();
      return;
    }
    
    // 创建颜色面板窗口
    const createColorPickerWindow = async () => {
      try {
        // 先获取初始鼠标位置和颜色
        const result = await invoke<{ x: number; y: number; color: string }>("get_mouse_position_and_color");
        console.log("获取鼠标位置和颜色成功:", result);
        setPickedColor(result.color);
        
        // 检查是否已有同名窗口存在，如果有则先关闭
        try {
          const existingWindow = await WebviewWindow.getByLabel("color-picker");
          if (existingWindow) {
            console.log("发现已存在的颜色拾取窗口，正在关闭...");
            await existingWindow.close();
          }
        } catch (error) {
          // 忽略检查和关闭错误
          console.log("检查或关闭已有窗口时出错:", error);
        }
        
        // 创建窗口
        console.log("开始创建颜色拾取窗口...");
        const win = new WebviewWindow("color-picker", {
          url: "/color-picker-window.html?color=" + encodeURIComponent(result.color),
          width: 150,
          height: 100,
          x: result.x - 75, // 窗口水平居中于鼠标指针下方
          y: result.y + 20, // 窗口在鼠标指针正下方显示
          resizable: false,
          decorations: false,
          alwaysOnTop: true,
          skipTaskbar: true,
        });
        
        console.log("颜色拾取窗口创建成功:", win);
        colorPickerWindowRef.current = win;
        
        // 监听窗口关闭事件
        win.once("tauri://destroyed", () => {
          console.log("颜色拾取窗口已关闭");
          // 使用统一的清理函数
          cleanupColorPickerResources();
        });
        
        // 监听窗口创建失败事件
        win.once("tauri://error", (error) => {
          console.error("颜色拾取窗口创建失败:", error);
          cleanupColorPickerResources();
        });
        
        // 监听停止颜色拾取事件
        await listen("stop-color-picking", () => {
          console.log("收到stop-color-picking事件，停止颜色拾取");
          stopColorPicking();
        });
        
        // 监听颜色选择事件
        await listen("color-picked", () => {
          cleanupColorPickerResources();
        });
        
        return win;
      } catch (error) {
        console.error("创建颜色拾取窗口过程中发生错误:", error);
        // 发生错误时清理资源
        cleanupColorPickerResources();
        // 重新抛出错误，让initColorPicker的catch捕获
        throw error;
      }
    };
    
    const updateColorPicker = async () => {
      try {
        const result = await invoke<{ x: number; y: number; color: string }>("get_mouse_position_and_color");
        console.log("result:", result.color);
        console.log("setPickedColor:", result.color);
        setPickedColor(result.color);
        if (pickedColorRef.current === result.color) {
          if (!colorPickerWindowRef.current) {
            cleanupColorPickerResources();
            console.log("return1");
            return;
          }
          
          try {
            await colorPickerWindowRef.current.setPosition(new PhysicalPosition(result.x - 75, result.y + 20)); // 窗口水平居中于鼠标指针下方
          } catch (positionError) {
            console.error("更新窗口位置失败:", positionError);
          }
          console.log("return2");
          return;
        }
        
        pickedColorRef.current = result.color;

        
        if (!colorPickerWindowRef.current) {
          cleanupColorPickerResources();
          return;
        }
        
        try {
          await colorPickerWindowRef.current.setPosition(new PhysicalPosition(result.x - 75, result.y + 20)); // 窗口水平居中于鼠标指针下方
        } catch (positionError) {
          console.error("更新窗口位置失败:", positionError);
        }
        
        try {
          const colorData = { color: result.color };
          console.log("颜色变化:", pickedColorRef.current, "->", result.color);
          await emit("update-color", colorData);
        } catch (emitError) {
          console.error("发送颜色更新失败:", emitError);
        }
      } catch (error) {
        console.error("更新鼠标位置和颜色失败:", error);
        cleanupColorPickerResources();
      }
    };

    // 初始化创建窗口并在成功后启动定时器
    const initColorPicker = async () => {
      try {
        const win = await createColorPickerWindow();
        
        if (win && colorPickerWindowRef.current === win) {
          // 使用定时器轮询鼠标位置和颜色
          intervalIdRef.current = window.setInterval(() => {
            if (isColorPicking) {
              updateColorPicker();
            } else {
              cleanupColorPickerResources();
            }
          }, 100);
          
          // 等待颜色窗口初始化完成
          await new Promise(resolve => setTimeout(resolve, 200));
          
          // 窗口创建后获取一次颜色
          if (isColorPicking) {
              updateColorPicker();
            } 
        } else {
          console.error("窗口创建失败或引用不一致，取消初始化");
          cleanupColorPickerResources();
        }
      } catch (error) {
        console.error("初始化颜色拾取失败:", error);
        setIsColorPicking(false);
      }
    };
    
    initColorPicker();

    // 添加点击事件监听，点击时复制颜色并退出拾取模式
    const handleClick = () => {
      copyColorAndExit();
    };

    document.addEventListener("click", handleClick);

    // 清理函数
    return () => {
      document.removeEventListener("click", handleClick);
      
      // 使用统一的清理函数
      cleanupColorPickerResources();
    };
  }, [isColorPicking]);

  // 处理工具选择
  const handleToolSelect = (toolId: string, event: React.MouseEvent) => {
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
      case 'generate-icns':
        // 生成icns功能
        if (selectedImage && selectedImage.path) {
          handleGenerateICNS();
        } else {
          console.error("No image path available for generating ICNS");
        }
        break;
      case 'rotate':
        // 旋转图片功能
        if (selectedImage && selectedImage.path) {
          handleRotateImage();
        } else {
          console.error("No image path available for rotating");
        }
        break;
      case 'extract-colors':
        // 提取颜色功能
        if (selectedImage && selectedImage.path) {
          handleExtractColors();
        } else {
          console.error("No image path available for extracting colors");
        }
        break;
      case 'pick-color':
        // 颜色拾取功能
        event.stopPropagation(); // 阻止事件冒泡
        handleColorPick();
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
                    {t('app.applyCrop')}
                  </button>
                  <button className="cancel-btn" onClick={() => {
                    setIsCropping(false);
                    setCropArea(null);
                  }} disabled={loading}>
                    {t('app.cancel')}
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
                  <h1 className="welcome-title">{t('app.hello')}</h1>
                  <div className="welcome-loader"></div>
                </div>
              </div>
            ) : !selectedImage ? (
              <div className="welcome-content">
                <h2>{t('app.welcome')}</h2>
                <DragDropDetector 
                      onImageDrop={handleDropFromDetector} 
                      onDragStateChange={setIsDraggingOver} 
                      disabled={isColorPicking} 
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
                      <div className="loading">{t('app.loading')}</div>
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
          
          {/* 颜色提取抽屉组件 */}
          <ColorDrawer
            isOpen={isColorDrawerOpen}
            onClose={() => setIsColorDrawerOpen(false)}
            colors={colors}
            loading={isExtractingColors}
          />
    </div>
  );
}

export default App;