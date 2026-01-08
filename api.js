const WebSocket = require("ws");
const crypto = require("crypto");

const WS_URL = "wss://websocket.atpman.net/websocket";

// Thông tin đăng nhập - THAY THẾ BẰNG INFO CỦA MÀY
const USER_INFO = {
    "ipAddress": "42.119.251.105",
    "wsToken": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJnZW5kZXIiOjAsImNhblZpZXdTdGF0IjpmYWxzZSwiZGlzcGxheU5hbWUiOiJzdm5oYWNhaWxvbCIsImJvdCI6MCwiaXNNZXJjaGFudCI6ZmFsc2UsInZlcmlmaWVkQmFua0FjY291bnQiOmZhbHNlLCJwbGF5RXZlbnRMb2JieSI6ZmFsc2UsImN1c3RvbWVySWQiOjUzNzkxNjM2LCJhZmZJZCI6Ijc4OSIsImJhbm5lZCI6ZmFsc2UsImJyYW5kIjoiNzg5LmNsdWIiLCJ0aW1lc3RhbXAiOjE3NjcxNjY2NTQzODIsImxvY2tHYW1lcyI6W10sImFtb3VudCI6MCwibG9ja0NoYXQiOmZhbHNlLCJwaG9uZVZlcmlmaWVkIjp0cnVlLCJpcEFkZHJlc3MiOiI0Mi4xMTkuMjUxLjEwNSIsIm11dGUiOmZhbHNlLCJhdmF0YXIiOiJodHRwczovL2FwaS54ZXVpLmlvL2ltYWdlcy9hdmF0YXIvYXZhdGFyXzI2LnBuZyIsInBsYXRmb3JtSWQiOjUsInVzZXJJZCI6IjFiMzJhNmNmLTRjYmEtNDdiNi1iMWQ3LTExMDcxYzIxNWRlYiIsInJlZ1RpbWUiOjE3NDM1NDYyNTQyMjksInBob25lIjoiODQ5ODMyOTQwNDMiLCJkZXBvc2l0Ijp0cnVlLCJ1c2VybmFtZSI6IlM4X3F1YXBpdCJ9.T22euKpVlmWKmjyC5d-uR5r7RhIYEyi66gUZOLGYKt8",
    "locale": "vi",
    "userId": "1b32a6cf-4cba-47b6-b1d7-11071c215deb",
    "username": "S8_quapit",
    "timestamp": 1767166654382,
    "refreshToken": "033163fe6d0941f1955e532b63974540.b2ed22a9a6764241b680e70e10902f49"
};

const SIGNATURE = "696FC7AE382F462501190719DDEFBE92CBA05BC0BE91DBEC64DDBD2DD17913DB082B1DBF37AD85165C3BA2F4DDC7E6E16F2530BE2A33CFCF83203B278633C42B78E11B2F1F1CDC98728E3945BA8DEE74C4B9FEEB79DAAAEFCCB20B8430C2BFA105C5326C23F5D98BC4FC02E315E180CFB7F499F95F345482676B1C9E42D7C4D9";

let ws;
let lastSid = null;
let isAuthenticated = false;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;
let autoReconnectInterval = null;
const AUTO_RECONNECT_DELAY = 7000; // 7 giây

function generateSignature(info, secretKey = "") {
    // Hàm generate signature nếu cần tạo mới
    const data = JSON.stringify(info);
    const hmac = crypto.createHmac("sha256", secretKey);
    hmac.update(data);
    return hmac.digest("hex").toUpperCase();
}

function setupAutoReconnect() {
    // Dừng interval cũ nếu có
    if (autoReconnectInterval) {
        clearInterval(autoReconnectInterval);
        autoReconnectInterval = null;
    }
    
    // Thiết lập auto-reconnect mỗi 7 giây
    autoReconnectInterval = setInterval(() => {
        if (ws && ws.readyState === WebSocket.OPEN) {
            // WebSocket đang mở, không cần reconnect
            return;
        }
        
        console.log(`[${new Date().toLocaleTimeString()}] 🔄 Auto-reconnect triggered (every 7s)...`);
        
        // Đóng kết nối cũ nếu tồn tại
        if (ws) {
            try {
                ws.removeAllListeners();
                ws.close();
            } catch (e) {
                // Bỏ qua lỗi khi đóng
            }
        }
        
        // Kết nối lại
        connect();
    }, AUTO_RECONNECT_DELAY);
    
    console.log(`[${new Date().toLocaleTimeString()}] ✅ Auto-reconnect enabled (every 7s)`);
}

