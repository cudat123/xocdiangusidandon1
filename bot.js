const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const fs = require('fs');
const express = require('express'); 
const crypto = require('crypto');   
const bodyParser = require('body-parser'); 
const qs = require('querystring'); 

// Đảm bảo lấy đúng constructor của TelegramBot 
let BotConstructor = TelegramBot;
if (typeof TelegramBot !== 'function' && TelegramBot && typeof TelegramBot.default === 'function') {
    BotConstructor = TelegramBot.default;
}

// ⚠️ CẤU HÌNH CẦN THIẾT ⚠️
const TOKEN = '8212645074:AAFNWdNrIlxSuUF8Bi_gUgIiJANhJY0SiAY'; // <-- TOKEN CỦA BẠN
const MASTER_ADMIN_ID = '8579975246'; // Thay bằng ID Telegram cá nhân của bạn
// ------------------------------------------------------------------------------

// ⚠️ CẤU HÌNH WEBHOOK CHO RENDER ⚠️
const WEBHOOK_PORT = process.env.PORT || 3000; // Render sẽ cung cấp biến PORT
// >>>>>>>>>> CHÚ Ý: BẠN PHẢI THAY THẾ DÒNG NÀY SAU KHI DEPLOY <<<<<<<<<<
// Thay thế bằng URL công khai CÓ HTTPS của Render, ví dụ: 'https://my-awesome-bot.onrender.com'
const WEBHOOK_URL = 'YOUR_RENDER_PUBLIC_URL_HERE'; 
const WEBHOOK_PATH = `/webhook/${TOKEN}`; // Đường dẫn để nhận Updates
// ------------------------------------------------------------------------------


// Cấu hình Bot ở chế độ Webhook
const bot = new BotConstructor(TOKEN, { 
    polling: false // Tắt Polling
});

// Thiết lập Webhook (Sẽ được gọi khi Server khởi động)
bot.setWebHook(WEBHOOK_URL + WEBHOOK_PATH, {
    allowed_updates: ['message', 'callback_query'] 
}).then(() => {
    console.log(`[WEBHOOK] Đã thiết lập Webhook thành công: ${WEBHOOK_URL + WEBHOOK_PATH}`);
}).catch(e => {
    console.error(`\n[WEBHOOK] ❌ LỖI KHI THIẾT LẬP WEBHOOK ❌: ${e.message}`);
    console.error(`Vui lòng kiểm tra lại: 1. TOKEN. 2. WEBHOOK_URL đã được thay thế chưa.`);
});


const MASTER_ADMIN_ID_STR = String(MASTER_ADMIN_ID); 
const DB_FILE = 'database.json';
const POLLING_INTERVAL_MS = 5000; 
const TEMP_MESSAGE_DURATION = 10000; 

// CẤU HÌNH KEY 
const KEY_CONFIG = {
    '1day': { days: 1, price: 20000, duration: '1 Ngày' },
    '3day': { days: 3, price: 30000, duration: '3 Ngày' }, 
    '7day': { days: 7, price: 40000, duration: '7 Ngày' }, 
    '30day': { days: 30, price: 80000, duration: '30 Ngày' }, 
    'lifetime': { days: 36500, price: 200000, duration: 'Vĩnh Viễn' }, 
};
// ⚠️ CẤU HÌNH API GAME (GIỮ NGUYÊN)
const API_URL_MAP = {
    'tx_sunwin': { url: 'https://sunwinsaygex-txuh.onrender.com/api/sun', category: 'TÀI XỈU' },
    'tx_hitclub': { url: 'https://hitclub-8eep.onrender.com/api/taixiu', category: 'TÀI XỈU' },
    'tx_789club': { url: 'https://seven89-hgx3.onrender.com/taixiu', category: 'TÀI XỈU' },
    'tx_b52': { url: 'https://b52-v7wg.onrender.com/api/taixiu', category: 'TÀI XỈU' },
    'tx_lc79': { url: 'https://lcthuong.onrender.com/api/taixiu', category: 'TÀI XỈU' },

    'sicbo_sunwin': { url: 'https://sicbosunwin.onrender.com/api/sicbo/sunwin', category: 'SICBO' },
    'sicbo_789club': { url: 'https://okle-789sic.onrender.com/predict', category: 'SICBO' },
    
    'md5_hitclub': { url: 'https://hitclub-8eep.onrender.com/api/taixiumd5', category: 'MD5' },
    'md5_b52': { url: 'https://b52-taixiu-l69b.onrender.com/api/taixiu', category: 'MD5' },
    'md5_lc79': { url: 'https://lcmd5-1.onrender.com/api/taixiumd5', category: 'MD5' },
    'md5_sumclub': { url: 'https://cailonma-sumcc.onrender.com/api/taixiu/lucky', category: 'MD5' },
    'md5_xocdia88': { url: 'https://d-predict.onrender.com/api/taixiu', category: 'MD5' },
};
const NAMES = {
    'tx_sunwin': 'TÀI XỈU SUNWIN', 'tx_hitclub': 'TÀI XỈU HITCLUB',
    'tx_789club': 'TÀI XỈU 789CLUB', 'tx_b52': 'TÀI XỈU B52CLUB',
    'tx_lc79': 'TÀI XỈU LC79 (Thường)',

    'sicbo_sunwin': 'SICBO SUNWIN', 'sicbo_789club': 'SICBO 789CLUB',
    
    'md5_hitclub': 'TÀI XỈU MD5 HITCLUB', 'md5_b52': 'TÀI XỈU MD5 B52',
    'md5_lc79': 'TÀI XỈU MD5 LC79',
    'md5_sumclub': 'TÀI XỈU SUMCLUB', 
    'md5_xocdia88': 'TÀI XỈU XOCDIA88', 
};
const GAME_ICONS = {
    'tx_sunwin': '☀️', 'tx_hitclub': '🎯',
    'tx_789club': '🍀', 'tx_b52': '💣',
    'tx_lc79': '💎',

    'sicbo_sunwin': '☀️', 'sicbo_789club': '🍀',
    
    'md5_hitclub': '🎯', 'md5_b52': '💣',
    'md5_lc79': '💎',
    'md5_sumclub': '💰', 
    'md5_xocdia88': '🔥', 
}

// ------------------------------------------------------------------------------
//                        CƠ CHẾ DATABASE (JSON) & UTILS (GIỮ NGUYÊN)
// ------------------------------------------------------------------------------
let db = {
    users: {},
    keys: {},
    adminIds: [MASTER_ADMIN_ID_STR],
    adminStates: {}, 
    discountCodes: {}, 
};

