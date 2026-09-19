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
// MARKET DATA
// ================================

const markets = [
    {
        id: 1,
        category: "LEGISLATURE",
        title: "Will the Senate pass the next major bill?",
        question: "Will the bill receive final passage before the market closes?",
        yes: 64,
        volume: "12.4K MC",
        close: "3d 8h"
    },
    {
        id: 2,
        category: "EXECUTIVE",
        title: "Will the Governor sign the proposed act?",
        question: "Will the Governor sign the act before the deadline?",
        yes: 42,
        volume: "8.1K MC",
        close: "1d 14h"
    },
    {
        id: 3,
        category: "ELECTIONS",
        title: "Will the incumbent win the next Senate election?",
        question: "Will the incumbent secure re-election?",
        yes: 57,
        volume: "21.7K MC",
        close: "5d 2h"
    },
    {
        id: 4,
        category: "JUDICIARY",
        title: "Will the court uphold the challenged statute?",
        question: "Will the statute be upheld in the final ruling?",
        yes: 51,
        volume: "6.8K MC",
        close: "2d 4h"
    },
    {
        id: 5,
        category: "OVERSIGHT",
        title: "Will the committee issue a report this session?",
        question: "Will the committee publish its report before adjournment?",
        yes: 73,
        volume: "4.9K MC",
        close: "18h"
    },
    {
        id: 6,
        category: "GOVERNMENT",
        title: "Will an emergency session be convened?",
        question: "Will an emergency session be formally convened?",
        yes: 29,
        volume: "10.2K MC",
        close: "4d 1h"
    }
];


function getMarketById(id) {

    return markets.find(
        market =>
            market.id === Number(id)
    );
}


// ================================
// POSTGRESQL
// ================================

const db = new Pool({
    connectionString:
        process.env.DATABASE_URL
});


// ================================
// MIDDLEWARE
// ================================

app.use(cors({
    origin: true,
    credentials: true
}));

app.set(
    "trust proxy",
    1
);

app.use(
    express.json()
);

app.use(
    session({
        secret:
            process.env.SESSION_SECRET,

        resave:
            false,

        saveUninitialized:
            false,

        cookie: {
            secure:
                true,

            httpOnly:
                true,

            sameSite:
                "none"
        }
    })
);


// ================================
// BASIC ROUTES
// ================================

app.get("/", (req, res) => {

    res.json({
        message:
            "MetroMarkets backend is running!"
    });

});


app.get("/api/test", (req, res) => {

    res.json({
        success:
            true,

        message:
            "Frontend successfully connected to the MetroMarkets backend!"
    });

});


// ================================
// ROBLOX LOGIN
// ================================

app.get("/auth/roblox", (req, res) => {

    const state =
        crypto
            .randomBytes(32)
            .toString("hex");


    const codeVerifier =
        crypto
            .randomBytes(32)
            .toString("base64url");


    const codeChallenge =
        crypto
            .createHash("sha256")
            .update(codeVerifier)
            .digest("base64url");


    req.session.oauthState =
        state;

    req.session.codeVerifier =
        codeVerifier;


    const params =
        new URLSearchParams({

            client_id:
                process.env.ROBLOX_CLIENT_ID,

            redirect_uri:
                process.env.ROBLOX_REDIRECT_URI,

            scope:
                "openid",

            response_type:
                "code",

            state:
                state,

            code_challenge:
                codeChallenge,

            code_challenge_method:
                "S256"

        });


    res.redirect(
        `https://apis.roblox.com/oauth/v1/authorize?${params.toString()}`
    );

});


// ================================
// ROBLOX OAUTH CALLBACK
// ================================

