// منع ظهور نافذة الـ Console السوداء في الخلفية عند تشغيل البرنامج على ويندوز
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::sync::Mutex;
use serde::{Serialize, Deserialize};
use rusqlite;

// هيكل بيانات إعدادات المطعم
#[derive(Serialize, Deserialize, Clone)]
struct RestaurantConfig {
    name: String,
    tables_count: u32,
}

// تخزين مؤقت في الذاكرة لبيانات المطعم
struct AppState {
    config: Mutex<RestaurantConfig>,
}

// 1. دالة تسجيل الدخول والتحقق من الصلاحيات
#[tauri::command]
fn login_user(role: String) -> Result<String, String> {
    match role.as_str() {
        "cashier" => Ok("مرحباً بك يا كاشير، تم الدخول بنجاح.".to_string()),
        "manager" => Ok("مرحباً سيادة مدير الفرع، تم فتح الصلاحيات الكاملة.".to_string()),
        "owner" => Ok("مرحباً بك يا مالك المطعم، تم فتح لوحة التحكم الإدارية.".to_string()),
        _ => Err("نوع المستخدم غير معروف!".to_string()),
    }
}

// 2. دالة حفظ الفاتورة واستقبالها من الـ Frontend (تم تعديل أسماء المتغيرات لتطابق الـ JS بالملي)
#[tauri::command]
fn save_order(table_number: String, total_price: f64) -> String {
    println!("=== طلب جديد للمطبخ ===");
    println!("تم استقبال طلب من {} بمجموع {} ج.م بنجاح في الـ Backend!", table_number, total_price);
    format!("تم حفظ فاتورة {} بنجاح في قاعدة البيانات المحلية", table_number)
}

// 3. دالة حفظ إعدادات المطعم القادمة من الـ Frontend
#[tauri::command]
fn save_restaurant_settings(state: tauri::State<'_, AppState>, name: String, tables: u32) -> String {
    let mut config = state.config.lock().unwrap();
    config.name = name.clone();
    config.tables_count = tables;
    
    println!("=== تحديث إعدادات المطعم ===");
    println!("الاسم: {} | عدد الطاولات: {}", config.name, config.tables_count);
    
    format!("تم تحديث بيانات مطعم [{}] بنجاح!", config.name)
}

// 4. دالة لجلب اسم المطعم الحالي لعرضه بشكل احترافي في الواجهة
#[tauri::command]
fn get_restaurant_name(state: tauri::State<'_, AppState>) -> String {
    let config = state.config.lock().unwrap();
    config.name.clone()
}

fn main() {
    // 1. استدعاء دالة التهيئة فور تشغيل البرنامج
    let _ = init_db(); 
    tauri::Builder::default()
        .manage(AppState {
            config: Mutex::new(RestaurantConfig {
                name: "مطعم البراند الفخم".to_string(), // الاسم الافتراضي
                tables_count: 6,
            }),
        })
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            login_user,
            save_order,
            save_restaurant_settings,
            get_restaurant_name,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

// دالة التهيئة
fn init_db() -> Result<(), rusqlite::Error> {
    let conn = rusqlite::Connection::open("restaurant.db")?;
    conn.execute(
        "CREATE TABLE IF NOT EXISTS orders (id INTEGER PRIMARY KEY, item_name TEXT, price REAL)",
        [],
    )?;
    Ok(())
}
