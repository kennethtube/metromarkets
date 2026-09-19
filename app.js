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
    ).textContent = selected.category;

    document.getElementById(
        "modalTitle"
    ).textContent = selected.title;

    document.getElementById(
        "modalQuestion"
    ).textContent = selected.question;

    document.getElementById(
        "yesPrice"
    ).textContent = selected.yes + "¢";

    document.getElementById(
        "noPrice"
    ).textContent = (100 - selected.yes) + "¢";


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
// PLACE TRADE
// ================================

async function placeTrade(side) {

    const amountInput =
        document.getElementById("tradeAmount");


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
        Number(amountInput.value);


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

        price = selected.yes;

    } else if (side === "NO") {

        price = 100 - selected.yes;

    } else {

        alert(
            "Invalid trade side."
        );

        return;
    }


    try {

        const response = await fetch(
            `${API_URL}/api/account/spend`,
            {
                method: "POST",

                credentials: "include",

                headers: {
                    "Content-Type":
                        "application/json"
                },

                body: JSON.stringify({
                    marketId: selected.id,
                    side: side,
                    amount: amount,
                    price: price
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
            Number(data.balance)
                .toLocaleString() +
            " MC";


        amountInput.value = "";


        closeModal();


        alert(
            `Bought ${side} for ${amount.toLocaleString()} MC at ${price}¢.`
        );


        await checkLogin();


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

        const response = await fetch(
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
                Number(data.balance)
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


            document.getElementById(
                "portfolioText"
            ).textContent =
                `Logged in as ${username}. Your portfolio will appear here.`;

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