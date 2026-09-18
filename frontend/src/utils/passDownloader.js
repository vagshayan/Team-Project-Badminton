import jsPDF from 'jspdf';

/**
 * Converts an SVG element to a high-resolution PNG data URL and triggers browser download.
 *
 * @param {SVGElement|string} svgSource - DOM SVG element or CSS selector
 * @param {string} filename - output file name (e.g., '2023_CSE_001_QR_Code.png')
 */
export async function downloadQRCodePNG(svgSource, filename = 'Player_QR_Code.png') {
  try {
    const svgEl = typeof svgSource === 'string'
      ? document.querySelector(svgSource)
      : svgSource;

    if (!svgEl) {
      throw new Error('QR Code SVG element not found.');
    }

    const svgXml = new XMLSerializer().serializeToString(svgEl);
    const svgBase64 = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgXml)));

    const img = new Image();
    img.crossOrigin = 'anonymous';

    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = svgBase64;
    });

    const canvas = document.createElement('canvas');
    const scale = 3; // 3x for crisp retina output
    const size = (svgEl.clientWidth || 200) * scale;
    canvas.width = size;
    canvas.height = size;

    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, size, size);
    ctx.drawImage(img, 0, 0, size, size);

    const pngUrl = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.href = pngUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    return true;
  } catch (err) {
    console.error('Error downloading QR code:', err);
    alert('Failed to download QR code image: ' + err.message);
    return false;
  }
}

/**
 * Generates and downloads an official Digital Player Pass PDF.
 *
 * @param {object} passData - Pass details from /api/player-qr/:token
 * @param {object} [matchData] - Match details (nextMatch, upcomingMatches)
 */
