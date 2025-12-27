const express = require("express");
const axios = require("axios");
const app = express();
const PORT = 3000;

app.get("/api/taixiu", async (req, res) => {
    try {
        const response = await axios.get(
            "https://d-predict.onrender.com/api/taixiu"
        );
        const data = response.data;
        const newData = {
            id: "tiến đạt",             
            Phien: data.Phien,
            Xuc_xac_1: data.Xuc_xac_1,
            Xuc_xac_2: data.Xuc_xac_2,
            Xuc_xac_3: data.Xuc_xac_3,
            Tong: data.Tong,
            Ket_qua: data.Ket_qua,
            Du_doan: data.Du_doan
        };

        res.json(newData);
    } catch (err) {
        res.status(500).json({
            error: true,
            message: "Không gọi được API",
            detail: err.message
        });
    }
});
app.listen(PORT, () => {
    console.log(`🚀 Server chạy tại http://localhost:${PORT}`);
});