function loadData() {
    try {
        const data = fs.readFileSync(DB_FILE, 'utf8');
        const loadedData = JSON.parse(data);
        db = { ...db, ...loadedData };
        if (!db.adminIds || !Array.isArray(db.adminIds)) db.adminIds = [MASTER_ADMIN_ID_STR];
        if (!db.adminIds.includes(MASTER_ADMIN_ID_STR)) db.adminIds.push(MASTER_ADMIN_ID_STR);
        
        db.discountCodes = db.discountCodes || {};
        db.adminStates = db.adminStates || {};
        db.keys = db.keys || {};
        db.users = db.users || {};
    } catch (e) {
        if (e.code === 'ENOENT') {
            console.log("[DB] File database.json không tồn tại, tạo mới.");
        } else {
            console.error(`[DB] Lỗi đọc file DB: ${e.message}`);
        }
        saveData(); 
    }
}
function saveData() {
    try {
        fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf8');
    } catch (e) {
        console.error(`[DB] Lỗi ghi file DB: ${e.message}`);
    }
}
function isAdmin(chatId) {
    return db.adminIds.includes(String(chatId));
}
function isMasterAdmin(chatId) {
    return String(chatId) === MASTER_ADMIN_ID_STR;
}
async function safeDeleteMessage(chatId, messageId) {
    if (!messageId || !chatId) return;
    try {
        await bot.deleteMessage(chatId, messageId).catch(error => {
            if (!error.message.includes('400')) {
                console.error(`[DELETE FAIL] Không xóa được tin nhắn ${messageId} tại ${chatId}: ${error.message}`);
            }
        });
    } catch (e) {}
}
function stopRunningGameForUser(chatId) {
    const user = db.users[chatId];
    let stateChanged = false;
    if (user && user.gameIntervalId) {
        clearInterval(user.gameIntervalId);
        user.gameIntervalId = null;
        user.runningGame = null;
        stateChanged = true;
    }
    if (user) user.lastPredictionData = null; 
    
    if (stateChanged) saveData(); 
    return stateChanged;
}
function ensureUserState(chatId, msg) {
    const chatIdStr = String(chatId);
    
    const firstName = msg.from && msg.from.first_name ? msg.from.first_name : 'Khách';
    const username = msg.from && msg.from.username ? msg.from.username : '';
    
    const defaultUser = {
        chatId: chatIdStr,
        first_name: firstName,
        username: username,
        balance: 0,
        is_activated: false,
        expiryDate: null, 
        waitingFor: null, 
        lastBotMessageId: null, 
        runningGame: null, 
        gameIntervalId: null, 
        lastPredictionData: null, 
        lastActive: Date.now(), 
    };

    if (!db.users[chatIdStr]) {
        db.users[chatIdStr] = defaultUser;
    } else {
        db.users[chatIdStr].first_name = firstName;
        db.users[chatIdStr].username = username;
        db.users[chatIdStr].lastActive = Date.now();
        db.users[chatIdStr].lastPredictionData = db.users[chatIdStr].lastPredictionData || null; 
        db.users[chatIdStr].lastBotMessageId = db.users[chatIdStr].lastBotMessageId || db.users[chatIdStr].lastMenuMessageId || db.users[chatIdStr].lastGameMessageId || null;
        delete db.users[chatIdStr].lastMenuMessageId; 
        delete db.users[chatIdStr].lastGameMessageId; 
    }
    saveData();
    return db.users[chatIdStr];
}
function formatPrice(price) {
    return price.toLocaleString('vi-VN') + ' VND';
}
function calculateNewExpiry(currentExpiryMs, daysToAdd) {
    if (daysToAdd >= 36500) return 'Vĩnh Viễn'; 

    let baseTime = Date.now();
    if (currentExpiryMs && currentExpiryMs !== 'Vĩnh Viễn' && currentExpiryMs > Date.now()) {
        baseTime = currentExpiryMs;
    }
    
    const newExpiryDate = new Date(baseTime);
    newExpiryDate.setDate(newExpiryDate.getDate() + daysToAdd);
    return newExpiryDate.getTime();
}
function activateUserKey(user, days) {
    let currentExpiryMs = user.expiryDate && user.expiryDate !== 'Vĩnh Viễn' ? new Date(user.expiryDate).getTime() : 0;
    const newExpiryMs = calculateNewExpiry(currentExpiryMs, days);
    
    if (newExpiryMs === 'Vĩnh Viễn') {
        user.expiryDate = 'Vĩnh Viễn';
    } else {
        user.expiryDate = newExpiryMs;
    }
    
    user.is_activated = true;
    saveData();
    return user.expiryDate === 'Vĩnh Viễn' ? 'Vĩnh Viễn' : new Date(user.expiryDate).toLocaleDateString('vi-VN');
}

function isKeyActive(user) {
    if (!user || !user.is_activated) {
        return false;
    }
    
    const expiryDate = user.expiryDate;
    
    if (expiryDate === 'Vĩnh Viễn') {
        return true; 
    }

    if (expiryDate && typeof expiryDate === 'number') {
        return expiryDate > Date.now(); 
    }
    
    return false;
}

// ------------------------------------------------------------------------------
//                       HÀM HỖ TRỢ HIỂN THỊ VÀ GỬI TIN NHẮN 
// ------------------------------------------------------------------------------

async function sendFormattedUserInfo(chatId) {
    const user = db.users[chatId];
    let expiryDateStr;
    if (user.expiryDate === 'Vĩnh Viễn') {
        expiryDateStr = '<b>Vĩnh Viễn</b>'; // HTML bold
    } else if (user.expiryDate && user.expiryDate > 0) {
        expiryDateStr = `<b>${new Date(user.expiryDate).toLocaleDateString('vi-VN')}</b>`;
    } else {
        expiryDateStr = '<b>Chưa kích hoạt</b>';
    }

    const status = isKeyActive(user) ? '<b>ĐANG HOẠT ĐỘNG ✅</b>' : '<b>CHƯA KÍCH HOẠT ❌</b>'; 
    const firstName = user.first_name || 'Khách';
    const username = user.username ? ` - @${user.username}` : ''; 
    const balance = `<b>${(user.balance || 0).toLocaleString('vi-VN')} VND</b>`;
    const chatIdDisplay = `<b>${user.chatId}</b>`; 

    const message = `
<b>THÔNG TIN TÀI KHOẢN</b> 👤
ID Telegram: ${chatIdDisplay}
Tên User: ${firstName}${username}
Số Dư: ${balance}
Trạng Thái Key: ${status}
Hạn Dùng: ${expiryDateStr}
    `;
    
    await sendMenuMessage(chatId, message, { parse_mode: 'HTML', reply_markup: getMainKeyboard(isKeyActive(user), isAdmin(chatId)) });
}

// HÀM GỬI MENU VÀ XỬ LÝ LỖI GỬI 
async function sendMenuMessage(chatId, message, options = {}) {
    const user = db.users[chatId];
    
    await safeDeleteMessage(chatId, user.lastBotMessageId);
    user.lastBotMessageId = null; 

    stopRunningGameForUser(chatId); 
    
    const finalOptions = { parse_mode: 'HTML', ...options }; 
    if (options.parse_mode === undefined) {
        finalOptions.parse_mode = 'HTML';
    } else if (options.parse_mode === null) {
        delete finalOptions.parse_mode; 
    }
    
    let sentMessage = null;
    for (let i = 0; i < 3; i++) { 
        try {
            sentMessage = await bot.sendMessage(chatId, message, finalOptions);
            break; 
        } catch(e) {
            console.error(`[SEND FAIL - Lần ${i+1}] Lỗi gửi Menu Message đến ${chatId}: ${e.message.substring(0, 100)}...`);
            if (i === 2) { 
                return null; 
            }
            await new Promise(resolve => setTimeout(resolve, 500)); 
        }
    }
    
    if (sentMessage) {
        user.lastBotMessageId = sentMessage.message_id;
        saveData(); 
    }
    return sentMessage;
}
// END HÀM GỬI MENU

/**
 * Gửi tin nhắn tạm thời và tự xóa sau 3s (dùng cho thông báo thắng/thua)
 */
async function sendImportantMessage(chatId, message, options = {}, duration = TEMP_MESSAGE_DURATION) {
    const finalOptions = { parse_mode: 'HTML', ...options };
    try {
        const sentMsg = await bot.sendMessage(chatId, message, finalOptions);
        setTimeout(async () => {
            await safeDeleteMessage(chatId, sentMsg.message_id); 
        }, duration);
    } catch (e) {
        console.error(`[SEND FAIL] Lỗi gửi Important Message đến ${chatId}: ${e.message}`);
    }
}

