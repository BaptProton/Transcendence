import '../../css/stats.css';
import Chart from 'chart.js/auto'
import { sanitizeHTML } from '../utils/helpers';
import { authService } from '../services/auth.service';

export const MAX_MATCHES = 10;

type MatchHistory = {
    matchId: number;
    date: string;
    mode: string;
    player1: string;
    player2: string;
    score: string;
    player1Score: number;
    player2Score: number;
    winner: string;
    duration: number;
    created_at: string;
};

export function initStats(container: HTMLElement) {
    if (!container) return;
    container.innerHTML = `
        <div class="stats-dashboard">
            <div id="user-info">
                <p>Chargement...</p>
            </div>
        </div>
    `;

    fetchDashboard();
}

async function fetchDashboard() {
    const userInfoDiv = document.getElementById('user-info');
    if (!userInfoDiv) return;

    try {
        if (!authService.isAuthenticated()) {
            userInfoDiv.innerHTML = '<p style="color:red;">❌ Non connecté</p>';
            return;
        }

        const response = await authService.makeAuthenticatedRequest('/api/stats/dashboard', {
            method: 'GET'
        });

        if (!response.ok) {
            throw new Error(`Erreur ${response.status}`);
        }

        const data = await response.json();

        const safeDisplayName = sanitizeHTML(data.user.displayName || data.user.username);
        userInfoDiv.innerHTML = `
        <div id="stats-container">
            <section id="user-stats-base">
                <div class="name-user-stats-base">
                    <h2>${safeDisplayName}</h2>
                </div>
                <div class="graph-win-rate-stats-base">
                    <canvas id="graph-anneaux"></canvas>   
                </div>
                <div class="win-and-lose-stats-base">
                    <div class="win-stats-base">
                        <h2>Victoires<br>${data.user.wins}</h2>
                    </div>
                    <div class="loses-stats-base">
                        <h2>Défaites<br>${data.user.losses}</h2>
                    </div>
                </div>
                <div class="game-play-stats-base">
                    <h2>Parties jouées<br>${data.user.totalGames}</h2>
                </div>
            </section>
            
            <section id="follow-win-game">
                <div class="name-graph">
                    <h2>Serie de victoires</h2>
                </div>
                <div class="graph-win-game">
                    <canvas id="graph-line-win-streak"></canvas>
                </div>
            </section>

            <section id="follow-score-game">
                <div class="graph-bar-name">
                    <h2>Score par partie<h2>
                </div>
                <div class="graph-bar">
                    <canvas id="graph-bar-score"></canvas>
                </div>
            </section>

            <section id="tab-history-match">
                <table>
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Heure</th>
                            <th>Mode</th>
                            <th>Gagnant</th>
                            <th>Score</th>
                            <th>Temps</th>
                        </tr>
                    </thead>
                    <tbody id="history-body">

                    </tbody>
                </table>
                
            </section>
       </div>
        `;
        renderGraphWinRate(data.user.wins, data.user.losses);
        renderGraphWinStreak(data.matchResults, data.user.totalGames);
        renderGraphScoreBar(data.userScores, data.opponentScores, safeDisplayName, data.user.totalGames);
        const tbody = document.getElementById("history-body");
        if (!tbody) return;
        const formatGameMode = (mode: string): string => {
            switch (mode) {
                case 'tournament': return 'Tournoi';
                case '2p_local': return 'Local 2J';
                case 'vs_ai': return 'vs IA';
                default: return mode;
            }
        };

        tbody.innerHTML = data.matches.map((m: MatchHistory) => {
            const isWinner = (m.winner === data.user.displayName || m.winner === data.user.username);
            return `
            <tr>
                <td>${new Date(m.date).toLocaleDateString()}</td>
                <td>${new Date(m.date + 'Z').toLocaleTimeString('fr-CH', {
                    hour: '2-digit',
                    minute: '2-digit'
                })}</td>
                <td>${sanitizeHTML(formatGameMode(m.mode))}</td>
                <td class="${isWinner ? 'text-success' : 'text-danger'}">
                    ${sanitizeHTML(m.winner || 'Inconnu')}
                </td>
                <td>${sanitizeHTML(m.score)}</td>
                <td>${m.duration}s</td>
            </tr>
            `;
        }).join("");
    } catch (error) {
        console.error('[ERROR] Erreur:', error);
        userInfoDiv.innerHTML = `
            <p style="color:red;">Erreur de chargement</p>
        `;
    }
}