export async function downloadPlayerPassPDF(passData, matchData = {}) {
  try {
    if (!passData || !passData.player) {
      throw new Error('Player pass data is missing.');
    }

    const { player, tournament, registration, sportLabel, sportColor, courtUnit } = passData;
    const nextMatch = matchData?.nextMatch;

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a5', // A5 is standard pass/badge size (148 x 210 mm)
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 12;
    const contentWidth = pageWidth - (margin * 2);

    // 1. Header Banner
    doc.setFillColor(19, 27, 46); // Deep Navy #131B2E
    doc.roundedRect(margin, 12, contentWidth, 26, 3, 3, 'F');

    doc.setTextColor(251, 191, 36); // Amber Gold
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('UNIVERSITY OF JAFFNA', margin + 6, 19);

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.text(`INDOOR GAMES ${tournament.year || new Date().getFullYear()} — ${sportLabel.toUpperCase()}`, margin + 6, 27);

    doc.setFontSize(9);
    doc.setTextColor(203, 213, 225);
    doc.text(`Category: ${tournament.categoryLabel || tournament.category}`, margin + 6, 34);

    // 2. Status Banner
    const isApproved = registration.status === 'confirmed';
    const isPending = registration.status === 'pending';

    if (isApproved) {
      doc.setFillColor(16, 185, 129); // Green
    } else if (isPending) {
      doc.setFillColor(245, 158, 11); // Amber
    } else {
      doc.setFillColor(239, 68, 68); // Red
    }

    doc.roundedRect(margin, 42, contentWidth, 10, 2, 2, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    const statusText = isApproved ? 'REGISTRATION APPROVED — OFFICIAL PARTICIPANT' : isPending ? 'REGISTRATION PENDING REVIEW' : 'REGISTRATION ' + registration.status.toUpperCase();
    doc.text(statusText, pageWidth / 2, 48.5, { align: 'center' });

    // 3. Player Credentials Box
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(margin, 56, contentWidth, 48, 3, 3, 'FD');

    doc.setTextColor(15, 23, 42);
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text(player.name || 'Player Name', margin + 6, 65);

    doc.setTextColor(37, 99, 235); // Blue
    doc.setFontSize(10);
    doc.text(`REG NO: ${player.rollNumber}`, margin + 6, 72);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.setFontSize(9);
    doc.text(`Faculty/Dept: ${player.department || 'General'}`, margin + 6, 80);
    doc.text(`Academic Year: ${player.year || 'N/A'}`, margin + 6, 86);

    if (player.partnerName) {
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(2, 132, 199);
      doc.text(`Doubles Partner: ${player.partnerName} (${player.partnerRollNumber || ''})`, margin + 6, 92);
      doc.setFont('helvetica', 'normal');
    }

    doc.setTextColor(100, 116, 139);
    doc.text(`Venue: ${tournament.venue || 'Indoor Sports Complex'}`, margin + 6, 98);

    // 4. Render QR Code
    const qrSvg = document.querySelector('.qr-box svg') || document.querySelector('.modal-card svg');
    if (qrSvg) {
      try {
        const svgXml = new XMLSerializer().serializeToString(qrSvg);
        const svgBase64 = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgXml)));
        const img = new Image();
        img.crossOrigin = 'anonymous';

        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
          img.src = svgBase64;
        });

        const qrCanvas = document.createElement('canvas');
        qrCanvas.width = 300;
        qrCanvas.height = 300;
        const qCtx = qrCanvas.getContext('2d');
        qCtx.fillStyle = '#FFFFFF';
        qCtx.fillRect(0, 0, 300, 300);
        qCtx.drawImage(img, 0, 0, 300, 300);
        const qrPng = qrCanvas.toDataURL('image/png');

        // Draw QR Code on right side of player info
        doc.addImage(qrPng, 'PNG', pageWidth - margin - 42, 58, 36, 36);
        doc.setFontSize(7);
        doc.setTextColor(100, 116, 139);
        doc.text('Scan to Verify', pageWidth - margin - 24, 96, { align: 'center' });
      } catch (qrErr) {
        console.warn('Could not embed QR code into PDF:', qrErr);
      }
    }

    // 5. Next Match Section (if available)
    let yPos = 108;
    if (nextMatch) {
      doc.setFillColor(241, 245, 249);
      doc.setDrawColor(203, 213, 225);
      doc.roundedRect(margin, yPos, contentWidth, 34, 3, 3, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(15, 23, 42);
      doc.text(`NEXT MATCH: ${nextMatch.roundLabel || 'Round 1'} (Match #${nextMatch.matchNumber || 1})`, margin + 6, yPos + 7);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(51, 65, 85);
      doc.text(`Opponent: ${nextMatch.opponent?.name || 'TBD'} ${nextMatch.opponent?.rollNumber ? `(${nextMatch.opponent.rollNumber})` : ''}`, margin + 6, yPos + 14);
      doc.text(`Location: ${nextMatch.venue || tournament.venue} — ${nextMatch.court || `${courtUnit} ${nextMatch.matchNumber}`}`, margin + 6, yPos + 21);
      doc.text(`Scheduled Time: ${nextMatch.time || 'TBD'}`, margin + 6, yPos + 28);

      yPos += 38;
    }

    // 6. Security Notice & Instructions
    doc.setFillColor(254, 243, 199); // Amber background #FEF3C7
    doc.setDrawColor(251, 191, 36);
    doc.roundedRect(margin, yPos, contentWidth, 24, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(146, 64, 14); // Dark Amber
    doc.text('OFFICIAL TOURNAMENT CREDENTIAL INSTRUCTIONS', margin + 6, yPos + 6);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(180, 83, 9);
    doc.text('1. Present this digital pass (on phone or printed) at the venue desk prior to matches.', margin + 6, yPos + 12);
    doc.text('2. Match schedules and court assignments update dynamically in real time.', margin + 6, yPos + 17);
    doc.text('3. This pass is non-transferable and verified cryptographically.', margin + 6, yPos + 22);

    // 7. Footer
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text(`Token: ${passData.qrToken || 'N/A'}`, margin, 202);
    doc.text(`Generated on ${new Date().toLocaleString()} · University Indoor Games`, pageWidth - margin, 202, { align: 'right' });

    const safeFilename = (player.rollNumber || 'Player').replace(/[\/\\]/g, '_') + '_Digital_Pass.pdf';
    doc.save(safeFilename);
    return true;
  } catch (err) {
    console.error('Error generating Pass PDF:', err);
    alert('Failed to generate Player Pass PDF: ' + err.message);
    return false;
  }
}