// CẬP NHẬT KEYBOARD CHÍNH (Đã loại bỏ nút "💰 Nạp tiền")
function getMainKeyboard(isActivated, isAdminAccess) {
    const keyboard = [];
    
    if (isActivated) {
        // Hàng 1: Nút CHƠI GAME
        keyboard.push([{ text: "⚡️ CHƠI GAME DỰ ĐOÁN 🎲" }]); 
        // Hàng 2: Thông tin, Nút Key
        keyboard.push([{ text: "👤 Thông tin tài khoản" }, { text: "🔑 Key" }]);
        // Hàng 3: Liên hệ Admin
        keyboard.push([{ text: "❓ Liên hệ Admin" }]);
        
    } else {
        // Khi chưa kích hoạt: Không có nút CHƠI GAME
        keyboard.push([{ text: "👤 Thông tin tài khoản" }, { text: "🔑 Key" }]);
        // Hàng 2: Liên hệ Admin
        keyboard.push([{ text: "❓ Liên hệ Admin" }]);
    }

    if (isAdminAccess) {
        keyboard.push([{ text: "⚙️ Admin Panel" }]);
    }
    return { keyboard: keyboard, resize_keyboard: true };
}

// MENU CON CHO KEY (GIỮ NGUYÊN)
function getKeySubMenu() {
    const keyboard = [
        [{ text: "🔑 Nhập Key" }, { text: "💰 Mua Key" }],
        [{ text: "⬅️ Quay Lại Menu Chính" }]
    ];
    return { keyboard: keyboard, resize_keyboard: true };
}

function getAdminReplyKeyboard(isMaster) {
    const keyboard = [
        [{ text: "🔑 Tạo Key" }, { text: "🎁 Tạo Mã Giảm Giá" }],
        [{ text: "📢 Thông Báo Chung" }, { text: "📊 Danh Sách User" }],
        [{ text: "🔄 Tác Vụ Khác" }],
        [{ text: "⬅️ Quay Lại Menu Chính" }]
    ];
    return { keyboard: keyboard, resize_keyboard: true };
}
function getAdminActionsReplyKeyboard(isMaster) {
    const keyboard = [
        [{ text: "💰 Cộng/Trừ Số Dư" }],
    ];
    if (isMaster) {
        keyboard.push([{ text: "👑 Cấp Quyền Admin" }, { text: "🗑️ Thu Quyền Admin" }]);
    }
    keyboard.push([{ text: "⬅️ Quay lại Admin Panel" }]);
    return { keyboard: keyboard, resize_keyboard: true };
}
function getCreateKeyInlineKeyboard() {
    const keyboard = Object.keys(KEY_CONFIG).map(key => {
        const config = KEY_CONFIG[key];
        return { text: `🔑 ${config.duration} (${formatPrice(config.price)})`, callback_data: `admin_create_key_${key}` };
    });
    const inline_keyboard = [];
    for (let i = 0; i < keyboard.length; i += 2) {
        let row = [keyboard[i]];
        if (keyboard[i + 1]) row.push(keyboard[i + 1]);
        inline_keyboard.push(row);
    }
    inline_keyboard.push([{ text: "⬅️ Quay lại Admin Panel", callback_data: 'admin_back_to_panel' }]);
    return { inline_keyboard };
}

function getGameCategorySubMenu() {
    const keyboard = [
        [{ text: "🎰 TÀI XỈU" }, { text: "🎲 SICBO" }],
        [{ text: "🧮 MD5" }],
        [{ text: "⬅️ Quay Lại Menu Chính" }]
    ];
    return { keyboard: keyboard, resize_keyboard: true };
}
function getGameSubMenu(category) {
    const games = Object.keys(API_URL_MAP)
        .filter(key => API_URL_MAP[key].category === category)
        .map(key => ({ 
            key: key, 
            name: `${GAME_ICONS[key]} ${NAMES[key]}` 
        }));

    const keyboard = [];
    for (let i = 0; i < games.length; i += 2) {
        let row = [games[i].name];
        if (games[i + 1]) row.push(games[i + 1].name);
        keyboard.push(row);
    }

    keyboard.push([{ text: "⬅️ Quay Lại Menu Game" }]);
    return { keyboard: keyboard, resize_keyboard: true };
}
async function menuChonGame(chatId) {
    const user = db.users[chatId];
    if (!isKeyActive(user)) {
        await sendImportantMessage(chatId, 'Key đã hết hạn hoặc chưa kích hoạt. Vui lòng mua Key mới hoặc nhập Key để sử dụng Tool.', { parse_mode: 'HTML' }, 7000);
        await sendMainMenu(chatId);
        return;
    }
    await stopRunningGameForUser(chatId);
    await sendMenuMessage(chatId, '<b>CHỌN DANH MỤC GAME DỰ ĐOÁN:</b>', { parse_mode: 'HTML', reply_markup: getGameCategorySubMenu() });
}

async function getLivePredictionData(gameKey) {
    const config = API_URL_MAP[gameKey];
    if (!config) return null;

    try {
        const response = await axios.get(config.url, { timeout: 20000 }); 
        const data = response.data;

        const prediction = data.Du_doan || data.du_doan || 'N/A';
        const raw_confidence = data.do_tin_cay || data.Do_tin_cay || data.dotincay || null; 
        
        let raw_phien_hien_tai = data.phien_hien_tai || data.Phien_hien_tai || null; 
        let raw_phien_ket_thuc = data.phien || data.Phien || null; 

        let phien_num_effective = 'N/A';
        
        if (raw_phien_hien_tai) {
            phien_num_effective = String(raw_phien_hien_tai);
        } else if (raw_phien_ket_thuc) {
            let phien_ket_thuc_num = parseInt(raw_phien_ket_thuc);
            if (!isNaN(phien_ket_thuc_num) && phien_ket_thuc_num > 0) {
                phien_num_effective = String(phien_ket_thuc_num + 1); 
            } else {
                phien_num_effective = String(raw_phien_ket_thuc); 
            }
        }
        
        const final_phien = phien_num_effective;
        
        let confidence_display = '85%'; 
        if (raw_confidence) {
            let conf_str = String(raw_confidence).trim();
            
            if (conf_str.startsWith('0.') || conf_str.startsWith('.')) {
                const parts = conf_str.split('.');
                if (parts.length > 1 && parts[1].length > 0) {
                    let decimal_part = parts[1].padEnd(2, '0').substring(0, 2); 
                    confidence_display = parseInt(decimal_part) + '%';
                }
            } 
            else if (!conf_str.includes('%')) {
                let num = parseInt(conf_str);
                if (!isNaN(num)) {
                    confidence_display = num + '%';
                }
            }
            else {
                confidence_display = conf_str;
            }
        }

        const result = { 
            category: config.category,
            phien_hien_tai: final_phien,
            du_doan: prediction,
            dudoan_vi: 'N/A', 
            confidence_display: confidence_display, 
        };

        if (config.category === 'SICBO') {
            const dudoanVi = data.dudoan_vi || data.Du_doan_vi;
            if (dudoanVi) {
                result.dudoan_vi = Array.isArray(dudoanVi) ? dudoanVi.join(', ') : String(dudoanVi);
            }
        }
        
        return result;
    } catch (e) {
        console.error(`[API FAIL] Game ${gameKey} failed: ${e.message.substring(0, 50)}...`);
        return null;
    }
}

