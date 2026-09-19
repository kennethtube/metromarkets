const express = require("express");
const cors = require("cors");
const axios = require("axios");
const crypto = require("crypto");
const session = require("express-session");
require("dotenv").config();

const { Pool } = require("pg");

const app = express();
const PORT = process.env.PORT || 3000;


// ================================
// POSTGRESQL
// ================================

const db = new Pool({
    connectionString: process.env.DATABASE_URL
});


// ================================
// MIDDLEWARE
// ================================

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


// ================================
// BASIC ROUTES
// ================================

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


// ================================
// ROBLOX LOGIN
// ================================

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


// ================================
// ROBLOX OAUTH CALLBACK
// ================================

app.get("/auth/roblox/callback", async (req, res) => {

    try {

        const { code, state } = req.query;

        if (!code || !state) {
            return res
                .status(400)
                .send("Missing OAuth code or state.");
        }

        if (state !== req.session.oauthState) {
            return res
                .status(400)
                .send("Invalid OAuth state.");
        }

        const codeVerifier = req.session.codeVerifier;

        if (!codeVerifier) {
            return res
                .status(400)
                .send("Missing PKCE code verifier.");
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
                    "Content-Type":
                        "application/x-www-form-urlencoded"
                }
            }
        );


        const accessToken =
            tokenResponse.data.access_token;


        const userResponse = await axios.get(
            "https://apis.roblox.com/oauth/v1/userinfo",
            {
                headers: {
                    Authorization: `Bearer ${accessToken}`
                }
            }
        );


        const robloxUser = userResponse.data;


        console.log(
            "Roblox login successful:",
            robloxUser.sub
        );


        req.session.user = robloxUser;


        // Create account if it doesn't already exist
        await db.query(
            `
            INSERT INTO users (roblox_id)
            VALUES ($1)
            ON CONFLICT (roblox_id)
            DO NOTHING
            `,
            [robloxUser.sub]
        );


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

        res
            .status(500)
            .send("Roblox login failed.");
    }
});


// ================================
// CURRENT USER
// ================================

app.get("/api/me", async (req, res) => {

    try {

        if (!req.session.user) {

            return res.json({
                loggedIn: false
            });

        }


        const robloxId =
            req.session.user.sub;


        const result = await db.query(
            `
            SELECT
                roblox_id,
                balance,
                created_at
            FROM users
            WHERE roblox_id = $1
            `,
            [robloxId]
        );


        if (result.rows.length === 0) {

            return res.status(404).json({
                loggedIn: false,
                message: "Account not found."
            });

        }


        const account =
            result.rows[0];


        res.json({
            loggedIn: true,

            user: {
                sub: account.roblox_id
            },

            balance: account.balance,

            createdAt: account.created_at
        });

    } catch (error) {

        console.error(
            "Database error:",
            error.message
        );

        res.status(500).json({
            success: false,
            message:
                "Failed to load account."
        });
    }
});


// ================================
// GET USER TRADES
// ================================

app.get("/api/trades", async (req, res) => {

    try {

        // Make sure the user is logged in
        if (!req.session.user) {

            return res.status(401).json({
                success: false,
                message:
                    "You must be logged in."
            });

        }


        const robloxId =
            req.session.user.sub;


        const result = await db.query(
            `
            SELECT
                id,
                market_id,
                side,
                amount,
                price,
                created_at
            FROM trades
            WHERE roblox_id = $1
            ORDER BY created_at DESC, id DESC
            `,
            [robloxId]
        );


        res.json({
            success: true,
            trades: result.rows
        });

    } catch (error) {

        console.error(
            "Trades database error:",
            error.message
        );

        res.status(500).json({
            success: false,
            message:
                "Failed to load trades."
        });
    }
});


// ================================
// PLACE TRADE
// ================================