function connect() {
    console.log(`[${new Date().toLocaleTimeString()}] 🔄 Đang kết nối WebSocket...`);
    
    ws = new WebSocket(WS_URL);

    ws.on("open", () => {
        console.log(`[${new Date().toLocaleTimeString()}] ✅ WebSocket connected`);
        reconnectAttempts = 0;
        
        // Gửi authentication message
        const authMessage = [
            1,
            "MiniGame",
            "quapit",
            "Hung2010a",
            {
                "info": JSON.stringify(USER_INFO),
                "signature": SIGNATURE
            }
        ];
        
        console.log(`[${new Date().toLocaleTimeString()}] 📤 Gửi authentication...`);
        ws.send(JSON.stringify(authMessage));
        
        // Gửi message join lobby sau 1s
        setTimeout(() => {
            if (ws.readyState === WebSocket.OPEN) {
                console.log(`[${new Date().toLocaleTimeString()}] 📤 Join lobby...`);
                ws.send(JSON.stringify([
                    6,
                    "MiniGame",
                    "lobbyPlugin",
                    { cmd: 10001 }
                ]));
            }
        }, 1000);
        
        // Gửi message subscribe Tài Xỉu sau 2s
        setTimeout(() => {
            if (ws.readyState === WebSocket.OPEN) {
                console.log(`[${new Date().toLocaleTimeString()}] 📤 Subscribe Tài Xỉu...`);
                ws.send(JSON.stringify([
                    6,
                    "MiniGame",
                    "taixiuUnbalancedPlugin",
                    { cmd: 2000 }
                ]));
            }
        }, 2000);
    });

    ws.on("message", (data) => {
        try {
            const msg = JSON.parse(data.toString());
            
            if (!Array.isArray(msg)) return;
            
            // Xử lý authentication response
            if (msg[0] === 1 && msg[2] === "auth") {
                const authResult = msg[4];
                if (authResult && authResult.success) {
                    isAuthenticated = true;
                    console.log(`[${new Date().toLocaleTimeString()}] 🔐 Authentication SUCCESS`);
                    console.log(`[${new Date().toLocaleTimeString()}] 👤 User: ${USER_INFO.username}`);
                    console.log(`[${new Date().toLocaleTimeString()}] 💰 Balance: ${authResult.balance || 0}`);
                } else {
                    console.log(`[${new Date().toLocaleTimeString()}] ❌ Authentication FAILED:`, authResult?.message || "Unknown error");
                }
                return;
            }
            
            // Xử lý lobby response
            if (msg[1] && msg[1].cmd === 10002) {
                console.log(`[${new Date().toLocaleTimeString()}] 🏠 Lobby info received`);
                return;
            }
            
            // Xử lý Tài Xỉu result
            if (msg[1] && msg[1].cmd === 2006) {
                const { sid, d1, d2, d3 } = msg[1];
                
                if (sid === lastSid) return;
                lastSid = sid;
                
                const total = d1 + d2 + d3;
                const result = total >= 11 ? "TAI" : "XIU";
                const isTai = result === "TAI";
                
                // Thống kê chuỗi
                const streak = getStreak(result);
                
                console.log(`[${new Date().toLocaleTimeString()}] 🎲 PHIÊN ${sid}`);
                console.log(`   🎯 XÚC XẮC: ${d1}-${d2}-${d3}`);
                console.log(`   📊 TỔNG: ${total} (${result})`);
                console.log(`   📈 CHUỖI: ${streak.current} ${result} (Max: ${streak.max})`);
                
                // Gợi ý đặt cược dựa trên chuỗi
                if (streak.current >= 3) {
                    console.log(`   💡 GỢI Ý: Chuỗi ${result} đã ${streak.current} lần, cân nhắc đặt ngược lại`);
                }
                
                // Log chi tiết vào file
                logToFile({
                    timestamp: new Date().toISOString(),
                    session: sid,
                    dice: [d1, d2, d3],
                    total: total,
                    result: result,
                    streak: streak.current
                });
                
                return;
            }
            
            // Xử lý các message khác
            if (msg[1] && msg[1].cmd) {
                console.log(`[${new Date().toLocaleTimeString()}] 📥 Message cmd ${msg[1].cmd}:`, 
                    JSON.stringify(msg[1]).substring(0, 100) + "...");
            }
            
        } catch (error) {
            console.log(`[${new Date().toLocaleTimeString()}] ❌ Parse error:`, error.message);
        }
    });

    ws.on("close", (code, reason) => {
        console.log(`[${new Date().toLocaleTimeString()}] ❌ WebSocket closed:`, code, reason || "");
        isAuthenticated = false;
        
        reconnectAttempts++;
        if (reconnectAttempts > MAX_RECONNECT_ATTEMPTS) {
            console.log(`[${new Date().toLocaleTimeString()}] 🚫 Max reconnect attempts reached`);
            return;
        }
        
        const delay = Math.min(3000 * reconnectAttempts, 30000); // Exponential backoff
        console.log(`[${new Date().toLocaleTimeString()}] 🔄 Reconnect in ${delay/1000}s (attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`);
        setTimeout(connect, delay);
    });

    ws.on("error", (error) => {
        console.log(`[${new Date().toLocaleTimeString()}] ❌ WebSocket error:`, error.message);
    });
}

