const API_BASE = "https://openburn-moltspaces-api-547962548252.us-central1.run.app/api/burn/stats"; // Base API URL
const APP_NAME = "OPENBURN";
let currentToken = null;
let showSolValue = false; // Toggle state for Value column

const ui = {
  brandMatrix: document.getElementById("brandMatrix"),
  apiStatus: document.getElementById("apiStatus"),
  totalValueBurned: document.getElementById("totalValueBurned"),
  totalTransactions: document.getElementById("totalTransactions"),
  burnHistoryBody: document.getElementById("burnHistoryBody"),
  navControls: document.getElementById("navControls"),
  btnBack: document.getElementById("btnBack"),
  heroTitle: document.querySelector(".pane-hero h2"),
  tokenDetails: document.getElementById("tokenDetails"),
  detailsGrid: document.getElementById("detailsGrid"),
  valueHeader: document.getElementById("valueHeader"),
};

// ... DOT_FONT and helper functions (formatCurrency, formatNumber, formatDate) remain the same ...

// Font for the "OPENBURN" matrix text
const DOT_FONT = {
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  N: ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
  B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
  U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
};

function renderBrandMatrix(name) {
  if (!ui.brandMatrix) return;
  ui.brandMatrix.innerHTML = "";
  const chars = name.toUpperCase().split("");
  for (const ch of chars) {
    const glyph = DOT_FONT[ch] || DOT_FONT[" "];
    const letter = document.createElement("div");
    letter.className = "matrix-letter";
    for (const row of glyph) {
      for (const pixel of row) {
        const dot = document.createElement("span");
        dot.className = pixel === "1" ? "dot-square on" : "dot-square";
        letter.appendChild(dot);
      }
    }
    ui.brandMatrix.appendChild(letter);
  }
}

function formatCurrency(amount) {
    if (amount === undefined || amount === null) return "$0.00";
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(amount);
}

function formatSol(amount) {
    if (amount === undefined || amount === null) return "0.00 SOL";
    return `${new Intl.NumberFormat('en-US', {
        minimumFractionDigits: 4,
        maximumFractionDigits: 4
    }).format(amount)} SOL`;
}

function formatNumber(num) {
    if (num === undefined || num === null) return "0";
    return new Intl.NumberFormat('en-US').format(num);
}

function formatDate(timestamp) {
    if (!timestamp || !timestamp._seconds) return "-";
    const date = new Date(timestamp._seconds * 1000);
    return date.toLocaleString();
}

function renderStats(stats) {
    ui.totalValueBurned.textContent = formatCurrency(stats.totalValueBurnedUsd);
    ui.totalTransactions.textContent = `${formatNumber(stats.totalTransactions)} Transactions`;
}

function renderTokenDetails(data) {
    if (!ui.detailsGrid) return;
    ui.detailsGrid.innerHTML = "";

    // If we are looking at a specific token, data might be the token details object, 
    // or we might need to extract it from the burns if the API doesn't return a dedicated details object yet.
    // For now, assuming the API returns "stats" we can use, or we take the first burn to get token info.
    
    // If we are just fetching a list of burns for a token, we might not have global token stats like "marketCapUsd" 
    // unless the API provides it. Let's try to infer what we can from the first burn if available,
    // or fallback to what we have.
    
    // In a real scenario, we might want a dedicated endpoint for token metadata. 
    // For now, let's use the most recent burn to populate static fields.
    const sample = data.recentBurns && data.recentBurns.length > 0 ? data.recentBurns[0] : {};

    const fields = [
        { label: "Token Name", value: sample.tokenName || "Unknown" },
        { label: "Token Symbol", value: sample.tokenSymbol || "Unknown" },
        { label: "Token Address", value: currentToken, link: `https://pump.fun/${currentToken}`, linkText: currentToken },
        { label: "Wallet", value: sample.wallet || "-", link: sample.wallet ? `https://solscan.io/account/${sample.wallet}` : null, linkText: sample.wallet },
        { label: "Price (USD)", value: sample.priceUsd ? formatCurrency(sample.priceUsd) : "-" },
        { label: "Market Cap (USD)", value: sample.marketCapUsd ? formatCurrency(sample.marketCapUsd) : "-" },
    ];

    fields.forEach(field => {
        const item = document.createElement("div");
        item.className = "detail-item";
        
        const label = document.createElement("span");
        label.className = "detail-label";
        label.textContent = field.label;
        
        const value = document.createElement("span");
        value.className = "detail-value";
        
        if (field.link) {
            const a = document.createElement("a");
            a.href = field.link;
            a.target = "_blank";
            a.textContent = field.linkText || field.value;
            value.appendChild(a);
        } else {
            value.textContent = field.value;
        }

        item.appendChild(label);
        item.appendChild(value);
        ui.detailsGrid.appendChild(item);
    });
}