function formatPredictionMessage(gameKey, data) { 
    const gameName = NAMES[gameKey];
    const gameIcon = GAME_ICONS[gameKey] || '🎲'; 
    
    if (!data || data.du_doan === 'N/A' || data.phien_hien_tai === 'N/A') {
        return `<b>⚠️ Không thể lấy dữ liệu dự đoán cho ${gameIcon} ${gameName}. Vui lòng thử lại sau!</b>`;
    }
    
    const duDoanText = String(data.du_doan).toUpperCase();
    const confidenceDisplay = data.confidence_display || '85%';

    let predictionIcon = '👉';
    if (duDoanText === 'TÀI' || duDoanText === 'LẺ') predictionIcon = '⬆️';
    else if (duDoanText === 'XỈU' || duDoanText === 'CHẴN') predictionIcon = '⬇️'; 
    
    let message = `
<b>👑 TOOL DỰ ĐOÁN CHÍNH XÁC</b> ${gameIcon}
————————————
<b>${gameIcon} ${gameName}:</b>
Phiên Hiện Tại: <b>${data.phien_hien_tai}</b>
${predictionIcon} Dự Đoán: <b>${duDoanText}</b> (${confidenceDisplay} tin cậy)
`;

    if (data.category === 'SICBO' && data.dudoan_vi && data.dudoan_vi !== 'N/A') {
        const viDisplay = data.dudoan_vi.replace(/, /g, '; ').replace(/,/g, '; ');
        message += `🎲 Vị Dự Đoán: <b>${viDisplay}</b>\n`;
    }

    message += `
————————————
⚠️ <i>Nếu thua, hãy giữ vốn ổn định, tránh All-in và luôn giữ cái đầu tỉnh táo để biết điểm dừng. Chúc bạn chơi vui vẻ!</i>
`;
    
    return message;
}

async function runPrediction(chatId, gameKey) {
    const user = db.users[chatId];
    if (!user || user.runningGame !== gameKey) return; 

    const gameName = NAMES[gameKey];
    const gameIcon = GAME_ICONS[gameKey] || '🎲'; 
    
    const gameCategory = API_URL_MAP[gameKey].category;
    const reply_markup = getGameSubMenu(gameCategory); 
    
    if (!user.lastBotMessageId) { 
        try {
            const sentWaitingMsg = await bot.sendMessage(chatId, 
                `<b>${gameIcon} ${gameName}</b>\n\n🕒 <b>Đang kết nối đến game</b> và chờ tín hiệu phiên mới...`, { 
                parse_mode: 'HTML', 
                reply_markup: reply_markup 
            });
            user.lastBotMessageId = sentWaitingMsg.message_id;
            saveData();
        } catch (e) {
            console.error(`[GAME UI FAIL] Lỗi gửi tin nhắn chờ cho ${chatId}: ${e.message}`);
        }
    }


    const predictionData = await getLivePredictionData(gameKey);

    const effectivePredictionData = predictionData || { 
        phien_hien_tai: 'N/A', 
        du_doan: 'N/A', 
        category: API_URL_MAP[gameKey].category 
    };
    if (effectivePredictionData.phien_hien_tai === 'N/A') {
         effectivePredictionData.du_doan = 'N/A';
         effectivePredictionData.confidence_display = 'N/A'; 
    }


    const currentPhien = String(effectivePredictionData.phien_hien_tai);
    const lastPredictionData = user.lastPredictionData;
    
    const isNewPrediction = !lastPredictionData || currentPhien !== String(lastPredictionData.phien_hien_tai);
    
    if (isNewPrediction) {
        
        const finalMessage = formatPredictionMessage(gameKey, effectivePredictionData);
        
        try {
            await bot.editMessageText(finalMessage, {
                chat_id: chatId,
                message_id: user.lastBotMessageId,
                parse_mode: 'HTML', 
                reply_markup: reply_markup 
            });
            
        } catch (e) {
            if (!e.message.includes('message is not modified')) {
                 await safeDeleteMessage(chatId, user.lastBotMessageId); 
                 const sentMsg = await bot.sendMessage(chatId, finalMessage, {
                    parse_mode: 'HTML', 
                    reply_markup: reply_markup 
                });
                user.lastBotMessageId = sentMsg.message_id;
            }
        }
        
        user.lastPredictionData = { 
            phien_hien_tai: currentPhien, 
            du_doan: effectivePredictionData.du_doan,
            category: effectivePredictionData.category,
        };
        saveData();
    }
}

async function startGamePolling(chatId, gameKey) {
    const user = db.users[chatId];
    
    if (!isKeyActive(user)) {
        await sendImportantMessage(chatId, 'Key đã hết hạn hoặc chưa kích hoạt. Vui lòng mua Key mới hoặc nhập Key để sử dụng Tool.', { parse_mode: 'HTML' }, 7000);
        await sendMainMenu(chatId);
        return;
    }
    
    stopRunningGameForUser(chatId); 
    
    user.runningGame = gameKey;
    user.lastBotMessageId = null; 
    user.lastPredictionData = null; 
    
    await runPrediction(chatId, gameKey); 

    const intervalId = setInterval(async () => {
        const currentUser = db.users[chatId];
        
        if (currentUser && currentUser.runningGame === gameKey && isKeyActive(currentUser)) {
             await runPrediction(chatId, gameKey);
        } else {
            clearInterval(intervalId);
            if (currentUser) {
                await safeDeleteMessage(chatId, currentUser.lastBotMessageId);
                currentUser.lastBotMessageId = null;
                currentUser.gameIntervalId = null; 
                currentUser.runningGame = null;
                saveData();
                if (!isKeyActive(currentUser)) {
                    await sendImportantMessage(chatId, 'Key đã hết hạn! Quá trình dự đoán tự động bị dừng.', { parse_mode: 'HTML' }, 10000);
                }
            }
        }
    }, POLLING_INTERVAL_MS);

    user.gameIntervalId = intervalId;
    saveData();
}

async function sendMainMenu(chatId, welcome = false) {
    const user = db.users[chatId];
    
    user.waitingFor = null;
    user.adminStates = {};
    user.currentKeyPurchase = null;
    saveData(); 
    
    const welcomeText = welcome ? 'Chào mừng đến với <b>Tool Dự đoán Tài Xỉu</b> 🚀.\n\n' : '';
    const messageText = welcomeText + '<b>Vui lòng sử dụng Menu phía dưới để chọn chức năng.</b>';

    await sendMenuMessage(chatId, messageText, { parse_mode: 'HTML', reply_markup: getMainKeyboard(isKeyActive(user), isAdmin(chatId)) });
}
async function infoTkHandler(chatId) {
    await sendFormattedUserInfo(chatId);
}
async function hoTroHandler(chatId) {
    const user = db.users[chatId];
    
    const response = '<b>LIÊN HỆ ADMIN</b> 🆘\n\nNếu bạn gặp bất kỳ vấn đề nào, vui lòng liên hệ Admin để được hỗ trợ nhanh nhất:\n\nTelegram: <b>Tiến - @tiendat_Dev</b>';
    await sendMenuMessage(chatId, response, { parse_mode: 'HTML', reply_markup: getMainKeyboard(isKeyActive(user), isAdmin(chatId)) });
}

async function keyMenuHandler(chatId) {
    const user = db.users[chatId];
    await sendMenuMessage(chatId, '<b>QUẢN LÝ KEY</b> 🔑\nVui lòng chọn chức năng:', 
        { parse_mode: 'HTML', reply_markup: getKeySubMenu() });
}

/**
 * Hàm xử lý cuộc hội thoại (Chỉ giữ lại logic Key và Mã giảm giá)
 */