// Biến thống kê chuỗi
let streakStats = {
    current: 0,
    lastResult: null,
    max: 0,
    taiCount: 0,
    xiuCount: 0
};

function getStreak(result) {
    if (result === streakStats.lastResult) {
        streakStats.current++;
    } else {
        streakStats.current = 1;
        streakStats.lastResult = result;
    }
    
    if (streakStats.current > streakStats.max) {
        streakStats.max = streakStats.current;
    }
    
    if (result === "TAI") {
        streakStats.taiCount++;
    } else {
        streakStats.xiuCount++;
    }
    
    return {
        current: streakStats.current,
        max: streakStats.max,
        tai: streakStats.taiCount,
        xiu: streakStats.xiuCount
    };
}

function logToFile(data) {
    const fs = require("fs");
    const logDir = "./logs";
    
    if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
    }
    
    const today = new Date().toISOString().split("T")[0];
    const logFile = `${logDir}/taixiu_${today}.json`;
    
    let logs = [];
    if (fs.existsSync(logFile)) {
        try {
            logs = JSON.parse(fs.readFileSync(logFile, "utf8"));
        } catch (e) {
            logs = [];
        }
    }
    
    logs.push(data);
    
    // Giữ tối đa 1000 bản ghi mỗi file
    if (logs.length > 1000) {
        logs = logs.slice(-1000);
    }
    
    fs.writeFileSync(logFile, JSON.stringify(logs, null, 2), "utf8");
}

function showStats() {
    console.log("\n" + "=".repeat(50));
    console.log("📊 THỐNG KÊ TÀI XỈU");
    console.log("=".repeat(50));
    console.log(`Tài: ${streakStats.taiCount} lần`);
    console.log(`Xỉu: ${streakStats.xiuCount} lần`);
    console.log(`Tổng: ${streakStats.taiCount + streakStats.xiuCount} phiên`);
    console.log(`Chuỗi max: ${streakStats.max} lần`);
    console.log(`Tỉ lệ Tài/Xỉu: ${(streakStats.taiCount/(streakStats.xiuCount||1)).toFixed(2)}`);
    console.log("=".repeat(50));
}

// Auto-betting bot (tùy chọn)
class TaiXiuBot {
    constructor() {
        this.balance = 1000; // Số dư giả định
        this.betAmount = 100; // Số tiền đặt mỗi lần
        this.betHistory = [];
        this.currentStrategy = "martingale"; // martingale, fibonacci, etc.
    }
    
    predictNext() {
        // Dự đoán dựa trên chuỗi
        if (streakStats.current >= 3) {
            return streakStats.lastResult === "TAI" ? "XIU" : "TAI";
        }
        return Math.random() > 0.5 ? "TAI" : "XIU";
    }
    
    placeBet(prediction) {
        const bet = {
            timestamp: new Date(),
            amount: this.betAmount,
            prediction: prediction,
            actual: null,
            win: false
        };
        
        this.betHistory.push(bet);
        this.balance -= this.betAmount;
        
        console.log(`[BOT] Đặt ${this.betAmount} vào ${prediction}`);
        
        return bet;
    }
    
