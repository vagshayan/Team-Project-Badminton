import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const CAT_LABELS = {
  'singles-men': 'Singles — Men', 'singles-women': 'Singles — Women',
  'doubles-men': 'Doubles — Men', 'doubles-women': 'Doubles — Women', 'mixed-doubles': 'Mixed Doubles',
};

const DOUBLES_CATEGORIES = new Set(['doubles-men', 'doubles-women', 'mixed-doubles']);
const SINGLES = ['singles-men', 'singles-women'];

const formatCsvCell = (value) => {
  const text = value == null ? '' : String(value);
  return `"${text.replace(/"/g, '""')}"`;
};

const downloadCsv = (filename, headers, rows) => {
  const csvContent = headers.join(',') + '\n'
    + rows.map((row) => row.map(formatCsvCell).join(',')).join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const buildPairRows = (registrations) => {
  const regByKey = {};
  registrations.forEach((r) => {
    const roll = r.rollNumber?.trim().toUpperCase();
    const tournamentId = r.tournament?._id?.toString() || r.tournament;
    if (!roll || !tournamentId) return;
    regByKey[`${tournamentId}|${roll}`] = r;
  });

  const seenPairs = new Set();
  const rows = [];

  registrations.forEach((r) => {
    const category = r.tournament?.category;
    if (!DOUBLES_CATEGORIES.has(category)) return;
    const roll = r.rollNumber?.trim().toUpperCase();
    const partnerRoll = r.partnerRollNumber?.trim().toUpperCase();
    const tournamentId = r.tournament?._id?.toString() || r.tournament;
    if (!roll || !partnerRoll || !tournamentId) return;
    const partner = regByKey[`${tournamentId}|${partnerRoll}`];
    if (!partner) return;
    const partnerMatches = partner.partnerRollNumber?.trim().toUpperCase() === roll;
    if (!partnerMatches) return;
    if (r.status !== 'confirmed' || partner.status !== 'confirmed') return;
    const pairKey = [roll, partnerRoll].sort().join('|');
    if (seenPairs.has(pairKey)) return;
    seenPairs.add(pairKey);

    rows.push([
      r.playerName, r.rollNumber, r.nicNo || '', r.department || '',
      r.phone || '', r.email || '',
      partner.playerName, partner.rollNumber, partner.nicNo || '',
      partner.department || '', partner.phone || '', partner.email || '',
      r.tournament?.year || '', 'APPROVED',
    ]);
  });

  return rows;
};

// ── 1. Export Player List (CSV) ──────────────────────────
export const exportPlayerListCSV = (tournament, registrations) => {
  if (DOUBLES_CATEGORIES.has(tournament.category)) {
    const headers = [
      'Player 1 Name', 'Player 1 Reg No', 'Player 1 NIC', 'Player 1 Department', 'Player 1 Phone', 'Player 1 Email',
      'Player 2 Name', 'Player 2 Reg No', 'Player 2 NIC', 'Player 2 Department', 'Player 2 Phone', 'Player 2 Email',
      'Year', 'Pair Status',
    ];
    const rows = buildPairRows(registrations);
    downloadCsv(`${tournament.year}_${tournament.category}_pairs.csv`, headers, rows);
    return;
  }

  const headers = ['Player Name', 'Reg No', 'Department', 'Email', 'Phone', 'Partner Name', 'Partner Reg No', 'Status'];
  const rows = registrations.map(r => [
    r.playerName, r.rollNumber, r.department, r.email, r.phone,
    r.partnerName || 'N/A', r.partnerRollNumber || 'N/A', r.status,
  ]);
  downloadCsv(`${tournament.year}_${tournament.category}_players.csv`, headers, rows);
};

// ── 2. Export Full Player Master Report (PDF) ────────────
export const exportFullPlayerReportPDF = (tournament, registrations) => {
  const doc = new jsPDF({ orientation: 'landscape' });

  doc.setFontSize(22);
  doc.setTextColor(59, 130, 246);
  doc.text(`${tournament.sport.toUpperCase()} - FULL PARTICIPANT MASTER REPORT`, 14, 18);

  doc.setFontSize(14);
  doc.setTextColor(0, 0, 0);
  doc.text(`${tournament.year} - ${CAT_LABELS[tournament.category]}`, 14, 26);

  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text(`Venue: ${tournament.venue} | Generated on: ${new Date().toLocaleString()}`, 14, 32);

  const tableData = registrations.map((r, i) => [
    i + 1, r.playerName, r.rollNumber, r.nicNo, r.department,
    r.phone, r.email, r.address, r.partnerName || '-', r.status.toUpperCase(),
  ]);

  autoTable(doc, {
    startY: 38,
    head: [['#', 'NAME', 'REG NO', 'NIC NO', 'FACULTY', 'PHONE', 'EMAIL', 'ADDRESS', 'PARTNER', 'STATUS']],
    body: tableData,
    theme: 'grid',
    headStyles: { fillColor: [59, 130, 246], fontSize: 8 },
    bodyStyles: { fontSize: 7, cellPadding: 2 },
    columnStyles: {
      0: { cellWidth: 8 }, 1: { cellWidth: 35 }, 2: { cellWidth: 25 },
      3: { cellWidth: 25 }, 4: { cellWidth: 35 }, 5: { cellWidth: 20 },
      6: { cellWidth: 35 }, 7: { cellWidth: 40 }, 8: { cellWidth: 25 }, 9: { cellWidth: 20 },
    },
    styles: { overflow: 'linebreak' },
    margin: { top: 40 },
  });

  doc.save(`${tournament.year}_${tournament.category}_master_report.pdf`);
};

// ── 3. Export Tournament Bracket PDF (visual draw sheet) ─
export const exportTournamentResultPDF = (tournament, matches) => {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const PAGE_W = 297;
  const PAGE_H = 210;
  const MARGIN = 10;
  const HEADER_H = 22;
  const FOOTER_H = 8;

  const isDoubles = DOUBLES_CATEGORIES.has(tournament.category);

  // Header
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, PAGE_W, 18, 'F');
  doc.setFontSize(12);
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.text(
    `${(tournament.sport || '').toUpperCase()} ${tournament.year} — ${CAT_LABELS[tournament.category] || tournament.category} — DRAW SHEET`,
    MARGIN, 12
  );
  doc.setFontSize(7);
  doc.setTextColor(180, 180, 180);
  doc.text(
    `University of Jaffna Sports Portal | Printed: ${new Date().toLocaleString()}`,
    PAGE_W - MARGIN, 12, { align: 'right' }
  );

  // Filter and group matches
  function isHiddenBye(m) {
    return m.isCompleted === true && (!m.player1 || !m.player2);
  }

  const roundsMap = {};
  matches.forEach(m => {
    if (!roundsMap[m.round]) roundsMap[m.round] = [];
    roundsMap[m.round].push(m);
  });
  const roundNums = Object.keys(roundsMap).map(Number).sort((a, b) => a - b);

  const visibleByRound = {};
  roundNums.forEach(r => {
    visibleByRound[r] = (roundsMap[r] || [])
      .filter(m => !isHiddenBye(m))
      .sort((a, b) => a.matchNumber - b.matchNumber);
  });

  if (roundNums.length === 0) {
    doc.setFontSize(14);
    doc.setTextColor(100);
    doc.text('No matches found for this tournament.', PAGE_W / 2, PAGE_H / 2, { align: 'center' });
    doc.save(`${tournament.year}_${tournament.category}_draw_bracket.pdf`);
    return;
  }

  // Position algorithm — same verified logic as BracketsView.js
  const PX_CARD_H = 96;
  const PX_GAP = 28;
  const pxPos = {};

  const firstRound = roundNums[0];
  const round1All = (roundsMap[firstRound] || []).slice().sort((a, b) => a.matchNumber - b.matchNumber);
  round1All.forEach((m, i) => {
    pxPos[m._id] = { top: i * (PX_CARD_H + PX_GAP), roundIdx: 0 };
  });

  for (let ri = 1; ri < roundNums.length; ri++) {
    const r = roundNums[ri];
    const prevAll = roundsMap[roundNums[ri - 1]] || [];
    const feedMap = {};
    prevAll.forEach(pm => {
      if (!pm.nextMatchId) return;
      if (!feedMap[pm.nextMatchId]) feedMap[pm.nextMatchId] = [];
      feedMap[pm.nextMatchId].push(pm);
    });
    const thisRoundAll = (roundsMap[r] || []).slice().sort((a, b) => a.matchNumber - b.matchNumber);
    thisRoundAll.forEach(m => {
      const feeders = feedMap[m._id] || [];
      const centers = feeders.map(f => pxPos[f._id].top + PX_CARD_H / 2);
      const avg = centers.length > 0 ? centers.reduce((a, b) => a + b, 0) / centers.length : 0;
      pxPos[m._id] = { top: avg - PX_CARD_H / 2, roundIdx: ri };
    });
  }

  // Scale to fit A4 landscape
  const totalRounds = roundNums.length;
  const DRAW_H = PAGE_H - HEADER_H - FOOTER_H;
  const DRAW_W = PAGE_W - 2 * MARGIN;

  const allTops = Object.values(pxPos).map(p => p.top + PX_CARD_H);
  const totalPxH = Math.max(...allTops);
  const SCALE = Math.min(DRAW_H / totalPxH, 1);

  const COL_W_MM = Math.min(isDoubles ? 55 : 45, (DRAW_W - (totalRounds - 1) * 4) / totalRounds);
  const COL_GAP_MM = (DRAW_W - totalRounds * COL_W_MM) / Math.max(totalRounds - 1, 1);
  const CARD_H_MM = Math.max(PX_CARD_H * SCALE, isDoubles ? 10 : 8);

  function mmX(roundIdx) { return MARGIN + roundIdx * (COL_W_MM + COL_GAP_MM); }
  function mmY(pxTop) { return HEADER_H + pxTop * SCALE; }

  function getDisplayName(player) {
    if (!player) return 'TBD';
    if (isDoubles && player.partnerName) return `${player.playerName} & ${player.partnerName}`;
    return player.playerName || 'TBD';
  }

  // Round labels
  function getRoundLabel(roundIdx, total) {
    const remaining = total - roundIdx;
    if (remaining === 1) return 'FINAL';
    if (remaining === 2) return 'SEMI FINALS';
    if (remaining === 3) return 'QUARTER FINALS';
    return `ROUND ${roundIdx + 1}`;
  }

  roundNums.forEach((r, rIdx) => {
    doc.setFontSize(6);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(59, 130, 246);
    doc.text(
      getRoundLabel(rIdx, roundNums.length),
      mmX(rIdx) + COL_W_MM / 2, HEADER_H - 2,
      { align: 'center' }
    );
  });

  // Connector lines
  roundNums.forEach((r, ri) => {
    if (ri >= roundNums.length - 1) return;
    const prevVisible = visibleByRound[r] || [];
    const groups = {};
    prevVisible.forEach(m => {
      if (!m.nextMatchId || !pxPos[m.nextMatchId]) return;
      if (!groups[m.nextMatchId]) groups[m.nextMatchId] = [];
      groups[m.nextMatchId].push(m);
    });

    Object.entries(groups).forEach(([targetId, sources]) => {
      const targetPos = pxPos[targetId];
      if (!targetPos) return;
      const targetX = mmX(targetPos.roundIdx);
      const targetCY = mmY(targetPos.top + PX_CARD_H / 2);
      const sourceX = mmX(ri) + COL_W_MM;
      const stubs = sources.filter(s => pxPos[s._id]).map(s => ({
        x1: sourceX,
        y1: mmY(pxPos[s._id].top + PX_CARD_H / 2),
      }));
      if (stubs.length === 0) return;
      const midX = (sourceX + targetX) / 2;

      doc.setDrawColor(100, 130, 180);
      doc.setLineWidth(0.3);

      if (stubs.length === 1) {
        const s = stubs[0];
        doc.line(s.x1, s.y1, midX, s.y1);
        doc.line(midX, s.y1, midX, targetCY);
        doc.line(midX, targetCY, targetX, targetCY);
      } else {
        stubs.forEach(s => doc.line(s.x1, s.y1, midX, s.y1));
        const ys = stubs.map(s => s.y1);
        doc.line(midX, Math.min(...ys), midX, Math.max(...ys));
        doc.line(midX, targetCY, targetX, targetCY);
      }
    });
  });

  // Match cards
  roundNums.forEach((r, rIdx) => {
    (visibleByRound[r] || []).forEach(m => {
      const pos = pxPos[m._id];
      if (!pos) return;

      const x = mmX(rIdx);
      const y = mmY(pos.top);
      const h = CARD_H_MM;
      const halfH = h / 2;
      const fontSize = Math.max(4.5, Math.min(6.5, h * 0.2));

      // Card background and border
      doc.setFillColor(m.isCompleted ? 240 : 250, 250, 255);
      doc.setDrawColor(m.isCompleted ? 16 : 180, m.isCompleted ? 185 : 180, m.isCompleted ? 129 : 200);
      doc.setLineWidth(m.isCompleted ? 0.5 : 0.25);
      doc.roundedRect(x, y, COL_W_MM, h, 0.8, 0.8, 'FD');

      // Divider
      doc.setDrawColor(200, 200, 200);
      doc.setLineWidth(0.15);
      doc.line(x + 1, y + halfH, x + COL_W_MM - 1, y + halfH);

      doc.setFontSize(fontSize);

      const p1Name = getDisplayName(m.player1);
      const p2Name = getDisplayName(m.player2);
      const p1IsWinner = m.isCompleted && m.winner?._id === m.player1?._id;
      const p2IsWinner = m.isCompleted && m.winner?._id === m.player2?._id;

      // Player 1
      doc.setFont('helvetica', p1IsWinner ? 'bold' : 'normal');
      doc.setTextColor(p1IsWinner ? 0 : (m.isCompleted ? 120 : 40),
        p1IsWinner ? 0 : (m.isCompleted ? 120 : 40),
        p1IsWinner ? 0 : (m.isCompleted ? 120 : 40));
      const p1Truncated = doc.splitTextToSize(p1Name, COL_W_MM - (m.isCompleted ? 8 : 3))[0];
      doc.text(p1Truncated, x + 1.5, y + halfH * 0.65);

      if (m.isCompleted) {
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(p1IsWinner ? 16 : 180, p1IsWinner ? 185 : 50, p1IsWinner ? 129 : 50);
        doc.text(p1IsWinner ? 'W' : 'L', x + COL_W_MM - 4.5, y + halfH * 0.65);
      }

      // Player 2
      doc.setFont('helvetica', p2IsWinner ? 'bold' : 'normal');
      doc.setTextColor(p2IsWinner ? 0 : (m.isCompleted ? 120 : 40),
        p2IsWinner ? 0 : (m.isCompleted ? 120 : 40),
        p2IsWinner ? 0 : (m.isCompleted ? 120 : 40));
      const p2Truncated = doc.splitTextToSize(p2Name, COL_W_MM - (m.isCompleted ? 8 : 3))[0];
      doc.text(p2Truncated, x + 1.5, y + halfH * 1.6);

      if (m.isCompleted) {
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(p2IsWinner ? 16 : 180, p2IsWinner ? 185 : 50, p2IsWinner ? 129 : 50);
        doc.text(p2IsWinner ? 'W' : 'L', x + COL_W_MM - 4.5, y + halfH * 1.6);
      }
    });
  });

  // Footer
  doc.setFontSize(7);
  doc.setTextColor(150);
  doc.setFont('helvetica', 'normal');
  doc.text(
    'Official Tournament Draw Sheet — University of Jaffna Sports Portal',
    PAGE_W / 2, PAGE_H - 3, { align: 'center' }
  );

  doc.save(`${tournament.year}_${tournament.category}_draw_bracket.pdf`);
};

