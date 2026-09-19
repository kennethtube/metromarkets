const API_URL = "https://metromarkets.onrender.com";

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

let selected = null;


// ================================
// RENDER MARKETS
// ================================

function render() {

    const marketGrid =
        document.getElementById("marketGrid");

    if (!marketGrid) {
        return;
    }

    marketGrid.innerHTML = markets.map(m => `
        <article class="market-card">

            <span class="category">
                ${m.category}
            </span>

            <h3>
                ${m.title}
            </h3>

            <div class="prob">
                ${m.yes}%
            </div>

            <div class="bar">
                <div style="width:${m.yes}%"></div>
            </div>

            <div class="market-footer">

                <span>
                    ${m.volume} • closes ${m.close}
                </span>

                <button
                    class="trade"
                    onclick="openModal(${m.id})"
                >
                    Trade →
                </button>

            </div>

        </article>
    `).join("");
}


// ================================
// OPEN MARKET MODAL
// ================================

function openModal(id) {

    selected = markets.find(
        m => m.id === id
    );

    if (!selected) {
        return;
    }


    document.getElementById(
        "modalCategory"
    ).textContent =
        selected.category;


    document.getElementById(
        "modalTitle"
    ).textContent =
        selected.title;


    document.getElementById(
        "modalQuestion"
    ).textContent =
        selected.question;


    document.getElementById(
        "yesPrice"
    ).textContent =
        selected.yes + "¢";


    document.getElementById(
        "noPrice"
    ).textContent =
        (100 - selected.yes) + "¢";


    const amountInput =
        document.getElementById("tradeAmount");


    if (amountInput) {
        amountInput.value = "";
    }


    document
        .getElementById("tradeModal")
        .classList
        .remove("hidden");
}


// ================================
// CLOSE MARKET MODAL
// ================================

function closeModal() {

    document
        .getElementById("tradeModal")
        .classList
        .add("hidden");
}


// ================================
// GET MARKET BY ID
// ================================

function getMarketById(id) {

    return markets.find(
        market =>
            market.id === Number(id)
    );
}


// ================================
// FORMAT NUMBER
// ================================

function formatNumber(value, decimals = 2) {

    const number =
        Number(value);

    if (!Number.isFinite(number)) {
        return "0";
    }


    return number.toLocaleString(
        undefined,
        {
            minimumFractionDigits:
                decimals,

            maximumFractionDigits:
                decimals
        }
    );
}


// ================================
// FORMAT TRADE TIME
// ================================

function formatTradeTime(timestamp) {

    if (!timestamp) {
        return "Unknown time";
    }


    const date =
        new Date(timestamp);


    if (
        Number.isNaN(
            date.getTime()
        )
    ) {

        return "Unknown time";
    }


    return date.toLocaleString();
}


// ================================
// LOAD USER POSITIONS
// ================================

