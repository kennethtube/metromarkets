const express = require("express");
const cors = require("cors");
const axios = require("axios");
const crypto = require("crypto");
const session = require("express-session");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
    origin: true,
    credentials: true
}));

app.set("trust proxy", 1);

app.use(express.json());

app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: true,
        httpOnly: true,
        sameSite: "none"
    }
}));

// -------------------------
// Basic routes
// -------------------------

app.get("/", (req, res) => {
    res.json({
        message: "MetroMarkets backend is running!"
    });
});

app.get("/api/test", (req, res) => {
    res.json({
        success: true,
        message: "Frontend successfully connected to the MetroMarkets backend!"
    });
});

// -------------------------
// Roblox OAuth
// -------------------------

app.get("/auth/roblox", (req, res) => {
    const state = crypto.randomBytes(32).toString("hex");

    const codeVerifier = crypto
        .randomBytes(32)
        .toString("base64url");

    const codeChallenge = crypto
        .createHash("sha256")
        .update(codeVerifier)
        .digest("base64url");

    req.session.oauthState = state;
    req.session.codeVerifier = codeVerifier;

    const params = new URLSearchParams({
        client_id: process.env.ROBLOX_CLIENT_ID,
        redirect_uri: process.env.ROBLOX_REDIRECT_URI,
        scope: "openid",
        response_type: "code",
        state: state,
        code_challenge: codeChallenge,
        code_challenge_method: "S256"
    });

    res.redirect(
        `https://apis.roblox.com/oauth/v1/authorize?${params.toString()}`
    );
});

// -------------------------
// Roblox OAuth callback
// -------------------------

app.get("/auth/roblox/callback", async (req, res) => {
    try {
        const { code, state } = req.query;

        if (!code || !state) {
            return res.status(400).send("Missing OAuth code or state.");
        }

        if (state !== req.session.oauthState) {
            return res.status(400).send("Invalid OAuth state.");
        }

        const codeVerifier = req.session.codeVerifier;

        if (!codeVerifier) {
            return res.status(400).send("Missing PKCE code verifier.");
        }

        const tokenResponse = await axios.post(
            "https://apis.roblox.com/oauth/v1/token",
            new URLSearchParams({
                client_id: process.env.ROBLOX_CLIENT_ID,
                client_secret: process.env.ROBLOX_CLIENT_SECRET,
                grant_type: "authorization_code",
                code: code,
                code_verifier: codeVerifier
            }).toString(),
            {
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded"
                }
            }
        );

        const accessToken = tokenResponse.data.access_token;

        const userResponse = await axios.get(
            "https://apis.roblox.com/oauth/v1/userinfo",
            {
                headers: {
                    Authorization: `Bearer ${accessToken}`
                }
            }
        );

        req.session.user = userResponse.data;

        delete req.session.oauthState;
        delete req.session.codeVerifier;

        res.redirect(
            "https://kennethtube.github.io/metromarkets/"
        );

    } catch (error) {
        console.error(
            "Roblox OAuth error:",
            error.response?.data || error.message
        );

        res.status(500).send("Roblox login failed.");
    }
});

// -------------------------
// Current logged-in user
// -------------------------

app.get("/api/me", (req, res) => {
    if (!req.session.user) {
        return res.json({
            loggedIn: false
        });
    }

    res.json({
        loggedIn: true,
        user: req.session.user
    });
});

// -------------------------
// Start server
// -------------------------

app.listen(PORT, () => {
    console.log(`MetroMarkets backend running on port ${PORT}`);
});