// ── 4. Export Individual Player Details Slip ─────────────
export const exportSinglePlayerPDF = (registration) => {
  const doc = new jsPDF();
  const t = registration.tournament || {};

  doc.setFillColor(59, 130, 246);
  doc.rect(0, 0, 210, 40, 'F');
  doc.setFontSize(24);
  doc.setTextColor(255, 255, 255);
  doc.text('PLAYER REGISTRATION SLIP', 14, 28);

  doc.setTextColor(0, 0, 0);
  doc.setFontSize(10);
  doc.text('TOURNAMENT DETAILS:', 14, 55);
  doc.setFontSize(14);
  doc.text(`${t.sport?.toUpperCase()} ${t.year} - ${CAT_LABELS[t.category] || t.category}`, 14, 62);

  autoTable(doc, {
    startY: 75,
    body: [
      ['PLAYER FULL NAME', registration.playerName],
      ['REGISTRATION NO', registration.rollNumber],
      ['NIC / IDENTITY NO', registration.nicNo],
      ['FACULTY / DEPT', registration.department],
      ['EMAIL ADDRESS', registration.email],
      ['PHONE NUMBER', registration.phone],
      ['HOME ADDRESS', registration.address],
    ],
    theme: 'grid',
    styles: { fontSize: 13, cellPadding: 8 },
    columnStyles: { 0: { fontStyle: 'bold', fillColor: [245, 245, 245], cellWidth: 60 } },
  });

  if (registration.partnerName) {
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text('PARTNER DETAILS (DOUBLES):', 14, doc.lastAutoTable.finalY + 15);

    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 20,
      body: [
        ['PARTNER NAME', registration.partnerName],
        ['PARTNER REG NO', registration.partnerRollNumber],
      ],
      theme: 'grid',
      styles: { fontSize: 13, cellPadding: 8 },
      columnStyles: { 0: { fontStyle: 'bold', fillColor: [245, 245, 245], cellWidth: 60 } },
    });
  }

  const finalY = doc.lastAutoTable.finalY + 30;
  doc.setFontSize(10);
  doc.setTextColor(0);
  doc.text('____________________________', 14, finalY);
  doc.text('Admin Signature / Seal', 14, finalY + 7);
  doc.text('____________________________', 130, finalY);
  doc.text('Player Signature', 130, finalY + 7);

  doc.setFontSize(9);
  doc.setTextColor(150);
  doc.text(
    `Doc Ref: REG-${registration._id.substring(18).toUpperCase()} | Printed on ${new Date().toLocaleString()}`,
    14, doc.internal.pageSize.height - 10
  );

  doc.save(`PlayerSlip_${registration.rollNumber.replace(/\//g, '_')}.pdf`);
};