async function handleConversation(msg) {
    const chatId = String(msg.chat.id);
    const text = msg.text.trim();
    const user = db.users[chatId];
    const messageId = msg.message_id;

    if (!user.waitingFor) return;

    // Luôn xóa tin nhắn người dùng vừa gửi để giữ giao diện sạch sẽ
    await safeDeleteMessage(chatId, messageId); 

    if (user.waitingFor === 'CHO_NHAP_KEY') {
        await xuLyNhapKey(chatId, text);
    } 
    else if (user.waitingFor === 'CHO_MA_GIAM_GIA_INPUT') {
        user.waitingFor = null; 
        saveData(); 
        
        const discountCode = text.toUpperCase();
        
        const discountData = db.discountCodes[discountCode];
        
        if (discountData && discountData.is_active && user.currentKeyPurchase) {
            const discountPercent = discountData.percentage / 100;
            const originalPrice = user.currentKeyPurchase.originalPrice;
            const finalPrice = Math.round(originalPrice * (1 - discountPercent));
            
            user.currentKeyPurchase.finalPrice = finalPrice;
            saveData();
            
            await bot.sendMessage(chatId, `Mã giảm giá <b>${discountCode}</b> đã được áp dụng. Giảm <i>${discountData.percentage}%</i>. Giá mới: <b>${formatPrice(finalPrice)}</b>.`, { parse_mode: 'HTML' });
            
            await xacNhanMuaKey(chatId, user.lastBotMessageId, user.currentKeyPurchase.keyId);
        } else {
             await bot.sendMessage(chatId, `Mã giảm giá <b>${discountCode}</b> không hợp lệ hoặc đã hết hạn.`, { parse_mode: 'HTML' });
             await xacNhanMuaKey(chatId, user.lastBotMessageId, user.currentKeyPurchase ? user.currentKeyPurchase.keyId : Object.keys(KEY_CONFIG)[0]); 
        }
    } else {
        // Có thể thêm logic xử lý tin nhắn không mong muốn khác ở đây
        await sendImportantMessage(chatId, 'Hệ thống không nhận dạng được yêu cầu. Vui lòng chọn lại chức năng từ Menu.', { parse_mode: 'HTML' }, 5000);
        await sendMainMenu(chatId);
    }
}

async function xuLyNhapKey(chatId, key_value) {
    const keyData = db.keys[key_value];
    const user = db.users[chatId];
    user.waitingFor = null;
    saveData();
    
    const keyDisplay = `<b>${key_value}</b>`; 

    if (keyData && !keyData.is_used) {
        const days = keyData.days;

        db.keys[key_value].is_used = true;
        
        const newExpiryDateStr = activateUserKey(user, days); 
        const config = KEY_CONFIG[keyData.type];
        
        const response = `<b>Key Hợp Lệ! ✅</b>
Key: <b>${keyDisplay}</b>
Loại Key: <i>${config.duration}</i>
Hạn sử dụng mới: <b>${newExpiryDateStr}</b>`;
        await sendImportantMessage(chatId, response, { parse_mode: 'HTML' });
        await sendMainMenu(chatId);
    } else {
        const response = '<b>Key không hợp lệ, đã được sử dụng, hoặc không tồn tại. ❌</b>';
        await sendImportantMessage(chatId, response, { parse_mode: 'HTML' });
        await sendMainMenu(chatId);
    }
}
async function chonKeyMua(chatId, messageId) {
    const keyboard = Object.keys(KEY_CONFIG).map(key => {
        const config = KEY_CONFIG[key];
        return { text: `${config.duration} (${formatPrice(config.price)})`, callback_data: `buykey_${key}` };
    });
    const inline_keyboard = [];
    for (let i = 0; i < keyboard.length; i += 2) {
        let row = [keyboard[i]];
        if (keyboard[i + 1]) row.push(keyboard[i + 1]);
        inline_keyboard.push(row);
    }
    inline_keyboard.push([{ text: "❌ Hủy bỏ", callback_data: 'cancel_mua' }]);
    
    try {
        await bot.editMessageText('<b>CHỌN loại Key muốn mua 🛒:</b>', 
            { chat_id: chatId, message_id: messageId, parse_mode: 'HTML', reply_markup: { inline_keyboard } });
    } catch (e) {
        await sendMenuMessage(chatId, '<b>CHỌN loại Key muốn mua 🛒:</b>', { parse_mode: 'HTML', reply_markup: { inline_keyboard } });
    }
    db.users[chatId].waitingFor = 'CHON_KEY_MUA';
    db.users[chatId].currentKeyPurchase = null; 
    saveData();
}
async function xacNhanMuaKey(chatId, messageId, keyId) {
    const user = db.users[chatId];
    const config = KEY_CONFIG[keyId];
    if (!config) return;

    let finalPrice = config.price; 
    
    if (!user.currentKeyPurchase || user.currentKeyPurchase.keyId !== keyId) {
        user.currentKeyPurchase = { keyId: keyId, originalPrice: config.price, finalPrice: finalPrice };
    } else {
        finalPrice = user.currentKeyPurchase.finalPrice;
    }
    
    const message = `
<b>XÁC NHẬN MUA KEY 🧾</b>
Loại Key: <i>${config.duration}</i>
Giá gốc: <i>${formatPrice(user.currentKeyPurchase.originalPrice || config.price)}</i>
Tổng thanh toán: <b>${formatPrice(finalPrice)}</b>
Số dư hiện tại: <i>${formatPrice(user.balance)}</i>
    `;

    const inline_keyboard = [
        [{ text: `✅ THANH TOÁN (${formatPrice(finalPrice)})`, callback_data: 'confirm_mua' }],
        [{ text: '💲 Áp Mã Giảm Giá', callback_data: 'nhap_ma_giam_gia' }],
        [{ text: '❌ Hủy', callback_data: 'cancel_mua' }]
    ];

    try {
        await bot.editMessageText(message, { 
            chat_id: chatId, 
            message_id: messageId, 
            parse_mode: 'HTML', 
            reply_markup: { inline_keyboard } 
        });
        user.waitingFor = 'CHO_XAC_NHAN';
        saveData();
    } catch(e) {
        console.error(`[EDIT FAIL] Lỗi edit Xac Nhan Mua Key: ${e.message.substring(0, 50)}... Gửi tin nhắn mới thay thế.`);
        const sentMsg = await sendMenuMessage(chatId, message, {
            parse_mode: 'HTML',
            reply_markup: { inline_keyboard } 
        });
        user.waitingFor = 'CHO_XAC_NHAN';
        saveData();
    }
}
async function thucHienMuaKey(chatId, stateData) {
    const user = db.users[chatId];
    const config = KEY_CONFIG[stateData.keyId];
    
    if (user.balance < stateData.finalPrice) {
        await sendImportantMessage(chatId, '<b>Số dư không đủ. Vui lòng nạp thêm tiền. ❌</b>', { parse_mode: 'HTML' }, 7000);
        await sendMainMenu(chatId);
        return;
    }

    user.balance -= stateData.finalPrice;
    
    const newExpiryDateStr = activateUserKey(user, config.days);
    
    user.waitingFor = null;
    user.currentKeyPurchase = null;
    
    const response = `
<b>MUA KEY THÀNH CÔNG! 🎉</b>
Đã trừ <i>${formatPrice(stateData.finalPrice)}</i> từ số dư.
Loại Key: <i>${config.duration}</i>
Hạn Dùng Mới: <b>${newExpiryDateStr}</b>
Số Dư Còn Lại: <i>${formatPrice(user.balance)}</i>
    `;
    await sendImportantMessage(chatId, response, { parse_mode: 'HTML' });
    await sendMainMenu(chatId);
}