    settleBet(result) {
        if (this.betHistory.length === 0) return;
        
        const lastBet = this.betHistory[this.betHistory.length - 1];
        lastBet.actual = result;
        
        if (lastBet.prediction === result) {
            lastBet.win = true;
            this.balance += this.betAmount * 1.95; // Giả định tỉ lệ 1.95
            console.log(`[BOT] THẮNG! +${this.betAmount * 0.95}`);
        } else {
            console.log(`[BOT] THUA! -${this.betAmount}`);
        }
        
        console.log(`[BOT] Số dư: ${this.balance}`);
    }
}

// Command line interface
const readline = require("readline");
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

let bot = null;

function handleCommand(input) {
    const args = input.trim().split(" ");
    const command = args[0].toLowerCase();
    
    switch(command) {
        case "stats":
            showStats();
            break;
            
        case "bot":
            if (args[1] === "start") {
                bot = new TaiXiuBot();
                console.log("[BOT] Bot đã khởi động");
            } else if (args[1] === "stop") {
                bot = null;
                console.log("[BOT] Bot đã dừng");
            } else if (args[1] === "status") {
                console.log("[BOT]", bot ? "Đang chạy" : "Đã dừng");
            }
            break;
            
        case "balance":
            console.log(`[INFO] Số dư: ${bot?.balance || "N/A"}`);
            break;
            
        case "reconnect":
            console.log("[INFO] Đang reconnect...");
            if (ws) ws.close();
            setTimeout(connect, 1000);
            break;
            
        case "autoreconnect":
            if (args[1] === "on") {
                setupAutoReconnect();
            } else if (args[1] === "off") {
                if (autoReconnectInterval) {
                    clearInterval(autoReconnectInterval);
                    autoReconnectInterval = null;
                    console.log("[INFO] Auto-reconnect disabled");
                }
            } else if (args[1] === "status") {
                console.log("[INFO] Auto-reconnect:", autoReconnectInterval ? "ON (every 7s)" : "OFF");
            }
            break;
            
        case "clear":
            console.clear();
            break;
            
        case "help":
            console.log(`
📋 DANH SÁCH LỆNH:
stats               - Xem thống kê
bot start           - Khởi động bot đặt cược
bot stop            - Dừng bot
bot status          - Trạng thái bot
balance             - Xem số dư bot
reconnect           - Reconnect WebSocket
autoreconnect on    - Bật auto-reconnect mỗi 7s
autoreconnect off   - Tắt auto-reconnect
autoreconnect status- Trạng thái auto-reconnect
clear               - Xóa màn hình
help                - Hiện help
exit                - Thoát
            `);
            break;
            
        case "exit":
            console.log("[INFO] Đang thoát...");
            // Dừng auto-reconnect
            if (autoReconnectInterval) {
                clearInterval(autoReconnectInterval);
            }
            if (ws) ws.close();
            rl.close();
            process.exit(0);
            break;
            
        default:
            console.log(`[ERROR] Lệnh không tồn tại: ${command}`);
            console.log("[INFO] Gõ 'help' để xem danh sách lệnh");
    }
}

// Start
console.log("🎮 TÀI XỈU WEBSOCKET CLIENT");
console.log("=".repeat(50));
console.log(`Server: ${WS_URL}`);
console.log(`User: ${USER_INFO.username}`);
console.log(`Auto-reconnect: Mỗi 7 giây`);
console.log("=".repeat(50));
console.log("[INFO] Gõ 'help' để xem danh sách lệnh\n");

// Khởi động kết nối và auto-reconnect
connect();
setupAutoReconnect(); // Bật auto-reconnect ngay khi khởi động

rl.on("line", handleCommand);

// Auto-save stats mỗi 5 phút
setInterval(() => {
    if (streakStats.taiCount + streakStats.xiuCount > 0) {
        const fs = require("fs");
        const statsFile = "./logs/stats.json";
        fs.writeFileSync(statsFile, JSON.stringify(streakStats, null, 2), "utf8");
    }
}, 300000);

// Clean exit
process.on("SIGINT", () => {
    console.log("\n[INFO] Received SIGINT, closing...");
    // Dừng auto-reconnect
    if (autoReconnectInterval) {
        clearInterval(autoReconnectInterval);
    }
    if (ws) ws.close();
    rl.close();
    process.exit(0);
});
