// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
use std::collections::HashMap;
use std::fs;
use std::io::Cursor;
use std::path::Path;
use std::sync::Arc;
use tokio::sync::RwLock;
use serde::{Deserialize, Serialize};

// 导入图片处理库
use image::io::Reader as ImageReader;
use image::{ GenericImageView };

// 定义图片信息结构体
#[derive(Serialize, Deserialize, Debug)]
pub struct ImageInfo {
    pub path: String,
    pub name: String,
    pub width: u32,
    pub height: u32,
    pub size: u64,
}

#[tauri::command]
fn list_images(path: &str) -> Result<Vec<ImageInfo>, String> {
    let path = Path::new(path);
    let mut images = Vec::new();
    
    // 读取目录
    let entries = fs::read_dir(path).map_err(|e| format!("Failed to read directory: {}", e))?;
    
    // 遍历目录内容
    for entry in entries {
        let entry = entry.map_err(|e| format!("Failed to read entry: {}", e))?;
        let path = entry.path();
        
        // 检查是否是文件
        if path.is_file() {
            // 获取文件扩展名
            if let Some(ext) = path.extension() {
                let ext = ext.to_str().unwrap_or("");
                // 检查是否是图片文件
                if ["jpg", "jpeg", "png", "gif", "bmp"].contains(&ext.to_lowercase().as_str()) {
                    // 获取文件元数据
                    let metadata = fs::metadata(&path).map_err(|e| format!("Failed to get metadata: {}", e))?;
                    let size = metadata.len();
                    
                    // 尝试读取图片尺寸
                    match ImageReader::open(&path) {
                        Ok(reader) => {
                            match reader.decode() {
                                Ok(image) => {
                                    let (width, height) = image.dimensions();
                                    let name = path.file_name().unwrap().to_str().unwrap().to_string();
                                    
                                    images.push(ImageInfo {
                                        path: path.to_str().unwrap().to_string(),
                                        name,
                                        width,
                                        height,
                                        size,
                                    });
                                },
                                Err(_) => continue, // 解码失败，跳过该文件
                            }
                        },
                        Err(_) => continue, // 打开失败，跳过该文件
                    }
                }
            }
        }
    }
    
    Ok(images)
}

#[tauri::command]
fn resize_image(path: &str, width: u32, height: u32) -> Result<bool, String> {
    // 打开图片
    let img = ImageReader::open(path)
        .map_err(|e| format!("Failed to open image: {}", e))?
        .decode()
        .map_err(|e| format!("Failed to decode image: {}", e))?;
    
    // 调整图片大小
    let resized = img.resize(width, height, image::imageops::FilterType::Triangle);
    
    // 保存图片
    resized.save(path)
        .map_err(|e| format!("Failed to save image: {}", e))?;
    
    Ok(true)
}

#[tauri::command]
fn resize_image_from_data(data: Vec<u8>, width: u32, height: u32) -> Result<Vec<u8>, String> {
    // 从数据中创建Cursor以模拟读取器
    let cursor = Cursor::new(data);
    
    // 打开图片
    let img = ImageReader::new(cursor)
        .with_guessed_format()
        .map_err(|e| format!("Failed to create image reader: {}", e))?
        .decode()
        .map_err(|e| format!("Failed to decode image: {}", e))?;
    
    // 调整图片大小
    let resized = img.resize(width, height, image::imageops::FilterType::Triangle);
    
    // 创建一个缓冲区来保存PNG数据
    let mut buffer = Cursor::new(Vec::new());
    
    // 将调整大小后的图片保存为PNG格式
    resized.write_to(&mut buffer, image::ImageFormat::Png)
        .map_err(|e| format!("Failed to encode image: {}", e))?;
    
    // 返回编码后的PNG数据
    Ok(buffer.into_inner())
}

// 获取图片信息
#[tauri::command]
fn get_image_info(path: &str) -> Result<ImageInfo, String> {
    let path_obj = Path::new(path);
    let file_name = path_obj.file_name().and_then(|n| n.to_str()).unwrap_or("").to_string();
    
    // 打开图片
    let img = ImageReader::open(path)
        .map_err(|e| format!("Failed to open image: {}", e))?
        .decode()
        .map_err(|e| format!("Failed to decode image: {}", e))?;
    
    let (width, height) = img.dimensions();
    let metadata = fs::metadata(path)
        .map_err(|e| format!("Failed to get metadata: {}", e))?;
    let size = metadata.len();
    
    Ok(ImageInfo {
        path: path.to_string(),
        name: file_name,
        width,
        height,
        size,
    })
}