function renderTransactionHistory(burns, claims) {
    ui.burnHistoryBody.innerHTML = "";

    // Merge burns and claims into a single array with type indicator
    const transactions = [];
    
    if (burns && burns.length > 0) {
        burns.forEach(burn => {
            transactions.push({
                type: 'burn',
                data: burn,
                timestamp: burn.timestamp
            });
        });
    }
    
    if (claims && claims.length > 0) {
        claims.forEach(claim => {
            transactions.push({
                type: 'claim',
                data: claim,
                timestamp: claim.timestamp
            });
        });
    }

    if (transactions.length === 0) {
        ui.burnHistoryBody.innerHTML = `<tr><td colspan="5" class="center">No recent transactions found.</td></tr>`;
        return;
    }

    // Sort by timestamp (most recent first)
    transactions.sort((a, b) => {
        const timeA = a.timestamp?._seconds || 0;
        const timeB = b.timestamp?._seconds || 0;
        return timeB - timeA;
    });

    transactions.forEach(transaction => {
        const row = document.createElement("tr");
        const isBurn = transaction.type === 'burn';
        const data = transaction.data;

        // Time Cell
        const timeCell = document.createElement("td");
        timeCell.textContent = formatDate(data.timestamp);

        // Type Cell
        const typeCell = document.createElement("td");
        typeCell.textContent = isBurn ? "BURN" : "CLAIM";
        typeCell.style.color = isBurn ? "#ff4444" : "#44ff44";
        typeCell.style.fontWeight = "bold";

        // Token Cell
        const tokenCell = document.createElement("td");
        
        // Make token clickable if we are in global view
        if (!currentToken) {
            const tokenAction = document.createElement("span");
            tokenAction.className = "token-action";
            tokenAction.textContent = data.tokenSymbol || "Unknown";
            tokenAction.onclick = () => loadToken(data.tokenAddress);
            tokenCell.appendChild(tokenAction);
        } else {
             // In token view, just show text 
             tokenCell.textContent = data.tokenSymbol || "Unknown";
        }

        // Add Pump.fun link icon
        const tokenLink = document.createElement("a");
        tokenLink.href = `https://pump.fun/${data.tokenAddress}`;
        tokenLink.target = "_blank";
        tokenLink.className = "external-link-icon";
        tokenLink.innerHTML = " 💊"; // Pill icon for Pump.fun
        tokenLink.title = "View on Pump.fun";
        tokenCell.appendChild(tokenLink);

        // Amount Cell
        const amountCell = document.createElement("td");
        amountCell.className = "right";
        if (isBurn) {
            amountCell.textContent = data.burnedTokens ? formatNumber(data.burnedTokens) : "-";
        } else {
            amountCell.textContent = "-"; // Claims don't have token amounts
        }

        // Value Cell
        const valueCell = document.createElement("td");
        valueCell.className = "right";
        
        if (isBurn) {
            // Burns show negative values in red
            valueCell.style.color = "#ff4444";
            if (showSolValue) {
                if (data.burnedSol) {
                    valueCell.textContent = "- " + formatSol(data.burnedSol);
                } else {
                     valueCell.textContent = "-";
                }
            } else {
                 valueCell.textContent = "- " + formatCurrency(parseFloat(data.burnedValueUsd || 0));
            }
        } else {
            // Claims show positive values in green
            valueCell.style.color = "#44ff44";
            if (showSolValue) {
                if (data.feesCollected) {
                    valueCell.textContent = "+ " + formatSol(parseFloat(data.feesCollected));
                } else {
                     valueCell.textContent = "-";
                }
            } else {
                // For claims, we need to convert SOL to USD if we have price data
                // For now, just show the SOL value converted to USD if possible
                // Since we don't have USD value for claims, we'll show SOL value
                if (data.feesCollected) {
                    // We don't have USD conversion for claims, so show SOL value
                    valueCell.textContent = "+ " + formatSol(parseFloat(data.feesCollected));
                } else {
                    valueCell.textContent = "-";
                }
            }
        }

        row.appendChild(timeCell);
        row.appendChild(typeCell);
        row.appendChild(tokenCell);
        row.appendChild(amountCell);
        row.appendChild(valueCell);

        ui.burnHistoryBody.appendChild(row);
    });
}