app.get(
    "/auth/roblox/callback",
    async (req, res) => {

        try {

            const {
                code,
                state
            } = req.query;


            if (
                !code ||
                !state
            ) {

                return res
                    .status(400)
                    .send(
                        "Missing OAuth code or state."
                    );

            }


            if (
                state !==
                req.session.oauthState
            ) {

                return res
                    .status(400)
                    .send(
                        "Invalid OAuth state."
                    );

            }


            const codeVerifier =
                req.session.codeVerifier;


            if (!codeVerifier) {

                return res
                    .status(400)
                    .send(
                        "Missing PKCE code verifier."
                    );

            }


            const tokenResponse =
                await axios.post(

                    "https://apis.roblox.com/oauth/v1/token",

                    new URLSearchParams({

                        client_id:
                            process.env.ROBLOX_CLIENT_ID,

                        client_secret:
                            process.env.ROBLOX_CLIENT_SECRET,

                        grant_type:
                            "authorization_code",

                        code:
                            code,

                        code_verifier:
                            codeVerifier

                    }).toString(),

                    {
                        headers: {
                            "Content-Type":
                                "application/x-www-form-urlencoded"
                        }
                    }
                );


            const accessToken =
                tokenResponse
                    .data
                    .access_token;


            const userResponse =
                await axios.get(

                    "https://apis.roblox.com/oauth/v1/userinfo",

                    {
                        headers: {
                            Authorization:
                                `Bearer ${accessToken}`
                        }
                    }

                );


            const robloxUser =
                userResponse.data;


            console.log(
                "Roblox login successful:",
                robloxUser.sub
            );


            req.session.user =
                robloxUser;


            await db.query(
                `
                INSERT INTO users (roblox_id)
                VALUES ($1)
                ON CONFLICT (roblox_id)
                DO NOTHING
                `,
                [
                    robloxUser.sub
                ]
            );


            delete req.session.oauthState;
            delete req.session.codeVerifier;


            res.redirect(
                "https://kennethtube.github.io/metromarkets/"
            );


        } catch (error) {

            console.error(
                "Roblox OAuth error:",
                error.response?.data ||
                error.message
            );


            res
                .status(500)
                .send(
                    "Roblox login failed."
                );

        }

    }
);


// ================================
// CURRENT USER
// ================================

app.get(
    "/api/me",
    async (req, res) => {

        try {

            if (!req.session.user) {

                return res.json({
                    loggedIn:
                        false
                });

            }


            const robloxId =
                req.session.user.sub;


            const result =
                await db.query(
                    `
                    SELECT
                        roblox_id,
                        balance,
                        created_at
                    FROM users
                    WHERE roblox_id = $1
                    `,
                    [
                        robloxId
                    ]
                );


            if (
                result.rows.length === 0
            ) {

                return res
                    .status(404)
                    .json({
                        loggedIn:
                            false,

                        message:
                            "Account not found."
                    });

            }


            const account =
                result.rows[0];


            res.json({

                loggedIn:
                    true,

                user: {
                    sub:
                        account.roblox_id
                },

                balance:
                    account.balance,

                createdAt:
                    account.created_at

            });


        } catch (error) {

            console.error(
                "Database error:",
                error.message
            );


            res
                .status(500)
                .json({

                    success:
                        false,

                    message:
                        "Failed to load account."

                });

        }

    }
);


// ================================
// GET USER TRADES
// ================================

app.get(
    "/api/trades",
    async (req, res) => {

        try {

            if (!req.session.user) {

                return res
                    .status(401)
                    .json({
                        success:
                            false,

                        message:
                            "You must be logged in."
                    });

            }


            const robloxId =
                req.session.user.sub;


            const result =
                await db.query(
                    `
                    SELECT
                        id,
                        market_id,
                        trade_type,
                        side,
                        amount,
                        price,
                        created_at
                    FROM trades
                    WHERE roblox_id = $1
                    ORDER BY
                        created_at DESC,
                        id DESC
                    `,
                    [
                        robloxId
                    ]
                );


            res.json({

                success:
                    true,

                trades:
                    result.rows

            });


        } catch (error) {

            console.error(
                "Trades database error:",
                error.message
            );


            res
                .status(500)
                .json({

                    success:
                        false,

                    message:
                        "Failed to load trades."

                });

        }

    }
);


// ================================
// GET USER POSITIONS
// ================================

app.get(
    "/api/positions",
    async (req, res) => {

        try {

            if (!req.session.user) {

                return res
                    .status(401)
                    .json({
                        success:
                            false,

                        message:
                            "You must be logged in."
                    });

            }


            const robloxId =
                req.session.user.sub;


            const result =
                await db.query(
                    `
                    WITH position_data AS (

                        SELECT

                            market_id,

                            side,

                            SUM(
                                CASE
                                    WHEN trade_type = 'BUY'
                                    THEN amount * 100.0 / price

                                    WHEN trade_type = 'SELL'
                                    THEN -(amount * 100.0 / price)

                                    ELSE 0
                                END
                            ) AS shares,

                            SUM(
                                CASE
                                    WHEN trade_type = 'BUY'
                                    THEN amount
                                    ELSE 0
                                END
                            ) AS total_buy_cost,

                            SUM(
                                CASE
                                    WHEN trade_type = 'BUY'
                                    THEN amount * 100.0 / price
                                    ELSE 0
                                END
                            ) AS total_buy_shares

                        FROM trades

                        WHERE roblox_id = $1

                        GROUP BY
                            market_id,
                            side
                    )

                    SELECT

                        market_id,

                        side,

                        shares,

                        CASE
                            WHEN total_buy_shares = 0
                            THEN 0

                            ELSE
                                (
                                    total_buy_cost /
                                    total_buy_shares
                                ) * 100
                        END AS average_price,

                        CASE
                            WHEN total_buy_shares = 0
                            THEN 0

                            ELSE
                                (
                                    shares *
                                    (
                                        (
                                            total_buy_cost /
                                            total_buy_shares
                                        ) / 100
                                    )
                                )
                        END AS total_invested

                    FROM position_data

                    WHERE shares > 0

                    ORDER BY
                        market_id,
                        side
                    `,
                    [
                        robloxId
                    ]
                );


            res.json({

                success:
                    true,

                positions:
                    result.rows

            });


        } catch (error) {

            console.error(
                "Positions database error:",
                error.message
            );


            res
                .status(500)
                .json({

                    success:
                        false,

                    message:
                        "Failed to load positions."

                });

        }

    }
);