function renderGraphWinRate(wins: number, losses: number) {
    const ctx = document.getElementById('graph-anneaux') as HTMLCanvasElement | null;
    if (!ctx) {
        console.error("[ERROR] Canvas #graph-anneaux introuvable !");
        return;
    }

    new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ["Win", "Lose"],
            datasets: [{
                data: [wins, losses],
                backgroundColor: ["#00babc", "#f05454"]
            }]
        },
        options: {
            cutout: "90%",
            plugins: {
                legend: {display: false }
            },
            backgroundColor: "transparent"
        },
        plugins: [{
            id: 'centerText',
            afterDraw(chart) {
                const { ctx, chartArea } = chart;
                ctx.save(),
                ctx.font = 'bold 22px Arial';
                ctx.fillStyle = '#ffffff';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                
                const winrate = Math.round(wins / (wins + losses) * 100);

                ctx.fillText(winrate + '%',
                    (chartArea.left + chartArea.right) / 2,
                    (chartArea.top + chartArea.bottom) / 2
                )
            }
        }]
    });
}

function renderGraphWinStreak(results: number[], totalGames: number) {
    const ctx = document.getElementById('graph-line-win-streak') as HTMLCanvasElement | null;
    if (!ctx) return;
    
    const streak = [];
    let current = 0;

    for (let r of results) {
        if (r === 1) current++;
        else current = 0;
        streak.push(current);
    }

    const startSlice = Math.max(0, streak.length - MAX_MATCHES);
    const visibleStreak = streak.slice(startSlice);

    const startLabel = Math.max(1, totalGames - visibleStreak.length + 1);
    const labels = visibleStreak.map((_, index) => `Match ${startLabel + index}`);

    new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label:"Win Streak",
                data: streak,
                borderColor: "#ffffff",
                backgroundColor: "rgba(0, 186, 188, 0.3)",
                borderWidth: 3,
                tension: 0.3,
                fill: true,
                pointRadius: 5,
                pointBackgroundColor: "#00babc"
            }]      
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    min: 0,
                    ticks: {
                        stepSize: 1,
                        color: "#fff"
                    },
                    grid: {
                        color: "rgba(255,255,255,0.1)"
                    }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: "#fff"}
                }
            },
            plugins: {
                legend: { display: false }
            }
        }
    });
}

function renderGraphScoreBar(userScores: number[], opponentScores: number[], user: string, totalGames: number) {
    const ctx = document.getElementById('graph-bar-score') as HTMLCanvasElement | null;
    if (!ctx) return;


    const existingChart = Chart.getChart(ctx);
    if (existingChart) existingChart.destroy();


    const startSlice = Math.max(0, userScores.length - MAX_MATCHES);
    const visibleUserScores = userScores.slice(startSlice);
    const visibleOpponentScores = opponentScores.slice(startSlice);

    const startLabel = Math.max(1, totalGames - visibleUserScores.length + 1);
    const labels = visibleUserScores.map((_, index) => `Match ${startLabel + index}`);

    new Chart(ctx, {
        type: "bar",
        data: {
            labels: labels,
            datasets: [
                {
                    label: user,
                    data: visibleUserScores,
                    backgroundColor: "rgba(0, 186, 188, 0.7)",
                    borderColor: "#00babc",
                    borderWidth: 2
                },
                {
                    label: "Adversaire",
                    data: visibleOpponentScores,
                    backgroundColor: "rgba(255, 99, 132, 0.7)",
                    borderColor: "#ff4861",
                    borderWidth: 2
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { stepSize: 1 },
                    grid: { color: "rgba(255,255,255,0.1)" }
                },
                x: {
                    grid: { display: false }
                }
            },
            plugins: {
                legend: { display: false }
            }
        }
    });
}