function updateSeo() {
    const title = currentToken ? `OPENBURN | ${currentToken}` : "OPENBURN STATS";
    const desc = currentToken 
        ? `View real-time burn stats for ${currentToken} on Pump.fun. Track burned tokens and value.`
        : "Real-time burn statistics for Solana tokens on Pump.fun. Track total value burned, recent transactions, and fees.";
    const url = currentToken ? `https://openburn.com/?token=${currentToken}` : "https://openburn.com/";

    document.title = title;
    
    // Helper to safely update meta tags
    const setMeta = (selector, attribute, value) => {
        const el = document.querySelector(selector);
        if (el) el.setAttribute(attribute, value);
    };

    setMeta('meta[name="description"]', "content", desc);
    setMeta('meta[property="og:title"]', "content", title);
    setMeta('meta[property="og:description"]', "content", desc);
    setMeta('meta[property="og:url"]', "content", url);
    setMeta('meta[property="twitter:title"]', "content", title);
    setMeta('meta[property="twitter:description"]', "content", desc);
    setMeta('meta[property="twitter:url"]', "content", url);
}

function updateUIState() {
    if (currentToken) {
        ui.navControls.classList.remove("hidden");
        ui.heroTitle.textContent = "Token Value Burned";
        ui.tokenDetails.classList.remove("hidden");
    } else {
        ui.navControls.classList.add("hidden");
        ui.heroTitle.textContent = "Total Pump.fun Value Burned";
        ui.tokenDetails.classList.add("hidden");
    }
    updateSeo();
}

function toggleValueUnit() {
    showSolValue = !showSolValue;
    ui.valueHeader.textContent = showSolValue ? "Value (SOL) ⟳" : "Value (USD) ⟳";
    // Refetch or re-render? Since we only change display, we could just re-render if we stored data.
    // For simplicity, let's just trigger a data refresh or if we had local data re-render.
    // Since we don't store "lastData" globally, I'll just call fetchData again which is fast enough or store data.
    // Let's store data to avoid network hit.
    if (window.lastData) {
        renderTransactionHistory(window.lastData.recentBurns, window.lastData.recentClaims);
    } else {
        fetchData();
    }
}

ui.valueHeader.addEventListener("click", toggleValueUnit);
ui.valueHeader.addEventListener("keypress", (e) => {
    if (e.key === "Enter" || e.key === " ") toggleValueUnit();
});

async function fetchData() {
    ui.apiStatus.textContent = "FETCHING...";
    ui.apiStatus.className = "status warn";

    const url = currentToken ? `${API_BASE}/${currentToken}` : API_BASE;

    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        
        // Cache data for toggling
        window.lastData = data;
        
        renderStats(data.stats);
        renderTransactionHistory(data.recentBurns, data.recentClaims);
        
        if (currentToken) {
            renderTokenDetails(data);
        }

        ui.apiStatus.textContent = "LIVE";
        ui.apiStatus.className = "status up";

    } catch (error) {
        console.error("Fetch error:", error);
        ui.apiStatus.textContent = "ERROR";
        ui.apiStatus.className = "status down";
        ui.totalValueBurned.textContent = "Error";
    }
}

function loadToken(tokenAddress) {
    if (tokenAddress === currentToken) return;
    currentToken = tokenAddress;
    const newUrl = new URL(window.location);
    newUrl.searchParams.set("token", tokenAddress);
    window.history.pushState({ token: tokenAddress }, "", newUrl);
    updateUIState();
    fetchData();
}

function loadGlobal() {
    if (!currentToken) return;
    currentToken = null;
    const newUrl = new URL(window.location);
    newUrl.searchParams.delete("token");
    window.history.pushState({ token: null }, "", newUrl);
    updateUIState();
    fetchData();
}

ui.btnBack.addEventListener("click", loadGlobal);

window.addEventListener("popstate", (event) => {
    const token = event.state?.token || new URLSearchParams(window.location.search).get("token");
    currentToken = token || null;
    updateUIState();
    fetchData();
});

function init() {
    const params = new URLSearchParams(window.location.search);
    currentToken = params.get("token");
    
    renderBrandMatrix(APP_NAME);
    updateUIState();
    fetchData();
    
    // Poll every 30 seconds
    setInterval(fetchData, 30000);
}

init();
