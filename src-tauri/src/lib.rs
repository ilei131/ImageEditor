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
use image::{ GenericImageView, Pixel };
// 导入ICNS处理库
use icns::{ IconFamily, PixelFormat }; // 更新导入，移除未使用的Image类型

// 定义图片信息结构体
#[derive(Serialize, Deserialize, Debug)]
pub struct ImageInfo {
    pub path: String,
    pub name: String,
    pub width: u32,
    pub height: u32,
    pub size: u64,
}

// 定义颜色项结构体
#[derive(Serialize, Deserialize, Debug)]
pub struct ColorItem {
    pub hex: String,
    pub percentage: f32,
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

// 生成ICNS格式图片集
#[tauri::command]
fn generate_icns(path: &str, output: &str) -> Result<bool, String> {
    // 打开图片
    let img = ImageReader::open(path)
        .map_err(|e| format!("Failed to open image: {}", e))?
        .decode()
        .map_err(|e| format!("Failed to decode image: {}", e))?;
    
    // 获取图片原始尺寸
    let (width, height) = img.dimensions();
    // 校验图片尺寸是否满足最小要求（1024x1024）
    if width < 1024 || height < 1024 {
        return Err(format!("Image size too small. Required at least 1024x1024, but got {}x{}", width, height));
    }
    
    // 创建ICNS图标家族
    let mut family = IconFamily::new();
    
    // 需要生成的图标尺寸
    let sizes = [16, 32, 64, 128, 256, 512, 1024];
    
    // 为每个尺寸生成图标并添加到家族中
    for size in sizes {
        // 调整图片尺寸
        let resized = img.resize(size, size, image::imageops::FilterType::Triangle);
        
        // 将图片转换为RGBA格式（ICNS需要）
        let rgba = resized.to_rgba8();
        let pixels = rgba.into_raw();
        
        // 创建icns::Image对象（使用icns库的from_data函数）
        let icns_image = icns::Image::from_data(PixelFormat::RGBA, size, size, pixels)
            .map_err(|e| format!("Failed to create ICNS image for size {}x{}: {:?}", size, size, e))?;
        
        // 将图片添加到ICNS家族
        family.add_icon(&icns_image)
            .map_err(|e| format!("Failed to add icon of size {}x{}: {:?}", size, size, e))?;
    }
    
    // 创建输出文件
    let mut file = std::fs::File::create(output)
        .map_err(|e| format!("Failed to create output file: {}", e))?;
    
    // 将ICNS家族写入文件
    family.write(&mut file)
        .map_err(|e| format!("Failed to write ICNS file: {}", e))?;
    
    Ok(true)
}

// 旋转图片（顺时针90度）
#[tauri::command]
fn rotate_image(path: &str) -> Result<bool, String> {
    // 打开图片
    let img = ImageReader::open(path)
        .map_err(|e| format!("Failed to open image: {}", e))?
        .decode()
        .map_err(|e| format!("Failed to decode image: {}", e))?;
    
    // 顺时针旋转90度
    let rotated = img.rotate90();
    
    // 保存图片
    rotated.save(path)
        .map_err(|e| format!("Failed to save image: {}", e))?;
    
    Ok(true)
}

// 辅助函数：将十六进制颜色字符串转换为RGB值
fn hex_to_rgb(hex: &str) -> Option<(u8, u8, u8)> {
    let hex = hex.trim_start_matches('#');
    if hex.len() != 6 {
        return None;
    }
    
    let r = u8::from_str_radix(&hex[0..2], 16).ok()?;
    let g = u8::from_str_radix(&hex[2..4], 16).ok()?;
    let b = u8::from_str_radix(&hex[4..6], 16).ok()?;
    
    Some((r, g, b))
}

// 获取鼠标位置和屏幕颜色
#[tauri::command]
fn get_mouse_position_and_color() -> Result<HashMap<String, serde_json::Value>, String> {
    #[cfg(target_os = "windows")]
    {
        // Windows 实现 - 使用Windows API获取鼠标位置和屏幕颜色
        unsafe {
            use winapi::shared::windef::{HWND, POINT};
            use winapi::um::winuser::{GetCursorPos, GetDC, ReleaseDC};
            use winapi::um::wingdi::GetPixel;
            
            let mut point: POINT = std::mem::zeroed();
            
            // 获取鼠标位置
            if GetCursorPos(&mut point) == 0 {
                return Err("Failed to get cursor position".to_string());
            }
            
            // 获取屏幕DC (NULL表示整个屏幕)
            let hdc: HWND = std::ptr::null_mut();
            let screen_dc = GetDC(std::ptr::null_mut());
            if screen_dc.is_null() {
                return Err("Failed to get screen DC".to_string());
            }
            
            // 获取屏幕像素颜色
            let color = GetPixel(screen_dc, point.x, point.y);
            
            // 释放DC
            ReleaseDC(hdc, screen_dc);
            
            // 解析RGB值 (GetPixel返回的COLORREF格式是0x00bbggrr)
            let b = ((color >> 16) & 0xFF) as u8;
            let g = ((color >> 8) & 0xFF) as u8;
            let r = (color & 0xFF) as u8;
            
            // 转换为十六进制颜色字符串
            let hex_color = format!("#{:02X}{:02X}{:02X}", r, g, b);
            
            // 构建结果
            let mut result = HashMap::new();
            result.insert("x".to_string(), serde_json::Value::Number(point.x.into()));
            result.insert("y".to_string(), serde_json::Value::Number(point.y.into()));
            result.insert("color".to_string(), serde_json::Value::String(hex_color.clone()));
            result.insert("note".to_string(), serde_json::Value::String("Windows 鼠标拾色".to_string()));
            
            Ok(result)
        }
    }
    
    #[cfg(target_os = "macos")]
    {
        // macOS 实现 - 启动系统颜色选择器
        println!("正在启动 macOS 系统颜色选择器...");
        
        // 启动 macOS 系统拾色器
        let color_result = start_macos_color_picker();
        
        match color_result {
            Ok(hex_color) => {
                // 获取当前鼠标位置
                let mouse_x = get_mouse_position_macos();
                let mouse_y = get_mouse_position_macos_y();
                
                // 构建结果
                let mut result = HashMap::new();
                result.insert("x".to_string(), serde_json::Value::Number(mouse_x.into()));
                result.insert("y".to_string(), serde_json::Value::Number(mouse_y.into()));
                result.insert("color".to_string(), serde_json::Value::String(hex_color));
                result.insert("note".to_string(), serde_json::Value::String("macOS 系统拾色器已启动，请在 Colors 应用中选择颜色".to_string()));
                
                Ok(result)
            },
            Err(e) => {
                // 如果系统拾色器启动失败，返回错误信息
                let mut result = HashMap::new();
                result.insert("x".to_string(), serde_json::Value::Number(0.into()));
                result.insert("y".to_string(), serde_json::Value::Number(0.into()));
                result.insert("color".to_string(), serde_json::Value::String("#808080".to_string()));
                result.insert("note".to_string(), serde_json::Value::String(format!("无法启动系统拾色器: {}", e)));
                
                Ok(result)
            }
        }
    }
    
    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        // 其他操作系统 - 返回默认值
        let mut result = HashMap::new();
        result.insert("x".to_string(), serde_json::Value::Number(0.into()));
        result.insert("y".to_string(), serde_json::Value::Number(0.into()));
        result.insert("color".to_string(), serde_json::Value::String("#808080".to_string()));
        result.insert("note".to_string(), serde_json::Value::String("Color picker not supported on this platform".to_string()));
        
        Ok(result)
    }
}

