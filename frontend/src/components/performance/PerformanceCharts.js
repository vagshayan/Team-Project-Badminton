import React from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Pie, Line, Bar } from 'react-chartjs-2';
import { useTheme } from '../../context/ThemeContext';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

export function WinLossPieChart({ summary }) {
  const { isDarkMode } = useTheme();
  const wins = summary?.matchesWon || 0;
  const losses = summary?.matchesLost || 0;
  const hasData = wins + losses > 0;

  const data = {
    labels: ['Matches Won', 'Matches Lost'],
    datasets: [
      {
        data: hasData ? [wins, losses] : [0, 0],
        backgroundColor: ['#10b981', '#ef4444'],
        borderColor: isDarkMode ? '#1e293b' : '#ffffff',
        borderWidth: 2,
        hoverOffset: 6,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          color: isDarkMode ? '#e2e8f0' : '#334155',
          font: { family: 'Inter', size: 12, weight: 600 },
          padding: 16,
        },
      },
      tooltip: {
        callbacks: {
          label: (ctx) => ` ${ctx.label}: ${ctx.raw} (${summary?.totalMatches ? Math.round((ctx.raw / summary.totalMatches) * 100) : 0}%)`,
        },
      },
    },
  };

  if (!hasData) {
    return (
      <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
        No completed match outcomes recorded
      </div>
    );
  }

  return (
    <div style={{ height: 220, position: 'relative' }}>
      <Pie data={data} options={options} />
    </div>
  );
}

export function PerformanceTrendLineChart({ matchHistory }) {
  const { isDarkMode } = useTheme();
  const validMatches = matchHistory && matchHistory.length > 0
    ? [...matchHistory].reverse() // chronological
    : [];

  let cumWins = 0;
  const labels = validMatches.map((m, idx) => `M${idx + 1}`);
  const winRateTrend = validMatches.map((m, idx) => {
    if (m.isWinner) cumWins += 1;
    return Math.round((cumWins / (idx + 1)) * 100);
  });

  const data = {
    labels: labels.length > 0 ? labels : ['M1'],
    datasets: [
      {
        label: 'Cumulative Win %',
        data: winRateTrend.length > 0 ? winRateTrend : [0],
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59, 130, 246, 0.15)',
        tension: 0.35,
        fill: true,
        pointBackgroundColor: validMatches.map((m) => (m.isWinner ? '#10b981' : '#ef4444')),
        pointBorderColor: '#ffffff',
        pointRadius: 5,
        pointHoverRadius: 7,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: {
        min: 0,
        max: 100,
        ticks: {
          callback: (v) => `${v}%`,
          color: isDarkMode ? '#94a3b8' : '#64748b',
          font: { family: 'Inter', size: 11 },
        },
        grid: { color: isDarkMode ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)' },
      },
      x: {
        ticks: { color: isDarkMode ? '#94a3b8' : '#64748b', font: { family: 'Inter', size: 11 } },
        grid: { display: false },
      },
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          afterLabel: (ctx) => {
            const m = validMatches[ctx.dataIndex];
            return m ? `Opponent: ${m.opponentName} (${m.outcome})` : '';
          },
        },
      },
    },
  };

  if (validMatches.length === 0) {
    return (
      <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
        No match trend data available
      </div>
    );
  }

  return (
    <div style={{ height: 220, position: 'relative' }}>
      <Line data={data} options={options} />
    </div>
  );
}

export function PointsComparisonBarChart({ summary, matchHistory, sport }) {
  const { isDarkMode } = useTheme();
  const validMatches = matchHistory && matchHistory.length > 0
    ? [...matchHistory].slice(0, 8).reverse()
    : [];

  const labels = validMatches.map((m, idx) => `M${idx + 1}`);
  const hasDetailedPoints = validMatches.some((m) => m.pointsScored > 0 || m.pointsConceded > 0);

  const scoredData = validMatches.map((m) => {
    if (hasDetailedPoints) return m.pointsScored;
    return m.setsWon || m.gamesWon || m.boardsWon || (m.isWinner ? 1 : 0);
  });

  const concededData = validMatches.map((m) => {
    if (hasDetailedPoints) return m.pointsConceded;
    return m.setsLost || m.gamesLost || m.boardsLost || (m.isWinner ? 0 : 1);
  });

  const primaryLabel = hasDetailedPoints
    ? 'Points Scored'
    : sport === 'badminton'
      ? 'Sets Won'
      : sport === 'table-tennis'
        ? 'Games Won'
        : 'Boards Won';

  const secondaryLabel = hasDetailedPoints
    ? 'Points Conceded'
    : sport === 'badminton'
      ? 'Sets Lost'
      : sport === 'table-tennis'
        ? 'Games Lost'
        : 'Boards Lost';

  const data = {
    labels: labels.length > 0 ? labels : ['Matches'],
    datasets: [
      {
        label: primaryLabel,
        data: scoredData.length > 0 ? scoredData : [0],
        backgroundColor: '#3b82f6',
        borderRadius: 4,
      },
      {
        label: secondaryLabel,
        data: concededData.length > 0 ? concededData : [0],
        backgroundColor: '#f97316',
        borderRadius: 4,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: {
        beginAtZero: true,
        ticks: { color: isDarkMode ? '#94a3b8' : '#64748b', font: { family: 'Inter', size: 11 } },
        grid: { color: isDarkMode ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)' },
      },
      x: {
        ticks: { color: isDarkMode ? '#94a3b8' : '#64748b', font: { family: 'Inter', size: 11 } },
        grid: { display: false },
      },
    },
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          color: isDarkMode ? '#e2e8f0' : '#334155',
          font: { family: 'Inter', size: 11, weight: 600 },
          padding: 12,
        },
      },
    },
  };

  if (validMatches.length === 0) {
    return (
      <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
        No score comparisons recorded
      </div>
    );
  }

  return (
    <div style={{ height: 220, position: 'relative' }}>
      <Bar data={data} options={options} />
    </div>
  );
}

