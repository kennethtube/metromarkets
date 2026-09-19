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

function render() {
    const marketGrid = document.getElementById("marketGrid");

    marketGrid.innerHTML = markets.map(m => `
        <article class="market-card">
            <span class="category">${m.category}</span>

            <h3>${m.title}</h3>

            <div class="prob">${m.yes}%</div>

            <div class="bar">
                <div style="width:${m.yes}%"></div>
            </div>

            <div class="market-footer">
                <span>${m.volume} • closes ${m.close}</span>
                <button class="trade" onclick="openModal(${m.id})">
                    Trade →
                </button>
            </div>
        </article>
    `).join("");
}

function openModal(id) {
    selected = markets.find(m => m.id === id);

    document.getElementById("modalCategory").textContent =
        selected.category;

    document.getElementById("modalTitle").textContent =
        selected.title;

    document.getElementById("modalQuestion").textContent =
        selected.question;

    document.getElementById("yesPrice").textContent =
        selected.yes + "¢";

    document.getElementById("noPrice").textContent =
        (100 - selected.yes) + "¢";

    document.getElementById("tradeModal").classList.remove("hidden");
}

function closeModal() {
    document.getElementById("tradeModal").classList.add("hidden");
}

function placeTrade(side) {
    alert(
        `Demo action: Buy ${side}. Connect the trading backend before enabling real account balances or persistent trades.`
    );
}

document.getElementById("loginBtn").onclick = () => {
    window.location.href = `${API_URL}/auth/roblox`;
};

async function checkLogin() {
    try {
        const response = await fetch(`${API_URL}/api/me`, {
            credentials: "include"
        });

        const data = await response.json();

        if (data.loggedIn) {
            const username =
                data.user.preferred_username || "Roblox User";

            document.getElementById("account").textContent =
                username;

            const loginButton =
                document.getElementById("loginBtn");

            loginButton.textContent = "Logged in";
            loginButton.disabled = true;

            document.getElementById("portfolioText").textContent =
                `Logged in as ${username}. Your portfolio will appear here.`;
        }
    } catch (error) {
        console.error("Login check failed:", error);
    }
}

render();
checkLogin();