// macOS 辅助函数 - 启动 macOS 系统颜色选择器
fn start_macos_color_picker() -> Result<String, String> {
    use std::process::Command;
    
    println!("正在启动 macOS 系统颜色选择器...");
    
    // 首先启动颜色选择器
    if let Ok(_child) = Command::new("osascript")
        .arg("-e")
        .arg("choose color default color {32768, 32768, 32768}")
        .spawn()
    {
        println!("macOS 系统颜色选择器已启动");
        
        // 等待一下让颜色选择器启动
        std::thread::sleep(std::time::Duration::from_millis(1500));
        
        // 尝试切换到RGB模式（如果可能的话）
        let rgb_script = r#"tell application "System Events"
    tell process "Color Picker"
        try
            set frontmost to true
            delay 0.5
            tell menu 1 of menu bar 1
                click menu item "RGB Sliders"
            end tell
        on error errMsg
            -- 如果无法切换到RGB模式，继续使用默认模式
            return "继续使用默认颜色选择器模式"
        end try
    end tell
end tell"#;
        
        let _ = Command::new("osascript")
            .arg("-e")
            .arg(rgb_script)
            .output();
        
        // 启动DigitalColor Meter以显示详细的颜色信息（包括RGB）
        let _ = Command::new("open")
            .arg("-a")
            .arg("DigitalColor Meter")
            .spawn();
        
        println!("DigitalColor Meter 已启动，显示详细的颜色信息");
        Ok("#808080".to_string())
    } else {
        Err("无法启动系统颜色选择器".to_string())
    }
}

