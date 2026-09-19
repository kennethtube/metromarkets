const express = require("express");
const cors = require("cors");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
    res.json({
        message: "MetroMarkets backend is running!"
    });
});

app.listen(PORT, () => {
    console.log(`MetroMarkets backend running on port ${PORT}`);
});

app.get("/api/test", (req, res) => {
    res.json({
        success: true,
        message: "Frontend successfully connected to the MetroMarkets backend!"
    });
});