// ================================
// PLACE TRADE
// ================================

app.post(
    "/api/account/spend",
    async (req, res) => {

        let client;


        try {

            if (!req.session.user) {

                return res
                    .status(401)
                    .json({
                        success:
                            false,

                        message:
                            "You must be logged in."
                    });

            }


            const robloxId =
                req.session.user.sub;


            const amount =
                Number(
                    req.body.amount
                );


            const marketId =
                Number(
                    req.body.marketId
                );


            const side =
                String(
                    req.body.side || ""
                ).toUpperCase();


            const market =
                getMarketById(
                    marketId
                );


            if (!market) {

                return res
                    .status(400)
                    .json({
                        success:
                            false,

                        message:
                            "Invalid market."
                    });

            }


            if (
                !Number.isInteger(amount) ||
                amount <= 0
            ) {

                return res
                    .status(400)
                    .json({
                        success:
                            false,

                        message:
                            "Amount must be a positive whole number."
                    });

            }


            if (
                amount > 1000000
            ) {

                return res
                    .status(400)
                    .json({
                        success:
                            false,

                        message:
                            "Amount is too large."
                    });

            }


            if (
                side !== "YES" &&
                side !== "NO"
            ) {

                return res
                    .status(400)
                    .json({
                        success:
                            false,

                        message:
                            "Trade side must be YES or NO."
                    });

            }


            const price =
                side === "YES"
                    ? market.yes
                    : 100 - market.yes;


            client =
                await db.connect();


            await client.query(
                "BEGIN"
            );


            // Lock the account while
            // the trade is processed.
            await client.query(
                `
                SELECT id
                FROM users
                WHERE roblox_id = $1
                FOR UPDATE
                `,
                [
                    robloxId
                ]
            );


            const balanceResult =
                await client.query(
                    `
                    UPDATE users

                    SET balance =
                        balance - $1

                    WHERE roblox_id = $2

                    AND balance >= $1

                    RETURNING balance
                    `,
                    [
                        amount,
                        robloxId
                    ]
                );


            if (
                balanceResult.rows.length === 0
            ) {

                await client.query(
                    "ROLLBACK"
                );


                return res
                    .status(400)
                    .json({
                        success:
                            false,

                        message:
                            "Insufficient balance."
                    });

            }


            const tradeResult =
                await client.query(
                    `
                    INSERT INTO trades (
                        roblox_id,
                        market_id,
                        trade_type,
                        side,
                        amount,
                        price
                    )

                    VALUES (
                        $1,
                        $2,
                        'BUY',
                        $3,
                        $4,
                        $5
                    )

                    RETURNING
                        id,
                        market_id,
                        trade_type,
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


            await client.query(
                "COMMIT"
            );


            res.json({

                success:
                    true,

                balance:
                    balanceResult.rows[0].balance,

                trade:
                    tradeResult.rows[0]

            });


        } catch (error) {

            if (client) {

                try {

                    await client.query(
                        "ROLLBACK"
                    );

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


            res
                .status(500)
                .json({

                    success:
                        false,

                    message:
                        "Failed to place trade."

                });


        } finally {

            if (client) {
                client.release();
            }

        }

    }
);


// ================================
// SELL POSITION
// ================================

app.post(
    "/api/account/sell",
    async (req, res) => {

        let client;


        try {

            if (!req.session.user) {

                return res
                    .status(401)
                    .json({
                        success:
                            false,

                        message:
                            "You must be logged in."
                    });

            }


            const robloxId =
                req.session.user.sub;


            const marketId =
                Number(
                    req.body.marketId
                );


            const side =
                String(
                    req.body.side || ""
                ).toUpperCase();


            const amount =
                Number(
                    req.body.amount
                );


            const market =
                getMarketById(
                    marketId
                );


            if (!market) {

                return res
                    .status(400)
                    .json({
                        success:
                            false,

                        message:
                            "Invalid market."
                    });

            }


            if (
                side !== "YES" &&
                side !== "NO"
            ) {

                return res
                    .status(400)
                    .json({
                        success:
                            false,

                        message:
                            "Trade side must be YES or NO."
                    });

            }


            if (
                !Number.isInteger(amount) ||
                amount <= 0
            ) {

                return res
                    .status(400)
                    .json({
                        success:
                            false,

                        message:
                            "Amount must be a positive whole number."
                    });

            }


            if (
                amount > 1000000
            ) {

                return res
                    .status(400)
                    .json({
                        success:
                            false,

                        message:
                            "Amount is too large."
                    });

            }


            const price =
                side === "YES"
                    ? market.yes
                    : 100 - market.yes;


            // Amount of shares being sold
            const sharesToSell =
                amount * 100 / price;


            client =
                await db.connect();


            await client.query(
                "BEGIN"
            );


            // Lock account so two
            // simultaneous sales cannot
            // oversell the position.
            await client.query(
                `
                SELECT id
                FROM users
                WHERE roblox_id = $1
                FOR UPDATE
                `,
                [
                    robloxId
                ]
            );


            // Calculate current shares
            const positionResult =
                await client.query(
                    `
                    SELECT

                        COALESCE(
                            SUM(
                                CASE
                                    WHEN trade_type = 'BUY'
                                    THEN amount * 100.0 / price

                                    WHEN trade_type = 'SELL'
                                    THEN -(amount * 100.0 / price)

                                    ELSE 0
                                END
                            ),
                            0
                        ) AS shares

                    FROM trades

                    WHERE roblox_id = $1

                    AND market_id = $2

                    AND side = $3
                    `,
                    [
                        robloxId,
                        marketId,
                        side
                    ]
                );


            const currentShares =
                Number(
                    positionResult
                        .rows[0]
                        .shares
                );


            if (
                !Number.isFinite(
                    currentShares
                ) ||
                currentShares <= 0
            ) {

                await client.query(
                    "ROLLBACK"
                );


                return res
                    .status(400)
                    .json({
                        success:
                            false,

                        message:
                            "You do not have an open position in this market."
                    });

            }


            if (
                sharesToSell >
                currentShares + 0.000001
            ) {

                await client.query(
                    "ROLLBACK"
                );


                return res
                    .status(400)
                    .json({
                        success:
                            false,

                        message:
                            `You can only sell ${currentShares.toFixed(2)} shares of this position.`
                    });

            }


            // Return MC to the user's balance
            const balanceResult =
                await client.query(
                    `
                    UPDATE users

                    SET balance =
                        balance + $1

                    WHERE roblox_id = $2

                    RETURNING balance
                    `,
                    [
                        amount,
                        robloxId
                    ]
                );


            const tradeResult =
                await client.query(
                    `
                    INSERT INTO trades (
                        roblox_id,
                        market_id,
                        trade_type,
                        side,
                        amount,
                        price
                    )

                    VALUES (
                        $1,
                        $2,
                        'SELL',
                        $3,
                        $4,
                        $5
                    )

                    RETURNING
                        id,
                        market_id,
                        trade_type,
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


            await client.query(
                "COMMIT"
            );


            res.json({

                success:
                    true,

                balance:
                    balanceResult.rows[0].balance,

                sharesSold:
                    sharesToSell,

                trade:
                    tradeResult.rows[0]

            });


        } catch (error) {

            if (client) {

                try {

                    await client.query(
                        "ROLLBACK"
                    );

                } catch (rollbackError) {

                    console.error(
                        "Rollback error:",
                        rollbackError.message
                    );

                }

            }


            console.error(
                "Sell error:",
                error.message
            );


            res
                .status(500)
                .json({

                    success:
                        false,

                    message:
                        "Failed to sell position."

                });


        } finally {

            if (client) {
                client.release();
            }

        }

    }
);


// ================================
// LOGOUT
// ================================

app.get(
    "/auth/logout",
    (req, res) => {

        req.session.destroy(
            (err) => {

                if (err) {

                    return res
                        .status(500)
                        .json({
                            success:
                                false,

                            message:
                                "Logout failed."
                        });

                }


                res.redirect(
                    "https://kennethtube.github.io/metromarkets/"
                );

            }
        );

    }
);


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


        // Add trade type to the existing
        // trades table.
        await db.query(`
            ALTER TABLE trades
            ADD COLUMN IF NOT EXISTS trade_type TEXT NOT NULL DEFAULT 'BUY'
        `);


        console.log(
            "Database connected and tables ready."
        );


        app.listen(
            PORT,
            () => {

                console.log(
                    `MetroMarkets backend running on port ${PORT}`
                );

            }
        );


    } catch (error) {

        console.error(
            "Database connection failed:",
            error
        );

    }

}


startServer();