export function MatchHistoryTimelineChart({ matchHistory }) {
  const { isDarkMode } = useTheme();
  const validMatches = matchHistory && matchHistory.length > 0
    ? [...matchHistory].slice(0, 10).reverse()
    : [];

  const labels = validMatches.map((m, idx) => `M${idx + 1}`);
  const outcomes = validMatches.map((m) => (m.isWinner ? 1 : -1));

  const data = {
    labels: labels.length > 0 ? labels : ['M1'],
    datasets: [
      {
        label: 'Match Outcome (+1 Win, -1 Loss)',
        data: outcomes.length > 0 ? outcomes : [0],
        backgroundColor: outcomes.map((val) => (val > 0 ? '#10b981' : '#ef4444')),
        borderRadius: 4,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: {
        min: -1.2,
        max: 1.2,
        ticks: {
          stepSize: 1,
          callback: (v) => (v === 1 ? 'WIN' : v === -1 ? 'LOSS' : ''),
          color: isDarkMode ? '#94a3b8' : '#64748b',
          font: { family: 'Inter', size: 10, weight: 700 },
        },
        grid: { color: isDarkMode ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)' },
      },
      x: {
        ticks: { color: isDarkMode ? '#94a3b8' : '#64748b', font: { family: 'Inter', size: 11 } },
        grid: { display: false },
      },
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx) => {
            const m = validMatches[ctx.dataIndex];
            return m ? ` ${m.outcome} vs ${m.opponentName} (${m.tournamentName})` : '';
          },
        },
      },
    },
  };

  if (validMatches.length === 0) {
    return (
      <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
        No match timeline available
      </div>
    );
  }

  return (
    <div style={{ height: 220, position: 'relative' }}>
      <Bar data={data} options={options} />
    </div>
  );
}

export function MonthlyPerformanceChart({ monthlyStats }) {
  const { isDarkMode } = useTheme();
  const hasData = monthlyStats && monthlyStats.length > 0;

  const labels = hasData ? monthlyStats.map((m) => m.month) : ['No Data'];
  const matchesData = hasData ? monthlyStats.map((m) => m.matches) : [0];
  const winsData = hasData ? monthlyStats.map((m) => m.wins) : [0];
  const lossesData = hasData ? monthlyStats.map((m) => m.losses) : [0];

  const data = {
    labels,
    datasets: [
      {
        label: 'Matches Played',
        data: matchesData,
        backgroundColor: '#8b5cf6',
        borderRadius: 4,
      },
      {
        label: 'Wins',
        data: winsData,
        backgroundColor: '#10b981',
        borderRadius: 4,
      },
      {
        label: 'Losses',
        data: lossesData,
        backgroundColor: '#ef4444',
        borderRadius: 4,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: {
        beginAtZero: true,
        ticks: { stepSize: 1, color: isDarkMode ? '#94a3b8' : '#64748b', font: { family: 'Inter', size: 11 } },
        grid: { color: isDarkMode ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)' },
      },
      x: {
        ticks: { color: isDarkMode ? '#94a3b8' : '#64748b', font: { family: 'Inter', size: 11 } },
        grid: { display: false },
      },
    },
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          color: isDarkMode ? '#e2e8f0' : '#334155',
          font: { family: 'Inter', size: 11, weight: 600 },
          padding: 12,
        },
      },
    },
  };

  if (!hasData) {
    return (
      <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
        No monthly tournament records found
      </div>
    );
  }

  return (
    <div style={{ height: 220, position: 'relative' }}>
      <Bar data={data} options={options} />
    </div>
  );
}

export function PerformanceProgressChart({ progressComparison, summary }) {
  const { isDarkMode } = useTheme();
  const hasComp = progressComparison && progressComparison.hasComparison;

  if (!hasComp) {
    return (
      <div style={{ height: 220, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 13, gap: 8, padding: 16, textAlign: 'center' }}>
        <div style={{ fontWeight: 600, color: 'var(--text)' }}>Baseline Tournament Stage</div>
        <div>Comparison becomes available once the player participates in two or more tournament editions.</div>
      </div>
    );
  }

  const { currentTournament: curr, previousTournament: prev } = progressComparison;
  const labels = ['Win %', 'Matches', 'Wins', 'Losses'];
  const prevData = [prev.winPercentage, prev.matches, prev.wins, prev.losses];
  const currData = [curr.winPercentage, curr.matches, curr.wins, curr.losses];

  const data = {
    labels,
    datasets: [
      {
        label: `Previous: ${prev.name.substring(0, 16)}`,
        data: prevData,
        backgroundColor: 'rgba(148, 163, 184, 0.7)',
        borderRadius: 4,
      },
      {
        label: `Current: ${curr.name.substring(0, 16)}`,
        data: currData,
        backgroundColor: '#3b82f6',
        borderRadius: 4,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: {
        beginAtZero: true,
        ticks: { color: isDarkMode ? '#94a3b8' : '#64748b', font: { family: 'Inter', size: 11 } },
        grid: { color: isDarkMode ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)' },
      },
      x: {
        ticks: { color: isDarkMode ? '#94a3b8' : '#64748b', font: { family: 'Inter', size: 11 } },
        grid: { display: false },
      },
    },
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          color: isDarkMode ? '#e2e8f0' : '#334155',
          font: { family: 'Inter', size: 11, weight: 600 },
          padding: 12,
        },
      },
    },
  };

  return (
    <div style={{ height: 220, position: 'relative' }}>
      <Bar data={data} options={options} />
    </div>
  );
}

