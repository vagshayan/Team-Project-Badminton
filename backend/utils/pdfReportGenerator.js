const PDFDocument = require('pdfkit');

/**
 * Generates a clean, professional PDF report for a player's performance
 * Returns a readable stream containing the PDF document.
 */
function generatePerformancePDF(data, res) {
  const doc = new PDFDocument({
    margin: 40,
    size: 'A4',
    info: {
      Title: `Performance Report - ${data.player?.name || 'Player'} (${data.player?.rollNumber || ''})`,
      Author: 'University of Jaffna - Indoor Games Tournament Management System',
      Subject: 'Player Performance Analysis & Feedback',
    },
  });

  doc.pipe(res);

  const { player = {}, summary = {}, matchHistory = [], feedback = {} } = data;
  const primaryColor = '#1e3a8a'; // Deep Navy
  const secondaryColor = '#0284c7'; // Sky Blue
  const darkText = '#1e293b';
  const mutedText = '#64748b';
  const greenColor = '#16a34a';
  const redColor = '#dc2626';

  // ── Header Banner ──────────────────────────────────────────
  doc.rect(40, 40, 515, 60).fill('#0f172a');
  doc.fillColor('#ffffff').fontSize(18).font('Helvetica-Bold');
  doc.text('UNIVERSITY OF JAFFNA', 55, 52);
  doc.fontSize(11).font('Helvetica').fillColor('#94a3b8');
  doc.text('SPORTS TOURNAMENT MANAGEMENT SYSTEM', 55, 72);
  doc.fontSize(9).fillColor('#38bdf8');
  doc.text(`OFFICIAL PERFORMANCE & ANALYTICS REPORT · ${new Date().toLocaleDateString('en-GB')}`, 55, 87);

  let y = 115;

  // ── Player Details Card ────────────────────────────────────
  doc.rect(40, y, 515, 75).fillAndStroke('#f8fafc', '#e2e8f0');

  doc.fillColor(primaryColor).fontSize(13).font('Helvetica-Bold');
  doc.text((player.name || 'UNKNOWN PLAYER').toUpperCase(), 55, y + 12);

  doc.fillColor(mutedText).fontSize(9).font('Helvetica');
  doc.text('Reg No:', 55, y + 32);
  doc.text('Department:', 55, y + 46);
  doc.text('Sport Domain:', 55, y + 60);

  doc.fillColor(darkText).font('Helvetica-Bold');
  doc.text(player.rollNumber || 'N/A', 130, y + 32);
  doc.text(player.department || 'N/A', 130, y + 46);
  doc.text((player.sport || 'Indoor Games').toUpperCase(), 130, y + 60);

  doc.fillColor(mutedText).font('Helvetica');
  doc.text('NIC No:', 320, y + 32);
  doc.text('Email:', 320, y + 46);
  doc.text('Report Generated:', 320, y + 60);

  doc.fillColor(darkText).font('Helvetica-Bold');
  doc.text(player.nicNo || 'N/A', 380, y + 32);
  doc.text(player.email || 'N/A', 380, y + 46);
  doc.text(new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }), 415, y + 60);

  y += 90;

  // ── Key Performance Metrics (Metric Grid) ──────────────────
  doc.fillColor(primaryColor).fontSize(11).font('Helvetica-Bold');
  doc.text('1. COMPETITIVE PERFORMANCE SUMMARY', 40, y);
  y += 18;

  const cardWidth = 98;
  const cardHeight = 48;
  const cards = [
    { label: 'Total Matches', value: String(summary.totalMatches || 0) },
    { label: 'Wins / Losses', value: `${summary.matchesWon || 0}W - ${summary.matchesLost || 0}L` },
    { label: 'Win Rate', value: `${summary.winPercentage || 0}%`, color: summary.winPercentage >= 50 ? greenColor : redColor },
    { label: 'Current Streak', value: `${summary.currentStreak || 0} W` },
    { label: 'Overall Score', value: `${summary.overallScore || 0} / 100`, color: secondaryColor },
  ];

  cards.forEach((c, idx) => {
    const cx = 40 + idx * (cardWidth + 6);
    doc.rect(cx, y, cardWidth, cardHeight).fillAndStroke('#f1f5f9', '#cbd5e1');
    doc.fillColor(mutedText).fontSize(8).font('Helvetica').text(c.label.toUpperCase(), cx + 6, y + 8, { width: cardWidth - 12 });
    doc.fillColor(c.color || darkText).fontSize(13).font('Helvetica-Bold').text(c.value, cx + 6, y + 24);
  });

  y += cardHeight + 20;

  // ── Sport-Specific Points & Metrics Table ──────────────────
  doc.fillColor(primaryColor).fontSize(11).font('Helvetica-Bold');
  doc.text('2. SPORT-SPECIFIC METRIC BREAKDOWN', 40, y);
  y += 16;

  doc.rect(40, y, 515, 45).fillAndStroke('#f8fafc', '#e2e8f0');
  doc.fillColor(mutedText).fontSize(8).font('Helvetica');

  const sport = (player.sport || 'badminton').toLowerCase();
  if (sport === 'badminton') {
    doc.text('POINTS SCORED', 55, y + 8);
    doc.text('POINTS CONCEDED', 170, y + 8);
    doc.text('SETS WON / LOST', 300, y + 8);
    doc.text('AVG PTS / MATCH', 420, y + 8);

    doc.fillColor(darkText).fontSize(11).font('Helvetica-Bold');
    doc.text(String(summary.pointsScored || 0), 55, y + 22);
    doc.text(String(summary.pointsConceded || 0), 170, y + 22);
    doc.text(`${summary.setsWon || 0}W - ${summary.setsLost || 0}L`, 300, y + 22);
    doc.text(String(summary.averagePointsPerMatch || 0), 420, y + 22);
  } else if (sport === 'table-tennis') {
    doc.text('POINTS SCORED', 55, y + 8);
    doc.text('POINTS CONCEDED', 170, y + 8);
    doc.text('GAMES WON / LOST', 300, y + 8);
    doc.text('AVG PTS / MATCH', 420, y + 8);

    doc.fillColor(darkText).fontSize(11).font('Helvetica-Bold');
    doc.text(String(summary.pointsScored || 0), 55, y + 22);
    doc.text(String(summary.pointsConceded || 0), 170, y + 22);
    doc.text(`${summary.gamesWon || 0}W - ${summary.gamesLost || 0}L`, 300, y + 22);
    doc.text(String(summary.averagePointsPerMatch || 0), 420, y + 22);
  } else {
    // Carrom
    doc.text('BOARDS WON / LOST', 55, y + 8);
    doc.text('COINS POCKETED', 180, y + 8);
    doc.text('RECORDED FOULS', 310, y + 8);
    doc.text('MAX WIN STREAK', 420, y + 8);

    doc.fillColor(darkText).fontSize(11).font('Helvetica-Bold');
    doc.text(`${summary.boardsWon || 0}W - ${summary.boardsLost || 0}L`, 55, y + 22);
    doc.text(String(summary.coinsPocketed || 0), 180, y + 22);
    doc.text(String(summary.fouls || 0), 310, y + 22);
    doc.text(`${summary.maxStreak || 0} matches`, 420, y + 22);
  }

  y += 60;

  // ── Match History Table ────────────────────────────────────
  doc.fillColor(primaryColor).fontSize(11).font('Helvetica-Bold');
  doc.text('3. RECENT MATCH-BY-MATCH HISTORY', 40, y);
  y += 16;

  // Table header
  doc.rect(40, y, 515, 20).fill('#1e293b');
  doc.fillColor('#ffffff').fontSize(8).font('Helvetica-Bold');
  doc.text('DATE', 48, y + 6);
  doc.text('TOURNAMENT', 115, y + 6);
  doc.text('ROUND', 255, y + 6);
  doc.text('OPPONENT', 315, y + 6);
  doc.text('OUTCOME', 440, y + 6);
  doc.text('SCORE', 495, y + 6);
  y += 20;

  const matchesToShow = matchHistory.slice(0, 7);
  if (matchesToShow.length === 0) {
    doc.rect(40, y, 515, 24).fillAndStroke('#ffffff', '#e2e8f0');
    doc.fillColor(mutedText).fontSize(8).font('Helvetica').text('No completed tournament matches recorded yet.', 50, y + 8);
    y += 28;
  } else {
    matchesToShow.forEach((m, idx) => {
      const bg = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
      doc.rect(40, y, 515, 20).fillAndStroke(bg, '#e2e8f0');

      const dStr = m.date ? new Date(m.date).toLocaleDateString('en-GB') : 'N/A';
      const tName = (m.tournamentName || m.category || 'Tournament').substring(0, 24);
      const rStr = `Round ${m.round || 1}`;
      const oppStr = (m.opponentName || 'Opponent').substring(0, 20);
      const outcome = m.outcome || (m.isWinner ? 'WIN' : 'LOSS');
      const scoreStr = m.pointsScored > 0 || m.pointsConceded > 0
        ? `${m.pointsScored} - ${m.pointsConceded}`
        : `${m.setsWon || m.gamesWon || m.boardsWon || 0}-${m.setsLost || m.gamesLost || m.boardsLost || 0}`;

      doc.fillColor(darkText).fontSize(7.5).font('Helvetica');
      doc.text(dStr, 48, y + 6);
      doc.text(tName, 115, y + 6);
      doc.text(rStr, 255, y + 6);
      doc.text(oppStr, 315, y + 6);

      doc.font('Helvetica-Bold').fillColor(outcome === 'WIN' ? greenColor : redColor);
      doc.text(outcome, 440, y + 6);

      doc.fillColor(darkText).font('Helvetica');
      doc.text(scoreStr, 495, y + 6);

      y += 20;
    });
  }

  y += 15;

  // Check if we need to add a page or if space allows
  if (y > 660) {
    doc.addPage();
    y = 45;
  }

  // ── Intelligent Feedback System ────────────────────────────
  doc.fillColor(primaryColor).fontSize(11).font('Helvetica-Bold');
  doc.text('4. INTELLIGENT PERFORMANCE ANALYSIS & COACHING FEEDBACK', 40, y);
  y += 16;

  // Strengths Box
  doc.rect(40, y, 515, 45).fillAndStroke('#f0fdf4', '#bbf7d0');
  doc.fillColor(greenColor).fontSize(9).font('Helvetica-Bold').text('IDENTIFIED STRENGTHS', 52, y + 8);
  doc.fillColor(darkText).fontSize(8).font('Helvetica');
  const sList = feedback.strengths && feedback.strengths.length > 0
    ? feedback.strengths.slice(0, 2).map((s) => `• ${s.title}: ${s.desc}`).join('  ')
    : '• Competitive participation recorded across official tournaments.';
  doc.text(sList, 52, y + 22, { width: 490 });
  y += 52;

  // Weaknesses Box
  doc.rect(40, y, 515, 45).fillAndStroke('#fef2f2', '#fecaca');
  doc.fillColor(redColor).fontSize(9).font('Helvetica-Bold').text('AREAS FOR IMPROVEMENT', 52, y + 8);
  doc.fillColor(darkText).fontSize(8).font('Helvetica');
  const wList = feedback.weaknesses && feedback.weaknesses.length > 0
    ? feedback.weaknesses.slice(0, 2).map((w) => `• ${w.title}: ${w.desc}`).join('  ')
    : '• Maintain baseline consistency during match play.';
  doc.text(wList, 52, y + 22, { width: 490 });
  y += 52;

  // Suggestions Box
  doc.rect(40, y, 515, 45).fillAndStroke('#f0f9ff', '#bae6fd');
  doc.fillColor(secondaryColor).fontSize(9).font('Helvetica-Bold').text('PRACTICAL ACTION SUGGESTIONS', 52, y + 8);
  doc.fillColor(darkText).fontSize(8).font('Helvetica');
  const sugList = feedback.suggestions && feedback.suggestions.length > 0
    ? feedback.suggestions.slice(0, 2).map((s) => `• ${s.title}: ${s.desc}`).join('  ')
    : '• Review opponent tactical trends and prepare match strategy.';
  doc.text(sugList, 52, y + 22, { width: 490 });
  y += 56;

  // Footer
  doc.fontSize(7.5).fillColor(mutedText).font('Helvetica');
  doc.text(
    'University of Jaffna Sports Tournament Manager · Authorized Automated Report · Re-use and distribution restricted to tournament officials.',
    40,
    780,
    { align: 'center', width: 515 }
  );

  doc.end();
}

module.exports = { generatePerformancePDF };