async function sendAdminMenu(chatId) {
    if (!isAdmin(chatId)) {
        await sendImportantMessage(chatId, '<b>Bạn không có quyền truy cập Quản Trị Viên. 🚫</b>', { parse_mode: 'HTML' }, 5000);
        return;
    }
    stopRunningGameForUser(chatId);
    await sendMenuMessage(chatId, '<b>CHỌN CHỨC NĂNG ADMIN ⚙️:</b>', { parse_mode: 'HTML', reply_markup: getAdminReplyKeyboard(isMasterAdmin(chatId)) });
}
async function sendCreateKeyMenu(chatId) {
    await sendMenuMessage(chatId, '<b>CHỌN LOẠI KEY MUỐN TẠO 🔑:</b>', { parse_mode: 'HTML', reply_markup: getCreateKeyInlineKeyboard() });
}
async function taoKeyFinal(chatId, keyType) {
    const config = KEY_CONFIG[keyType];
    if (!config) return;

    const newKey = Math.random().toString(36).substring(2, 10).toUpperCase();
    db.keys[newKey] = {
        value: newKey,
        type: keyType,
        days: config.days,
        is_used: false,
        created_by: chatId,
        note: `Tạo bởi Admin ${chatId}`, 
        created_at: new Date().toISOString()
    };
    saveData();
    
    const response = `
<b>TẠO KEY THÀNH CÔNG! ✨</b>
Loại Key: <i>${config.duration}</i>
🔑 KEY: <b>${newKey}</b>
Thời hạn: <i>${config.duration}</i>
-----------------------------
(Tin nhắn này sẽ tự động xóa sau 10 giây)
`;
    await sendImportantMessage(chatId, response, { parse_mode: 'HTML' });
    
    await sendAdminMenu(chatId);
}

async function sendAdminActionsMenu(chatId) {
    const isMaster = isMasterAdmin(chatId);
    await sendMenuMessage(chatId, '<b>CHỌN TÁC VỤ KHÁC 🔄:</b>', { parse_mode: 'HTML', reply_markup: getAdminActionsReplyKeyboard(isMaster) });
}
async function handleAdminConversation(msg) {
    const chatId = String(msg.chat.id);
    const text = msg.text.trim();
    const user = db.users[chatId];
    const messageId = msg.message_id;

    await safeDeleteMessage(chatId, messageId); 

    const waitingFor = user.waitingFor;
    
    const resetStateAndReply = async (message, keyboardFunc = getAdminReplyKeyboard) => {
        user.waitingFor = null;
        user.adminStates = {};
        saveData();
        await sendMenuMessage(chatId, message, { 
            parse_mode: 'HTML', reply_markup: keyboardFunc(isMasterAdmin(chatId))
        });
    }

    if (waitingFor === 'admin_waiting_for_broadcast') {
        user.waitingFor = null; 
        user.adminStates = {};
        saveData(); 

        let successCount = 0;
        let failCount = 0;
        
        const safeText = text.replace(/</g, '&lt;').replace(/>/g, '&gt;');

        for (const uid in db.users) {
            try {
                if (uid !== MASTER_ADMIN_ID_STR) {
                    await bot.sendMessage(uid, `<b>THÔNG BÁO TỪ ADMIN 📢</b>\n\n${safeText}`, { parse_mode: 'HTML' });
                    successCount++;
                }
            } catch (e) {
                failCount++;
            }
        }
        await resetStateAndReply(`Broadcast hoàn tất! ✅\nThành công: <b>${successCount}</b>\nThất bại: <b>${failCount}</b>`);
    } else if (waitingFor === 'admin_waiting_for_discount_code') {
        const parts = text.split(',');
        
        if (parts.length === 2) {
            const discountCode = parts[0].trim().toUpperCase();
            const percentage = parseInt(parts[1].trim());

            if (discountCode.match(/^[A-Z0-9]+$/) && percentage >= 1 && percentage <= 100) {
                db.discountCodes[discountCode] = {
                    code: discountCode,
                    percentage: percentage,
                    is_active: true
                };
                saveData();
                await resetStateAndReply(`Đã tạo Mã Giảm Giá thành công! 🎁\nMã: <b>${discountCode}</b>\nGiảm: <i>${percentage}%</i>`);
            } else {
                await resetStateAndReply('Sai cú pháp, tên mã chứa ký tự đặc biệt, hoặc phần trăm không hợp lệ (1-100). Vui lòng nhập lại (vd: SALE50,15).', getAdminReplyKeyboard);
            }
        } else {
             await resetStateAndReply('Sai cú pháp. Vui lòng nhập Mã và % giảm, cách nhau bởi dấu phẩy (vd: TET2025,15).', getAdminReplyKeyboard);
        }
    } else if (waitingFor === 'admin_waiting_for_balance_user_id') {
        const targetUserId = text;
        const targetUser = db.users[targetUserId];

        if (!targetUser) {
            await resetStateAndReply(`Không tìm thấy người dùng có ID <b>${targetUserId}</b>. Vui lòng thử lại. 🚫`, getAdminActionsReplyKeyboard);
            return;
        }
        
        user.waitingFor = 'admin_waiting_for_balance_amount';
        user.adminStates = { targetUserId: targetUserId }; 
        saveData();

        await bot.sendMessage(chatId, `User: <b>${targetUserId}</b> | Số dư hiện tại: <i>${formatPrice(targetUser.balance)}</i>\n\nVui lòng nhập số tiền muốn <b>CỘNG</b> hoặc <b>TRỪ</b> (VD: 50000, -20000):`, { parse_mode: 'HTML' });
    } else if (waitingFor === 'admin_waiting_for_balance_amount') {
        const targetUserId = user.adminStates.targetUserId;
        const amount = parseInt(text);

        const targetUser = db.users[targetUserId];
        
        if (isNaN(amount) || !targetUser) {
            await resetStateAndReply('Lỗi: Số tiền không hợp lệ hoặc User không tồn tại.', getAdminActionsReplyKeyboard);
            return;
        }

        targetUser.balance += amount;
        if (targetUser.balance < 0) targetUser.balance = 0;
        
        saveData();
        
        await resetStateAndReply(`Thành công! 🎉\nĐã ${amount > 0 ? 'cộng' : 'trừ'} <b>${formatPrice(Math.abs(amount))}</b> cho user <b>${targetUserId}</b>\nSố dư mới: <b>${formatPrice(targetUser.balance)}</b>`, getAdminActionsReplyKeyboard);

        try {
            await bot.sendMessage(targetUserId, `<b>THÔNG BÁO VỀ SỐ DƯ 💰</b>\nAdmin đã ${amount > 0 ? 'cộng' : 'trừ'} <b>${formatPrice(Math.abs(amount))}</b> vào tài khoản của bạn.\nSố dư mới: <b>${formatPrice(targetUser.balance)}</b>`, { parse_mode: 'HTML' });
        } catch (e) {}
    } else if (waitingFor === 'admin_waiting_for_grant_id') {
        const targetId = text;
        if (isMasterAdmin(targetId)) {
             await resetStateAndReply('Không thể cấp quyền cho Chủ Bot. 👑', getAdminActionsReplyKeyboard);
             return;
        }
        if (!db.adminIds.includes(targetId)) {
            db.adminIds.push(targetId);
            saveData();
            await resetStateAndReply(`Đã cấp quyền Admin cho ID <b>${targetId}</b>. ✅`, getAdminActionsReplyKeyboard);
            try { await bot.sendMessage(targetId, '<b>Bạn đã được cấp quyền Admin!</b> Vui lòng gõ /start để thấy Menu Admin.', { parse_mode: 'HTML' }); } catch (e) {}
        } else {
             await resetStateAndReply(`ID <b>${targetId}</b> đã là Admin. Vui lòng nhập ID khác.`, getAdminActionsReplyKeyboard);
        }
    } else if (waitingFor === 'admin_waiting_for_revoke_id') {
        const targetId = text;
        if (isMasterAdmin(targetId)) {
             await resetStateAndReply('Không thể thu quyền Chủ Bot. 👑', getAdminActionsReplyKeyboard);
             return;
        }
        const index = db.adminIds.indexOf(targetId);
        if (index > -1) {
            db.adminIds.splice(index, 1);
            saveData();
            await resetStateAndReply(`Đã thu hồi quyền Admin của ID <b>${targetId}</b>. 🗑️`, getAdminActionsReplyKeyboard);
            try { await bot.sendMessage(targetId, '<b>Quyền Admin của bạn đã bị thu hồi.</b>', { parse_mode: 'HTML' }); } catch (e) {}
        } else {
             await resetStateAndReply(`ID <b>${targetId}</b> không phải là Admin. Vui lòng nhập ID khác.`, getAdminActionsReplyKeyboard);
        }
    }
}
async function sendUserList(chatId) {
    const users = Object.values(db.users).sort((a, b) => b.lastActive - a.lastActive);
    let message = '<b>DANH SÁCH USER 👥</b> (Top 20 hoạt động gần nhất)\n\n';
    
    users.slice(0, 20).forEach((user, index) => {
        const expiry = user.expiryDate === 'Vĩnh Viễn' ? '<i>Vĩnh Viễn</i>' : (user.expiryDate ? `<i>${new Date(user.expiryDate).toLocaleDateString('vi-VN')}</i>` : 'N/A');
        const status = isKeyActive(user) ? '✅' : '❌'; 
        const firstName = user.first_name || 'Khách';

        message += `${index + 1}. ID: <b>${user.chatId}</b> | Tên: ${firstName} | Số dư: <i>${formatPrice(user.balance || 0)}</i> | TT: ${status} | HSD: ${expiry}\n`;
    });
    
    message += `\nTổng số user: <b>${users.length}</b>`;

    await sendMenuMessage(chatId, message, { 
        parse_mode: 'HTML', reply_markup: getAdminReplyKeyboard(isMasterAdmin(chatId)) 
    });
}
// ------------------------------------------------------------------------------
//                        EVENT HANDLERS & EXPRESS WEBHOOK
// ------------------------------------------------------------------------------