async function loadPositions() {

    const portfolioText =
        document.getElementById(
            "portfolioText"
        );


    if (!portfolioText) {
        return;
    }


    try {

        const response =
            await fetch(
                `${API_URL}/api/positions`,
                {
                    credentials: "include"
                }
            );


        const data =
            await response.json();


        if (!response.ok) {

            portfolioText.textContent =
                data.message ||
                "Failed to load your positions.";

            return;
        }


        const positions =
            Array.isArray(
                data.positions
            )
                ? data.positions
                : [];


        const positionsElement =
            document.getElementById(
                "positions"
            );


        if (positionsElement) {

            positionsElement.textContent =
                positions.length;
        }


        if (positions.length === 0) {

            portfolioText.innerHTML = `
                <div class="portfolio-empty">

                    <strong>
                        No open positions.
                    </strong>

                    <p>
                        Your positions will appear here after you place a trade.
                    </p>

                </div>
            `;

            return;
        }


        portfolioText.innerHTML = `

            <div class="portfolio-positions">

                <div class="portfolio-header">

                    <strong>
                        Open Positions
                    </strong>

                    <span>
                        ${positions.length}
                        ${positions.length === 1
                            ? "position"
                            : "positions"}
                    </span>

                </div>


                <div class="position-list">

                    ${positions.map(position => {

                        const market =
                            getMarketById(
                                position.market_id
                            );


                        const marketName =
                            market
                                ? market.title
                                : `Market #${position.market_id}`;


                        const side =
                            String(
                                position.side || ""
                            ).toUpperCase();


                        const currentPrice =
                            market
                                ? (
                                    side === "YES"
                                        ? market.yes
                                        : 100 - market.yes
                                )
                                : Number(
                                    position.average_price
                                );


                        const shares =
                            Number(
                                position.shares
                            );


                        const invested =
                            Number(
                                position.total_invested
                            );


                        const averagePrice =
                            Number(
                                position.average_price
                            );


                        const currentValue =
                            shares *
                            (
                                currentPrice /
                                100
                            );


                        const potentialPayout =
                            shares;


                        const unrealizedValue =
                            currentValue -
                            invested;


                        const sideClass =
                            side === "NO"
                                ? "no"
                                : "yes";


                        return `

                            <div class="position-card">

                                <div class="position-top">

                                    <div>

                                        <span class="category ${sideClass}">
                                            ${side}
                                        </span>

                                        <h3>
                                            ${marketName}
                                        </h3>

                                    </div>

                                    <strong>
                                        ${currentPrice}¢
                                    </strong>

                                </div>


                                <div class="position-stats">

                                    <div>
                                        <span>
                                            Invested
                                        </span>

                                        <strong>
                                            ${formatNumber(invested, 0)} MC
                                        </strong>
                                    </div>


                                    <div>
                                        <span>
                                            Shares
                                        </span>

                                        <strong>
                                            ${formatNumber(shares, 2)}
                                        </strong>
                                    </div>


                                    <div>
                                        <span>
                                            Avg. Price
                                        </span>

                                        <strong>
                                            ${formatNumber(averagePrice, 2)}¢
                                        </strong>
                                    </div>


                                    <div>
                                        <span>
                                            Current Value
                                        </span>

                                        <strong>
                                            ${formatNumber(currentValue, 2)} MC
                                        </strong>
                                    </div>


                                    <div>
                                        <span>
                                            Potential Payout
                                        </span>

                                        <strong>
                                            ${formatNumber(potentialPayout, 2)} MC
                                        </strong>
                                    </div>


                                    <div>
                                        <span>
                                            Unrealized
                                        </span>

                                        <strong class="${unrealizedValue < 0 ? "negative" : "positive"}">
                                            ${unrealizedValue >= 0 ? "+" : ""}
                                            ${formatNumber(unrealizedValue, 2)} MC
                                        </strong>
                                    </div>

                                </div>

                            </div>

                        `;

                    }).join("")}

                </div>

            </div>
        `;


    } catch (error) {

        console.error(
            "Load positions failed:",
            error
        );


        portfolioText.textContent =
            "Could not connect to the trading server.";
    }
}


// ================================
// LOAD TRADE HISTORY
// ================================

async function loadTradeHistory() {

    try {

        const response =
            await fetch(
                `${API_URL}/api/trades`,
                {
                    credentials: "include"
                }
            );


        const data =
            await response.json();


        if (!response.ok) {
            return;
        }


        const trades =
            Array.isArray(
                data.trades
            )
                ? data.trades
                : [];


        const portfolioText =
            document.getElementById(
                "portfolioText"
            );


        if (
            !portfolioText ||
            trades.length === 0
        ) {
            return;
        }


        const historyHTML = `

            <div class="trade-history">

                <div class="trade-history-header">

                    <strong>
                        Trade History
                    </strong>

                    <span>
                        ${trades.length}
                        ${trades.length === 1
                            ? "trade"
                            : "trades"}
                    </span>

                </div>


                <div class="trade-history-list">

                    ${trades.map(trade => {

                        const market =
                            getMarketById(
                                trade.market_id
                            );


                        const marketName =
                            market
                                ? market.title
                                : `Market #${trade.market_id}`;


                        const side =
                            String(
                                trade.side || ""
                            ).toUpperCase();


                        const sideClass =
                            side === "NO"
                                ? "no"
                                : "yes";


                        return `

                            <div class="trade-history-item">

                                <div class="trade-history-main">

                                    <strong class="${sideClass}">
                                        ${side}
                                    </strong>

                                    <span>
                                        ${marketName}
                                    </span>

                                </div>


                                <div class="trade-history-details">

                                    <span>
                                        ${Number(trade.amount).toLocaleString()} MC
                                    </span>

                                    <span>
                                        ${trade.price}¢
                                    </span>

                                </div>


                                <div class="trade-history-time">

                                    ${formatTradeTime(
                                        trade.created_at
                                    )}

                                </div>

                            </div>

                        `;

                    }).join("")}

                </div>

            </div>
        `;


        portfolioText.innerHTML +=
            historyHTML;


    } catch (error) {

        console.error(
            "Load trade history failed:",
            error
        );
    }
}


// ================================
// PLACE TRADE
// ================================

async function placeTrade(side) {

    const amountInput =
        document.getElementById(
            "tradeAmount"
        );


    if (!amountInput) {

        alert(
            "Trade amount input was not found."
        );

        return;
    }


    if (!selected) {

        alert(
            "No market is currently selected."
        );

        return;
    }


    const amount =
        Number(
            amountInput.value
        );


    if (
        !Number.isInteger(amount) ||
        amount <= 0
    ) {

        alert(
            "Enter a valid whole-number amount."
        );

        return;
    }


    let price;


    if (side === "YES") {

        price =
            selected.yes;

    } else if (side === "NO") {

        price =
            100 - selected.yes;

    } else {

        alert(
            "Invalid trade side."
        );

        return;
    }


    try {

        const response =
            await fetch(
                `${API_URL}/api/account/spend`,
                {
                    method: "POST",

                    credentials: "include",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({

                        marketId:
                            selected.id,

                        side:
                            side,

                        amount:
                            amount,

                        price:
                            price

                    })
                }
            );


        const data =
            await response.json();


        if (!response.ok) {

            alert(
                data.message ||
                "Trade failed."
            );

            return;
        }


        document.getElementById(
            "balance"
        ).textContent =
            Number(
                data.balance
            )
            .toLocaleString() +
            " MC";


        amountInput.value = "";


        closeModal();


        await loadPositions();


        await loadTradeHistory();


        alert(
            `Bought ${side} for ${amount.toLocaleString()} MC at ${price}¢.`
        );


    } catch (error) {

        console.error(
            "Trade failed:",
            error
        );


        alert(
            "Could not connect to the trading server."
        );
    }
}


// ================================
// ROBLOX LOGIN
// ================================

function login() {

    window.location.href =
        `${API_URL}/auth/roblox`;
}


// ================================
// CHECK LOGIN
// ================================

async function checkLogin() {

    try {

        const response =
            await fetch(
                `${API_URL}/api/me`,
                {
                    credentials: "include"
                }
            );


        const data =
            await response.json();


        const loginButton =
            document.getElementById(
                "loginBtn"
            );


        if (data.loggedIn) {

            const username =
                `Roblox ID: ${data.user.sub}`;


            document.getElementById(
                "balance"
            ).textContent =
                Number(
                    data.balance
                )
                .toLocaleString() +
                " MC";


            document.getElementById(
                "account"
            ).textContent =
                username;


            loginButton.textContent =
                "Logout";

            loginButton.disabled =
                false;


            loginButton.onclick = () => {

                window.location.href =
                    `${API_URL}/auth/logout`;

            };


            await loadPositions();


            await loadTradeHistory();


        } else {

            loginButton.textContent =
                "Login with Roblox";

            loginButton.disabled =
                false;

            loginButton.onclick =
                login;


            document.getElementById(
                "account"
            ).textContent =
                "Guest";


            document.getElementById(
                "positions"
            ).textContent =
                "0";


            document.getElementById(
                "portfolioText"
            ).textContent =
                "Log in with Roblox to view your portfolio and place trades.";

        }


    } catch (error) {

        console.error(
            "Login check failed:",
            error
        );
    }
}


// ================================
// START APPLICATION
// ================================

render();
checkLogin();