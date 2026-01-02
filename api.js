const express = require("express");
const axios = require("axios");
const app = express();
const PORT = 3000;

// link API gốc
const SICBO_API = "https://sicbosunwin.onrender.com/api/sicbo/sunwin";

app.get("/api/taixiu", async (req, res) => {
  try {
    // gọi API thật
    const response = await axios.get(SICBO_API);
    const d = response.data;

    // map lại theo format mày yêu cầu
    const result = {
      id: "tiendat",
      Phien: d.Phien,
      Xuc_xac_1: d.Xuc_xac_1,
      Xuc_xac_2: d.Xuc_xac_2,
      Xuc_xac_3: d.Xuc_xac_3,
      Tong: d.Tong,
      Ket_qua: d.Ket_qua,
      phien_hien_tai: d.phien_hien_tai,
      du_doan: d.du_doan,
      dudoan_vi: d.dudoan_vi,
      do_tin_cay: d.do_tin_cay
    };

    return res.json(result);

  } catch (err) {
    console.error("Lỗi gọi API:", err.message);
    return res.status(500).json({ error: "Không lấy được dữ liệu" });
  }
});

app.listen(PORT, () => {
  console.log(`Server chạy trên http://localhost:${PORT}/api/taixiu`);
});