bot.onText(/\/start/, async (msg) => {
    const chatId = String(msg.chat.id);
    const user = ensureUserState(chatId, msg);
    
    user.waitingFor = null;
    user.adminStates = {};
    saveData();

    await safeDeleteMessage(chatId, msg.message_id); 
    await sendMainMenu(chatId, true);
});

bot.on('message', async (msg) => {
    const chatId = String(msg.chat.id);
    const text = msg.text;
    
    if (!text) return; 

    const user = ensureUserState(chatId, msg);
    const isAdminUser = isAdmin(chatId);
    
    if (!text.startsWith('/start') && !user.waitingFor) {
        await safeDeleteMessage(chatId, msg.message_id);
    }
    
    // Xử lý nút quay lại
    if (text === '⬅️ Quay Lại Menu Game' || text === '⬅️ Quay Lại Menu Chính' || (text === '⬅️ Quay lại Admin Panel' && isAdminUser)) {
        await safeDeleteMessage(chatId, msg.message_id);
        
        if (text === '⬅️ Quay Lại Menu Game') {
            stopRunningGameForUser(chatId);
            await menuChonGame(chatId);
        } else if (text === '⬅️ Quay Lại Menu Chính') {
            stopRunningGameForUser(chatId);
            await sendMainMenu(chatId);
        } else if (text === '⬅️ Quay lại Admin Panel') {
            await sendAdminMenu(chatId);
        }
        return;
    }
    
    // Xử lý nút chọn game cụ thể 
    const gameKey = Object.keys(NAMES).find(key => `${GAME_ICONS[key]} ${NAMES[key]}` === text);
    if (gameKey) {
        await safeDeleteMessage(chatId, msg.message_id); 
        stopRunningGameForUser(chatId); 

        if (isKeyActive(user)) { 
            await startGamePolling(chatId, gameKey);
        } else {
            await sendImportantMessage(chatId, 'Key đã hết hạn hoặc chưa kích hoạt. Vui lòng mua Key mới hoặc nhập Key để sử dụng Tool. 🔑', { parse_mode: 'HTML' }, 7000);
            await sendMainMenu(chatId);
        }
        return;
    }

    // Xử lý Conversation (nếu đang chờ nhập liệu)
    if (user.waitingFor) {
        if (isAdminUser && user.waitingFor.startsWith('admin_')) {
             await handleAdminConversation(msg); 
             return;
        } else {
            // Chỉ gọi handleConversation cho các trạng thái không phải Admin (chủ yếu là Key, Mã giảm giá)
            if (user.waitingFor === 'CHO_NHAP_KEY' || user.waitingFor === 'CHO_MA_GIAM_GIA_INPUT') {
                 await handleConversation(msg); 
            } else {
                 await safeDeleteMessage(chatId, msg.message_id);
                 await sendImportantMessage(chatId, 'Đã hủy thao tác không hợp lệ. Vui lòng chọn lại chức năng.', { parse_mode: 'HTML' }, 5000);
                 await sendMainMenu(chatId);
            }
            return;
        }
    }

    // Xử lý các nút lệnh thông thường 
    switch (text) {
        case "👤 Thông tin tài khoản":
            await infoTkHandler(chatId);
            break;
        
        case "🔑 Key": // Nút Key, dẫn đến menu con
            await keyMenuHandler(chatId);
            break;
        case "🔑 Nhập Key":
            user.waitingFor = 'CHO_NHAP_KEY';
            await sendMenuMessage(chatId, '<b>Nhập Key 🔑</b>\n\nVui lòng gửi mã Key của bạn:', { parse_mode: 'HTML' });
            saveData();
            break;
        case "💰 Mua Key":
            const keyBuyMsg = await sendMenuMessage(chatId, '<b>Chuyển đến màn hình Mua Key...</b>', { parse_mode: 'HTML' });
            if (keyBuyMsg) {
                await chonKeyMua(chatId, keyBuyMsg.message_id);
            }
            break;
            
        case "❓ Liên hệ Admin":
            await hoTroHandler(chatId);
            break;
        
        case "⚡️ CHƠI GAME DỰ ĐOÁN 🎲": 
            if (isKeyActive(user)) {
                await menuChonGame(chatId); 
            } else {
                 await sendImportantMessage(chatId, 'Key đã hết hạn hoặc chưa kích hoạt. Vui lòng mua Key mới hoặc nhập Key để sử dụng Tool. 🔑', { parse_mode: 'HTML' }, 7000);
                 await sendMainMenu(chatId);
            }
            break;
        case "🎰 TÀI XỈU":
            await sendMenuMessage(chatId, '<b>CHỌN GAME TÀI XỈU 🎰:</b>', { parse_mode: 'HTML', reply_markup: getGameSubMenu('TÀI XỈU') });
            break;
        case "🎲 SICBO":
            await sendMenuMessage(chatId, '<b>CHỌN GAME SICBO 🎲:</b>', { parse_mode: 'HTML', reply_markup: getGameSubMenu('SICBO') });
            break;
        case "🧮 MD5":
            await sendMenuMessage(chatId, '<b>CHỌN GAME MD5 🧮:</b>', { parse_mode: 'HTML', reply_markup: getGameSubMenu('MD5') });
            break;

        case "⚙️ Admin Panel":
            if (isAdminUser) await sendAdminMenu(chatId);
            break;
        case "🔑 Tạo Key":
            if (isAdminUser) await sendCreateKeyMenu(chatId);
            break;
        case "🎁 Tạo Mã Giảm Giá":
            if (isAdminUser) {
                user.waitingFor = 'admin_waiting_for_discount_code';
                await sendMenuMessage(chatId, '<b>Vui lòng nhập TÊN MÃ GIẢM GIÁ và % giảm, cách nhau bởi dấu phẩy (VD: SALE50,15). Gõ /start để hủy.</b>', { 
                    parse_mode: 'HTML', reply_markup: getAdminReplyKeyboard(isMasterAdmin(chatId)) 
                });
                saveData();
            }
            break;
        case "📢 Thông Báo Chung":
            if (isAdminUser) {
                user.waitingFor = 'admin_waiting_for_broadcast';
                await sendMenuMessage(chatId, '<b>Vui lòng nhập nội dung muốn Broadcast đến tất cả user. Gõ /start để hủy.</b>', { 
                    parse_mode: 'HTML', reply_markup: getAdminReplyKeyboard(isMasterAdmin(chatId)) 
                });
                saveData();
            }
            break;
        case "📊 Danh Sách User":
            if (isAdminUser) await sendUserList(chatId);
            break;
        case "🔄 Tác Vụ Khác":
            if (isAdminUser) await sendAdminActionsMenu(chatId);
            break;
        case "💰 Cộng/Trừ Số Dư":
            if (isAdminUser) {
                user.waitingFor = 'admin_waiting_for_balance_user_id';
                await sendMenuMessage(chatId, '<b>Vui lòng nhập ID Telegram của người dùng bạn muốn thay đổi số dư. Gõ /start để hủy.</b>', { 
                    parse_mode: 'HTML', reply_markup: getAdminActionsReplyKeyboard(isMasterAdmin(chatId)) 
                });
                saveData();
            }
            break;
        case "👑 Cấp Quyền Admin":
        case "🗑️ Thu Quyền Admin":
            if (isMasterAdmin(chatId)) {
                const action = text === "👑 Cấp Quyền Admin" ? 'grant' : 'revoke';
                user.waitingFor = `admin_waiting_for_${action}_id`;
                const prompt = action === 'grant' 
                    ? '<b>Vui lòng nhập ID Telegram của người dùng bạn muốn cấp quyền Admin. Gõ /start để hủy.</b>'
                    : '<b>Vui lòng nhập ID Telegram của Admin bạn muốn thu quyền. KHÔNG NHẬP ID CỦA CHỦ BOT. Gõ /start để hủy.</b>';
                await sendMenuMessage(chatId, prompt, { 
                    parse_mode: 'HTML', reply_markup: getAdminActionsReplyKeyboard(true) 
                });
                saveData();
            }
            break;
        default:
            break;
    }
});
bot.on('callback_query', async (callbackQuery) => {
    const message = callbackQuery.message;
    const chatId = String(message.chat.id);
    const data = callbackQuery.data;
    const user = db.users[chatId];
    
    bot.answerCallbackQuery(callbackQuery.id).catch(e => {}); 

    if (!user) return;

    if (isAdmin(chatId) && data.startsWith('admin_')) { 
        await handleAdminCallback(callbackQuery);
        return;
    }
    
    
    if (user.waitingFor === 'CHON_KEY_MUA' && data.startsWith('buykey_')) {
        const keyId = data.split('_')[1];
        await xacNhanMuaKey(chatId, message.message_id, keyId);
    } else if (user.waitingFor === 'CHO_XAC_NHAN') {
        const stateData = user.currentKeyPurchase;
        if (!stateData) {
            await sendMainMenu(chatId); 
            return;
        }

        if (data === 'confirm_mua') {
            await safeDeleteMessage(chatId, message.message_id); 
            await thucHienMuaKey(chatId, stateData);
        } else if (data === 'nhap_ma_giam_gia') {
            user.waitingFor = 'CHO_MA_GIAM_GIA_INPUT'; 
            await safeDeleteMessage(chatId, message.message_id); 
            await bot.sendMessage(chatId, '<b>Vui lòng gửi Mã Giảm Giá của bạn 💲:</b>', { parse_mode: 'HTML' });
            saveData();
        }
    } else if (data === 'cancel_mua') {
        user.waitingFor = null;
        user.currentKeyPurchase = null;
        await safeDeleteMessage(chatId, message.message_id); 
        await sendImportantMessage(chatId, '<b>Đã hủy quá trình mua Key. ❌</b>', { parse_mode: 'HTML' }, 3000); 
        await sendMainMenu(chatId); 
        saveData();
    }
});
async function handleAdminCallback(callbackQuery) {
    const message = callbackQuery.message;
    const chatId = String(message.chat.id);
    const data = callbackQuery.data;
    const user = db.users[chatId];
    
    bot.answerCallbackQuery(callbackQuery.id).catch(e => {}); 

    if (!user) return;

    if (!isAdmin(chatId)) { 
         await bot.sendMessage(chatId, '<b>Bạn không có quyền truy cập chức năng Admin. 🚫</b>', { parse_mode: 'HTML' });
         return;
    }

    if (data.startsWith('admin_create_key_')) {
        const keyType = data.split('_')[3];
        
        await safeDeleteMessage(chatId, message.message_id); 
        await taoKeyFinal(chatId, keyType);

    } else if (data === 'admin_back_to_panel') {
        await safeDeleteMessage(chatId, message.message_id);
        await sendAdminMenu(chatId);
    } 
}