// 裁剪图片
#[tauri::command]
fn crop_image(path: &str, x: f32, y: f32, width: f32, height: f32) -> Result<bool, String> {
    // 打开图片
    let img = ImageReader::open(path)
        .map_err(|e| format!("Failed to open image: {}", e))?
        .decode()
        .map_err(|e| format!("Failed to decode image: {}", e))?;
    
    let (original_width, original_height) = img.dimensions();
    
    // 计算实际裁剪坐标和尺寸（使用四舍五入确保更准确的裁剪范围）
    let crop_x = (x * original_width as f32 + 0.5) as u32;
    let crop_y = (y * original_height as f32 + 0.5) as u32;
    let crop_width = (width * original_width as f32 + 0.5) as u32;
    let crop_height = (height * original_height as f32 + 0.5) as u32;
    
    // 计算裁剪区域的右下角坐标
    let crop_right = crop_x + crop_width;
    let crop_bottom = crop_y + crop_height;
    
    // 确保裁剪区域在图片范围内（调整宽度和高度而不是坐标）
    let final_crop_width = if crop_right > original_width {
        original_width - crop_x
    } else {
        crop_width
    };
    let final_crop_height = if crop_bottom > original_height {
        original_height - crop_y
    } else {
        crop_height
    };
    
    // 裁剪图片
    let cropped = img.crop_imm(crop_x, crop_y, final_crop_width, final_crop_height);
    
    // 保存图片
    cropped.save(path)
        .map_err(|e| format!("Failed to save image: {}", e))?;
    
    Ok(true)
}
// 保存图片为不同格式
#[tauri::command]
fn save_as(path: &str, output: &str) -> Result<bool, String> {
    // 打开图片
    let img = ImageReader::open(path)
        .map_err(|e| format!("Failed to open image: {}", e))?
        .decode()
        .map_err(|e| format!("Failed to decode image: {}", e))?;
    
    // 获取输出文件的扩展名
    let output_path = Path::new(output);
    let ext = output_path.extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();
    
    // 检查是否是ICO格式，如果是则需要调整尺寸
    let processed_img = if ext == "ico" {
        let (width, height) = img.dimensions();
        
        // ICO格式要求宽度和高度都不超过256像素
        if width > 256 || height > 256 {
            // 计算新的尺寸，保持宽高比
            let scale_factor = if width > height {
                256.0 / width as f32
            } else {
                256.0 / height as f32
            };
            
            let new_width = (width as f32 * scale_factor).round() as u32;
            let new_height = (height as f32 * scale_factor).round() as u32;
            
            // 调整图片尺寸
            img.resize(new_width, new_height, image::imageops::FilterType::Triangle)
        } else {
            // 尺寸已经符合要求，直接使用原图
            img
        }
    } else {
        // 不是ICO格式，直接使用原图
        img
    };
    
    // 保存为目标格式
    processed_img.save(output)
        .map_err(|e| format!("Failed to save image: {}", e))?;
    
    Ok(true)
}

#[derive(Serialize, Deserialize, Debug)]
pub struct DiskInfo {
    pub drive: String,
    pub drive_type: String,
    pub total_space: u64,
    pub free_space: u64,
    pub used_space: u64,
}

// 磁盘大小信息结构体
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct DiskSizeInfo {
    pub drive: String,
    pub file_size: u64,
    pub last_modified: u64,
    pub last_scanned: u64,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct CachedFolderInfo {
    pub size: u64,
    pub last_modified: u64,
    pub last_scanned: u64,
}

// 定义全局缓存
lazy_static::lazy_static! {
    static ref DISK_SIZE_CACHE: Arc<RwLock<HashMap<String, DiskSizeInfo>>> = Arc::new(RwLock::new(HashMap::new()));
    static ref FOLDER_CACHE: Arc<RwLock<HashMap<String, CachedFolderInfo>>> = Arc::new(RwLock::new(HashMap::new()));
}

#[derive(Serialize, Deserialize, Debug)]
pub struct FileInfo {
    pub name: String,
    pub path: String,
    pub size: u64,
    pub is_directory: bool,
    pub modified_time: u64,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let context = tauri::generate_context!();
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init()) 
        .invoke_handler(tauri::generate_handler![
            list_images, 
            resize_image, 
            resize_image_from_data,
            get_image_info,
            crop_image,
            save_as
        ])
        .run(context)
        .expect("error while running tauri application");
}

