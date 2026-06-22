import jsPDF from 'jspdf';
import 'jspdf-autotable';

const CAT_LABELS = {
  'singles-men': 'Singles — Men', 'singles-women': 'Singles — Women',
  'doubles-men': 'Doubles — Men', 'doubles-women': 'Doubles — Women', 'mixed-doubles': 'Mixed Doubles',
};

const fmtDate = (d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

// 1. Export Player List (CSV)
export const exportPlayerListCSV = (tournament, registrations) => {
  const headers = ['Player Name', 'Reg No', 'Department', 'Email', 'Phone', 'Partner Name', 'Partner Reg No', 'Status'];
  const rows = registrations.map(r => [
    r.playerName,
    r.rollNumber,
    r.department,
    r.email,
    r.phone,
    r.partnerName || 'N/A',
    r.partnerRollNumber || 'N/A',
    r.status
  ]);

  const csvContent = `${tournament.year} ${CAT_LABELS[tournament.category]} - PLAYER LIST\n`
    + headers.join(",") + "\n" 
    + rows.map(e => e.map(cell => `"${cell}"`).join(",")).join("\n");

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `${tournament.year}_${tournament.category}_players.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

// 2. Export Full Player Master Report (PDF)
export const exportFullPlayerReportPDF = (tournament, registrations) => {
  const doc = new jsPDF({ orientation: 'landscape' });
  
  // Header
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
    i + 1,
    r.playerName,
    r.rollNumber,
    r.nicNo,
    r.department,
    r.phone,
    r.email,
    r.address,
    r.partnerName || '-',
    r.status.toUpperCase()
  ]);

  doc.autoTable({
    startY: 38,
    head: [['#', 'NAME', 'REG NO', 'NIC NO', 'FACULTY', 'PHONE', 'EMAIL', 'ADDRESS', 'PARTNER', 'STATUS']],
    body: tableData,
    theme: 'grid',
    headStyles: { fillColor: [59, 130, 246], fontSize: 8 },
    bodyStyles: { fontSize: 7, cellPadding: 2 },
    columnStyles: {
      0: { cellWidth: 8 },
      1: { cellWidth: 35 },
      2: { cellWidth: 25 },
      3: { cellWidth: 25 },
      4: { cellWidth: 35 },
      5: { cellWidth: 20 },
      6: { cellWidth: 35 },
      7: { cellWidth: 40 },
      8: { cellWidth: 25 },
      9: { cellWidth: 20 },
    },
    styles: { overflow: 'linebreak' },
    margin: { top: 40 },
  });

  doc.save(`${tournament.year}_${tournament.category}_master_report.pdf`);
};

// 3. Export Tournament Result Summary (PDF)
export const exportTournamentResultPDF = (tournament, matches) => {
  const doc = new jsPDF();
  const winner = tournament.winner;

  // Title
  doc.setFontSize(28);
  doc.setTextColor(59, 130, 246);
  doc.text("TOURNAMENT SUMMARY", 14, 25);

  doc.setFontSize(14);
  doc.setTextColor(0);
  doc.text(`${tournament.sport.toUpperCase()} ${tournament.year} | ${CAT_LABELS[tournament.category]}`, 14, 35);

  // Winner Box
  if (winner) {
    doc.setDrawColor(16, 185, 129);
    doc.setLineWidth(1);
    doc.rect(14, 45, 182, 30);
    doc.setFontSize(14);
    doc.setTextColor(16, 185, 129);
    doc.text("🏆 CHAMPION DECLARED", 25, 55);
    doc.setFontSize(20);
    doc.setTextColor(0);
    doc.text(winner.playerName.toUpperCase(), 25, 66);
  }

  // Summary Table of Finals
  const finalMatches = matches.filter(m => m.round === Math.max(...matches.map(x => x.round)));
  
  doc.setFontSize(12);
  doc.setTextColor(100);
  doc.text("MATCH LOG & SCORES", 14, 88);

  const tableData = matches
    .filter(m => m.isCompleted)
    .map(m => [
        `Round ${m.round}`,
        m.player1?.playerName || 'Bye',
        m.player2?.playerName || 'Bye',
        `${m.score1} - ${m.score2}`,
        m.winner?.playerName || 'N/A'
    ]);

  doc.autoTable({
    startY: 92,
    head: [['ROUND', 'PLAYER 1', 'PLAYER 2', 'SCORE', 'WINNER']],
    body: tableData,
    headStyles: { fillColor: [59, 130, 246] },
    tableLineColor: [200, 200, 200],
    tableLineWidth: 0.1,
  });

  // Footer footer
  doc.setFontSize(9);
  doc.setTextColor(150);
  doc.text("Official Records - University of Jaffna Sports Portal", 14, doc.internal.pageSize.height - 10);

  doc.save(`${tournament.year}_${tournament.category}_final_results.pdf`);
};

// 4. Export Individual Player Details Slip
export const exportSinglePlayerPDF = (registration) => {
  const doc = new jsPDF();
  const t = registration.tournament || {};

  // Premium Header
  doc.setFillColor(59, 130, 246);
  doc.rect(0, 0, 210, 40, 'F');
  
  doc.setFontSize(24);
  doc.setTextColor(255, 255, 255);
  doc.text("PLAYER REGISTRATION SLIP", 14, 28);
  
  // Player Main Info
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(10);
  doc.text("TOURNAMENT DETAILS:", 14, 55);
  doc.setFontSize(14);
  doc.text(`${t.sport?.toUpperCase()} ${t.year} - ${CAT_LABELS[t.category] || t.category}`, 14, 62);
  
  // Info Grid
  doc.autoTable({
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
    columnStyles: { 0: { fontStyle: 'bold', fillColor: [245, 245, 245], width: 60 } },
  });

  if (registration.partnerName) {
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text("PARTNER DETAILS (DOUBLES):", 14, doc.lastAutoTable.finalY + 15);
    
    doc.autoTable({
        startY: doc.lastAutoTable.finalY + 20,
        body: [
          ['PARTNER NAME', registration.partnerName],
          ['PARTNER REG NO', registration.partnerRollNumber],
        ],
        theme: 'grid',
        styles: { fontSize: 13, cellPadding: 8 },
        columnStyles: { 0: { fontStyle: 'bold', fillColor: [245, 245, 245], width: 60 } },
      });
  }

  // Footer / Verification
  const finalY = doc.lastAutoTable.finalY + 30;
  doc.setFontSize(10);
  doc.text("____________________________", 14, finalY);
  doc.text("Admin Signature / Seal", 14, finalY + 7);

  doc.text("____________________________", 130, finalY);
  doc.text("Player Signature", 130, finalY + 7);

  doc.setFontSize(9);
  doc.setTextColor(150);
  doc.text(`Doc Ref: REG-${registration._id.substring(18).toUpperCase()} | Printed on ${new Date().toLocaleString()}`, 14, doc.internal.pageSize.height - 10);

  doc.save(`PlayerSlip_${registration.rollNumber.replace(/\//g, '_')}.pdf`);
};

// 5. Export Generic Filtered Player List (PDF)
export const exportFilteredPlayersPDF = (registrations, title) => {
  const doc = new jsPDF({ orientation: 'landscape' });
  
  doc.setFontSize(20);
  doc.setTextColor(59, 130, 246);
  doc.text(title.toUpperCase(), 14, 18);
  
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 25);

  const tableData = registrations.map((r, i) => [
    i + 1,
    r.playerName,
    r.rollNumber,
    r.nicNo,
    r.department,
    r.phone,
    r.email,
    r.address,
    r.tournament?.year || 'N/A',
    r.status.toUpperCase()
  ]);

  doc.autoTable({
    startY: 32,
    head: [['#', 'NAME', 'REG NO', 'NIC NO', 'FACULTY', 'PHONE', 'EMAIL', 'ADDRESS', 'YEAR', 'STATUS']],
    body: tableData,
    theme: 'grid',
    headStyles: { fillColor: [59, 130, 246], fontSize: 8 },
    bodyStyles: { fontSize: 7, cellPadding: 2 },
    columnStyles: {
      0: { cellWidth: 8 },
      1: { cellWidth: 35 },
      2: { cellWidth: 25 },
      3: { cellWidth: 25 },
      4: { cellWidth: 30 },
      5: { cellWidth: 20 },
      6: { cellWidth: 30 },
      7: { cellWidth: 40 },
      8: { cellWidth: 15 },
      9: { cellWidth: 20 },
    },
    styles: { overflow: 'linebreak' },
    margin: { top: 35 },
  });

  doc.save(`filtered_players_report.pdf`);
};

export const exportFilteredPlayersCSV = (registrations, title) => {
    const headers = ['Player Name', 'Reg No', 'NIC', 'Department', 'Phone', 'Email', 'Address', 'Year', 'Status'];
    const rows = registrations.map(r => [
      r.playerName,
      r.rollNumber,
      r.nicNo,
      r.department,
      r.phone,
      r.email,
      r.address,
      r.tournament?.year || 'N/A',
      r.status
    ]);
  
    const csvContent = `${title}\n`
      + headers.join(",") + "\n" 
      + rows.map(e => e.map(cell => `"${cell}"`).join(",")).join("\n");
  
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `filtered_players.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
};