// ------------------------------------------------------------------------------
//                        BƯỚC 3: EXPRESS WEBHOOK LISTENER
// ------------------------------------------------------------------------------

const app = express();
// Sử dụng body-parser.json() để xử lý payload JSON từ Telegram Webhook
app.use(bodyParser.json()); 

/**
 * Endpoint để Telegram gửi Updates
 */
app.post(WEBHOOK_PATH, (req, res) => {
    // Phải phản hồi 200 OK ngay lập tức
    bot.processUpdate(req.body); 
    res.sendStatus(200); 
});

// ------------------------------------------------------------------------------
//                        KHỞI ĐỘNG BOT VÀ SERVER
// ------------------------------------------------------------------------------

loadData(); 
console.log("Database đã tải và cấu trúc mới đã được áp dụng.");

// Khởi động Express Server cho Webhook
app.listen(WEBHOOK_PORT, () => {
    console.log(`[EXPRESS] Webhook server đang chạy trên cổng ${WEBHOOK_PORT}`);
    if (WEBHOOK_URL === 'YOUR_RENDER_PUBLIC_URL_HERE') {
        console.log(`[QUAN TRỌNG] HÃY NHỚ: Thay thế 'YOUR_RENDER_PUBLIC_URL_HERE' bằng URL công khai của Render!`);
    }
});

console.log(`MASTER ADMIN ID: ${MASTER_ADMIN_ID_STR}`);
console.log("Bot Telegram Webhook đã khởi động thành công và sẵn sàng nhận lệnh!");

process.on('unhandledRejection', (reason, promise) => {
    if (!String(reason).includes('message is not modified')) {
        console.error('*** [UNHANDLED REJECTION ĐÃ BỊ BẮT] ***');
        console.error('Reason:', reason);
        console.error('Promise:', promise);
    }
});