// macOS 辅助函数 - 获取鼠标X坐标
fn get_mouse_position_macos() -> i32 {
    use std::process::Command;
    
    // 尝试使用 AppleScript 获取鼠标位置
    match Command::new("osascript")
        .args(&["-e", "tell application \"System Events\" to get x of position of mouse"])
        .output()
    {
        Ok(output) => {
            if let Ok(position_str) = String::from_utf8(output.stdout) {
                if let Ok(x) = position_str.trim().parse::<i32>() {
                    return x;
                }
            }
        },
        Err(_) => {
            println!("无法获取鼠标 X 坐标，使用默认值");
        }
    }
    
    // 如果 AppleScript 失败，返回默认值
    100
}

// macOS 辅助函数 - 获取鼠标Y坐标
fn get_mouse_position_macos_y() -> i32 {
    use std::process::Command;
    
    // 尝试使用 AppleScript 获取鼠标位置
    match Command::new("osascript")
        .args(&["-e", "tell application \"System Events\" to get y of position of mouse"])
        .output()
    {
        Ok(output) => {
            if let Ok(position_str) = String::from_utf8(output.stdout) {
                if let Ok(y) = position_str.trim().parse::<i32>() {
                    return y;
                }
            }
        },
        Err(_) => {
            println!("无法获取鼠标 Y 坐标，使用默认值");
        }
    }
    
    // 如果 AppleScript 失败，返回默认值
    100
}

// 辅助函数：计算两种颜色的欧氏距离（颜色相似度）
fn color_distance(color1: (u8, u8, u8), color2: (u8, u8, u8)) -> f32 {
    let r_diff = (color1.0 as i32 - color2.0 as i32).pow(2);
    let g_diff = (color1.1 as i32 - color2.1 as i32).pow(2);
    let b_diff = (color1.2 as i32 - color2.2 as i32).pow(2);
    
    (r_diff + g_diff + b_diff) as f32
}

// 辅助函数：合并相似的颜色
fn merge_similar_colors(mut colors: Vec<(String, u32)>, threshold: f32) -> Vec<(String, u32)> {
    let mut merged: Vec<(String, u32)> = Vec::new();
    
    while let Some((hex, count)) = colors.pop() {
        if let Some(rgb1) = hex_to_rgb(&hex) {
            let mut found = false;
            
            // 查找相似的颜色
            for (merged_hex, merged_count) in &mut merged {
                if let Some(rgb2) = hex_to_rgb(merged_hex) {
                    if color_distance(rgb1, rgb2) < threshold {
                        // 合并相似颜色
                        *merged_count += count;
                        found = true;
                        break;
                    }
                }
            }
            
            if !found {
                merged.push((hex, count));
            }
        }
    }
    
    merged
}

// 提取图片颜色
#[tauri::command]
fn extract_colors(path: &str) -> Result<Vec<ColorItem>, String> {
    // 打开图片
    let img = ImageReader::open(path)
        .map_err(|e| format!("Failed to open image: {}", e))?
        .decode()
        .map_err(|e| format!("Failed to decode image: {}", e))?;
    
    // 缩小图片尺寸以提高性能，但增加到150x150以捕捉更多颜色
    let resized = img.resize(150, 150, image::imageops::FilterType::Triangle);
    let (width, height) = resized.dimensions();
    let total_pixels = width * height;
    
    // 统计颜色出现次数
    let mut color_counts = HashMap::new();
    
    for y in 0..height {
        for x in 0..width {
            let pixel = resized.get_pixel(x, y);
            let channels = pixel.channels();
            let r = channels[0];
            let g = channels[1];
            let b = channels[2];
            
            // 将颜色转换为十六进制格式
            let hex = format!("#{:02X}{:02X}{:02X}", r, g, b);
            
            // 更新颜色计数
            *color_counts.entry(hex).or_insert(0) += 1;
        }
    }
    
    // 合并相似的颜色（阈值1000，值越大合并越多）
    let color_vec: Vec<(String, u32)> = color_counts.into_iter().collect();
    let merged_colors = merge_similar_colors(color_vec, 1000.0);
    
    // 将合并后的颜色转换回HashMap
    let mut merged_color_counts: HashMap<String, u32> = HashMap::new();
    for (hex, count) in merged_colors {
        merged_color_counts.insert(hex, count);
    }
    
    // 计算每种颜色的占比
    let mut colors: Vec<ColorItem> = merged_color_counts
        .into_iter()
        .map(|(hex, count)| ColorItem {
            hex,
            percentage: (count as f32 / total_pixels as f32) * 100.0,
        })
        .collect();
    
    // 按照占比降序排序
    colors.sort_by(|a, b| b.percentage.partial_cmp(&a.percentage).unwrap_or(std::cmp::Ordering::Equal));
    
    // 增加返回的颜色数量，确保小占比颜色也能显示
    colors.truncate(30);
    
    Ok(colors)
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
            save_as,
            generate_icns,
            rotate_image,
            extract_colors,
            get_mouse_position_and_color
        ])
        .run(context)
        .expect("error while running tauri application");
}