// ── 5. Export Generic Filtered Player List (PDF) ─────────
export const exportFilteredPlayersPDF = (registrations, title) => {
  const doc = new jsPDF({ orientation: 'landscape' });

  doc.setFontSize(20);
  doc.setTextColor(59, 130, 246);
  doc.text(title.toUpperCase(), 14, 18);

  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 25);

  const tableData = registrations.map((r, i) => [
    i + 1, r.playerName, r.rollNumber, r.nicNo, r.department,
    r.phone, r.email, r.address, r.tournament?.year || 'N/A', r.status.toUpperCase(),
  ]);

  autoTable(doc, {
    startY: 32,
    head: [['#', 'NAME', 'REG NO', 'NIC NO', 'FACULTY', 'PHONE', 'EMAIL', 'ADDRESS', 'YEAR', 'STATUS']],
    body: tableData,
    theme: 'grid',
    headStyles: { fillColor: [59, 130, 246], fontSize: 8 },
    bodyStyles: { fontSize: 7, cellPadding: 2 },
    columnStyles: {
      0: { cellWidth: 8 }, 1: { cellWidth: 35 }, 2: { cellWidth: 25 },
      3: { cellWidth: 25 }, 4: { cellWidth: 30 }, 5: { cellWidth: 20 },
      6: { cellWidth: 30 }, 7: { cellWidth: 40 }, 8: { cellWidth: 15 }, 9: { cellWidth: 20 },
    },
    styles: { overflow: 'linebreak' },
    margin: { top: 35 },
  });

  doc.save('filtered_players_report.pdf');
};

// ── 6. Export Filtered Players CSV ───────────────────────
export const exportFilteredPlayersCSV = (registrations, title) => {
  const headers = ['Player Name', 'Reg No', 'NIC', 'Department', 'Phone', 'Email', 'Address', 'Year', 'Status'];
  const rows = registrations.map(r => [
    r.playerName, r.rollNumber,
    r.nicNo ? `\t${r.nicNo}` : '',
    r.department, r.phone, r.email, r.address,
    r.tournament?.year || 'N/A', r.status,
  ]);

  const csvContent = `${title}\n`
    + headers.join(',') + '\n'
    + rows.map(e => e.map(cell => `"${cell}"`).join(',')).join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', 'filtered_players.csv');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};