app.post("/api/account/spend", async (req, res) => {

    let client;

    try {

        // Make sure the user is logged in
        if (!req.session.user) {

            return res.status(401).json({
                success: false,
                message:
                    "You must be logged in."
            });

        }


        const robloxId =
            req.session.user.sub;


        const amount =
            Number(req.body.amount);


        const marketId =
            Number(req.body.marketId);


        const side =
            String(
                req.body.side || ""
            ).toUpperCase();


        const price =
            Number(req.body.price);


        // Validate amount
        if (
            !Number.isInteger(amount) ||
            amount <= 0
        ) {

            return res.status(400).json({
                success: false,
                message:
                    "Amount must be a positive whole number."
            });

        }


        // Prevent unreasonable purchases
        if (amount > 1000000) {

            return res.status(400).json({
                success: false,
                message:
                    "Amount is too large."
            });

        }


        // Validate market
        if (
            !Number.isInteger(marketId) ||
            marketId <= 0
        ) {

            return res.status(400).json({
                success: false,
                message:
                    "Invalid market."
            });

        }


        // Validate side
        if (
            side !== "YES" &&
            side !== "NO"
        ) {

            return res.status(400).json({
                success: false,
                message:
                    "Trade side must be YES or NO."
            });

        }


        // Validate price
        if (
            !Number.isInteger(price) ||
            price < 1 ||
            price > 99
        ) {

            return res.status(400).json({
                success: false,
                message:
                    "Invalid market price."
            });

        }


        // Get PostgreSQL connection
        client = await db.connect();


        // Start transaction
        await client.query("BEGIN");


        // Deduct MC
        const balanceResult = await client.query(
            `
            UPDATE users
            SET balance = balance - $1
            WHERE roblox_id = $2
            AND balance >= $1
            RETURNING balance
            `,
            [
                amount,
                robloxId
            ]
        );


        // Not enough MC
        if (balanceResult.rows.length === 0) {

            await client.query("ROLLBACK");

            return res.status(400).json({
                success: false,
                message:
                    "Insufficient balance."
            });

        }


        // Save the trade
        const tradeResult = await client.query(
            `
            INSERT INTO trades (
                roblox_id,
                market_id,
                side,
                amount,
                price
            )
            VALUES ($1, $2, $3, $4, $5)
            RETURNING
                id,
                market_id,
                side,
                amount,
                price,
                created_at
            `,
            [
                robloxId,
                marketId,
                side,
                amount,
                price
            ]
        );


        // Commit both operations
        await client.query("COMMIT");


        const trade =
            tradeResult.rows[0];


        const newBalance =
            balanceResult.rows[0].balance;


        res.json({
            success: true,
            balance: newBalance,
            trade: trade
        });

    } catch (error) {

        if (client) {

            try {

                await client.query("ROLLBACK");

            } catch (rollbackError) {

                console.error(
                    "Rollback error:",
                    rollbackError.message
                );

            }
        }


        console.error(
            "Trade error:",
            error.message
        );


        res.status(500).json({
            success: false,
            message:
                "Failed to place trade."
        });

    } finally {

        if (client) {
            client.release();
        }

    }
});


// ================================
// LOGOUT
// ================================

app.get("/auth/logout", (req, res) => {

    req.session.destroy((err) => {

        if (err) {

            return res.status(500).json({
                success: false,
                message:
                    "Logout failed."
            });

        }


        res.redirect(
            "https://kennethtube.github.io/metromarkets/"
        );
    });
});


// ================================
// DATABASE + SERVER STARTUP
// ================================

async function startServer() {

    try {

        // Users table
        await db.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                roblox_id TEXT UNIQUE NOT NULL,
                balance BIGINT NOT NULL DEFAULT 10000,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);


        // Trades table
        await db.query(`
            CREATE TABLE IF NOT EXISTS trades (
                id SERIAL PRIMARY KEY,
                roblox_id TEXT NOT NULL,
                market_id INTEGER NOT NULL,
                side TEXT NOT NULL,
                amount BIGINT NOT NULL,
                price INTEGER NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);


        console.log(
            "Database connected and tables ready."
        );


        app.listen(PORT, () => {

            console.log(
                `MetroMarkets backend running on port ${PORT}`
            );

        });

    } catch (error) {

        console.error(
            "Database connection failed:",
            error
        );

    }
}


startServer();