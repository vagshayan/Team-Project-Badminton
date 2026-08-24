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

// ══════════════════════════════════════════════════════════
// 3. Export Tournament Bracket PDF (visual draw sheet)
// ══════════════════════════════════════════════════════════
//
// Layout pipeline (see final report in chat for full rationale):
//   1. Group + sort matches by round.
//   2. Assign "Match {round}.{positionInRound}" labels globally, before
//      any pagination, so numbering is stable across pages.
//   3. For each match, build the text lines for each side (singles: one
//      person; doubles: player then partner, each on their own line) by
//      wrapping the actual name against the actual measured available
//      width (doc.getTextWidth) at a fixed, non-shrinking font size.
//      Registration number sits immediately before the name on its first
//      line; wrapped continuation lines indent to align under the name.
//   4. Compute each match's card height directly from its own line count
//      — no fixed constant, no shrinking.
//   5. Position every match (including hidden byes, for correct feeder
//      centering) using the same tree algorithm as the admin bracket
//      view, generalized to variable per-match heights: round 1 stacks
//      by real height; later rounds center on their feeders' real
//      centers.
//   6. Paginate horizontally by round-groups (however many columns fit
//      at a fixed, readable width) and vertically by bands cut only
//      between round-1 cards, so a card is never split across pages.
//   7. Render cards and connector lines from that same position data.
//
export const exportTournamentResultPDF = (tournament, matches) => {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const PAGE_W = 297;
  const PAGE_H = 210;
  const MARGIN = 10;
  const PAGE_HEADER_H = 16;   // dark title banner
  const ROUND_LABEL_H = 6;    // round-name row under the banner
  const PAGE_FOOTER_H = 7;
  const CONTENT_TOP = PAGE_HEADER_H + ROUND_LABEL_H;
  const usableW = PAGE_W - 2 * MARGIN;
  const usableH = PAGE_H - CONTENT_TOP - PAGE_FOOTER_H;

  const isDoubles = DOUBLES_CATEGORIES.has(tournament.category);

  // Fixed, non-shrinking layout constants — bracket size is handled via
  // pagination, never by making this text smaller.
  const FONT_SIZE = 8;
  const LINE_H = 3.6;
  const LABEL_H = 3.4;
  const TOP_PAD = 2.2;
  const BOTTOM_PAD = 1.8;
  const DIVIDER_SPACE = 3;
  const CARD_GAP_Y = 4;
  const COL_W = isDoubles ? 80 : 62;
  const COL_GAP = 14;
  const BADGE_W = 6;
  const SIDE_PAD_X = 2;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(FONT_SIZE);

  function isHiddenBye(m) {
    return m.isCompleted === true && (!m.player1 || !m.player2);
  }

  const roundsMap = {};
  matches.forEach(m => {
    if (!roundsMap[m.round]) roundsMap[m.round] = [];
    roundsMap[m.round].push(m);
  });
  const roundNums = Object.keys(roundsMap).map(Number).sort((a, b) => a - b);

  if (roundNums.length === 0) {
    doc.setFontSize(14);
    doc.setTextColor(100);
    doc.text('No matches found for this tournament.', PAGE_W / 2, PAGE_H / 2, { align: 'center' });
    doc.save(`${tournament.year}_${tournament.category}_draw_bracket.pdf`);
    return;
  }

  const visibleByRound = {};
  roundNums.forEach(r => {
    visibleByRound[r] = (roundsMap[r] || [])
      .filter(m => !isHiddenBye(m))
      .sort((a, b) => a.matchNumber - b.matchNumber);
  });

  // ── Text measurement + wrapping — real pixel width, not char counts ──
  function textWidth(t) { return doc.getTextWidth(t); }

  function normalizeName(name) {
    return String(name || '').replace(/\s+/g, ' ').trim();
  }

  // Greedy word-wrap against a real measured width. Falls back to a
  // character-level split only for a single word that alone exceeds the
  // available width (very rare) — every character is preserved, nothing
  // is ever silently dropped.
  function wrapWords(text, maxWidth) {
    const words = text.split(' ').filter(Boolean);
    if (words.length === 0) return [''];
    const lines = [];
    let current = '';
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (textWidth(candidate) <= maxWidth) {
        current = candidate;
        continue;
      }
      if (current) {
        lines.push(current);
        current = '';
      }
      if (textWidth(word) <= maxWidth) {
        current = word;
      } else {
        let piece = '';
        for (const ch of word) {
          const test = piece + ch;
          if (textWidth(test) > maxWidth && piece) {
            lines.push(piece);
            piece = ch;
          } else {
            piece = test;
          }
        }
        current = piece;
      }
    }
    if (current) lines.push(current);
    return lines.length ? lines : [''];
  }

  // Builds the wrapped lines for ONE person: reg no on the first line
  // only, name wrapped and indented under the reg no on every line
  // (including the first, so reg no + name-start always align).
  function buildEntryLines(regNo, name, reserveBadge) {
    const reg = regNo || '';
    const indent = reg ? textWidth(`${reg}  `) : 0;
    const avail = Math.max(COL_W - 2 * SIDE_PAD_X - indent - (reserveBadge ? BADGE_W : 0), 14);
    const nameLines = wrapWords(name, avail);
    return nameLines.map((t, i) => ({ text: t, indent, regNo: i === 0 ? reg : '' }));
  }

  // Builds one side of the match card: singles = one person; doubles =
  // player then partner, each always on their own line(s). The "&" is
  // wrapped as part of the player's own name text so it can never
  // overflow independently of the wrapping logic.
  function buildSide(player, reserveBadge) {
    if (!player) return { lines: [{ text: 'TBD', indent: 0, regNo: '' }] };
    if (!isDoubles || !player.partnerName) {
      const name = player.playerName ? normalizeName(player.playerName) : 'TBD';
      return { lines: buildEntryLines(player.rollNumber, name, reserveBadge) };
    }
    const playerLines = buildEntryLines(player.rollNumber, `${normalizeName(player.playerName)} &`, reserveBadge);
    const partnerLines = buildEntryLines(player.partnerRollNumber, normalizeName(player.partnerName), false);
    return { lines: [...playerLines, ...partnerLines] };
  }

  function computeMatchLayout(m) {
    const side1 = buildSide(m.player1, m.isCompleted);
    const side2 = buildSide(m.player2, m.isCompleted);
    const height = TOP_PAD + LABEL_H
      + side1.lines.length * LINE_H
      + DIVIDER_SPACE
      + side2.lines.length * LINE_H
      + BOTTOM_PAD;
    return { side1, side2, height };
  }

  // ── Match label — position within its own round, computed once
  // globally so numbering stays stable no matter how pages split later ──
  const matchLabelMap = {};
  roundNums.forEach((r, ri) => {
    (visibleByRound[r] || []).forEach((m, i) => {
      matchLabelMap[m._id] = `Match ${ri + 1}.${i + 1}`;
    });
  });

  function getRoundLabel(roundIdx, total) {
    const remaining = total - roundIdx;
    if (remaining === 1) return 'FINAL';
    if (remaining === 2) return 'SEMI FINALS';
    if (remaining === 3) return 'QUARTER FINALS';
    return `ROUND ${roundIdx + 1}`;
  }

  // ── Height for every match, including hidden byes (needed so the next
  // round's centering math is correct even for slots a bye passed through) ──
  const heightMap = {};
  matches.forEach(m => { heightMap[m._id] = computeMatchLayout(m); });

  // ── Pagination ──
  // Horizontal: however many round-columns fit at the fixed column width.
  const maxColsPerPage = Math.max(1, Math.floor((usableW + COL_GAP) / (COL_W + COL_GAP)));
  const roundGroups = [];
  for (let i = 0; i < roundNums.length; i += maxColsPerPage) {
    roundGroups.push(roundNums.slice(i, i + maxColsPerPage));
  }

  // ── Position algorithm — computed FRESH, per round-group. ──
  //
  // This is the key fix. The original approach computed one global tree
  // of positions, feeder-averaging every round all the way back to
  // round 1 — so a later round-group like "Semi Finals + Final" would
  // inherit whatever huge vertical spread round 1 originally had, even
  // though it only has 2-3 cards. That produced pages with a single card
  // stranded alone, enormous near-empty connectors, and (in the worst
  // case) a card whose inherited position landed just before a page's
  // cut point, rendering it clipped above the header.
  //
  // Instead, every round-group starts its own independent, compact
  // coordinate system: its first round is stacked simply top-to-bottom
  // (exactly like round 1 always was — this is what makes it "reset"),
  // and subsequent rounds *within that same group* are still feeder-
  // averaged against those fresh positions, preserving the normal
  // bracket "sits between its two feeders" look within a page. Nothing
  // is ever inherited across a group boundary, so a small later group
  // always gets its own small, tight layout regardless of how tall an
  // earlier group was.
  function computeGroupPositions(group) {
    const pos = {};
    const localFirstRound = group[0];
    const firstAll = (roundsMap[localFirstRound] || []).slice().sort((a, b) => a.matchNumber - b.matchNumber);
    let cursorY = 0;
    firstAll.forEach(m => {
      const h = heightMap[m._id].height;
      pos[m._id] = { top: cursorY, height: h };
      cursorY += h + CARD_GAP_Y;
    });

    for (let gi = 1; gi < group.length; gi++) {
      const r = group[gi];
      const prevAll = roundsMap[group[gi - 1]] || [];
      const feedMap = {};
      prevAll.forEach(pm => {
        if (!pm.nextMatchId) return;
        if (!feedMap[pm.nextMatchId]) feedMap[pm.nextMatchId] = [];
        feedMap[pm.nextMatchId].push(pm);
      });
      const thisAll = (roundsMap[r] || []).slice().sort((a, b) => a.matchNumber - b.matchNumber);
      thisAll.forEach(m => {
        const feeders = feedMap[m._id] || [];
        const h = heightMap[m._id].height;
        const centers = feeders.filter(f => pos[f._id]).map(f => pos[f._id].top + pos[f._id].height / 2);
        const avg = centers.length > 0 ? centers.reduce((a, b) => a + b, 0) / centers.length : 0;
        pos[m._id] = { top: avg - h / 2, height: h };
      });
    }

    return pos;
  }

  // Vertical: computed separately for each round-group, based only on
  // that group's own (now freshly-local) content — so a group's page
  // count reflects only its own actual size, never an inherited one.
  // Cuts fall only between two visible cards in the group's own first
  // round, and only visible cards count toward the page-break budget
  // (hidden byes occupy space for position math but are never drawn and
  // must not eat into it).
  function computeGroupPages(group, groupIdx, pos) {
    const groupMatches = [];
    group.forEach(r => {
      (visibleByRound[r] || []).forEach(m => groupMatches.push(m));
    });
    if (groupMatches.length === 0) return [];

    // Cut points must account for EVERY match in the group, not just the
    // leftmost round — a Round 2/QF card's real height still needs to be
    // budgeted against usableH before a cut point is chosen. Using only
    // round 1 as the basis let a later-round card whose CENTER fell
    // inside a band still have its bottom edge spill past the page's
    // printable area (visually "bleeding" into the next page in a
    // continuous-scroll PDF viewer). Sorting by real position and
    // walking every match closes that gap; cuts still only ever fall
    // cleanly between two matches, so nothing is ever split.
    const cutBasis = groupMatches.slice().sort((a, b) => pos[a._id].top - pos[b._id].top);

    const minTop = Math.min(...groupMatches.map(m => pos[m._id].top));
    const groupBandCuts = [minTop];
    let bandStart = minTop;
    cutBasis.forEach(m => {
      const top = pos[m._id].top;
      const h = heightMap[m._id].height;
      if ((top + h - bandStart) > usableH && top > bandStart) {
        groupBandCuts.push(top);
        bandStart = top;
      }
    });

    const pages = [];
    for (let bandIdx = 0; bandIdx < groupBandCuts.length; bandIdx++) {
      const bandTop = groupBandCuts[bandIdx];
      const bandBottom = bandIdx + 1 < groupBandCuts.length ? groupBandCuts[bandIdx + 1] : Infinity;
      const hasContent = groupMatches.some(m => {
        const c = pos[m._id].top + pos[m._id].height / 2;
        return c >= bandTop && c < bandBottom;
      });
      if (hasContent) pages.push({ groupIdx, group, bandTop, bandBottom, pos });
    }
    return pages;
  }

  const pagesToRender = [];
  roundGroups.forEach((group, groupIdx) => {
    const pos = computeGroupPositions(group);
    pagesToRender.push(...computeGroupPages(group, groupIdx, pos));
  });
  if (pagesToRender.length === 0) {
    const fallbackGroup = roundGroups[0] || roundNums;
    pagesToRender.push({
      groupIdx: 0, group: fallbackGroup, bandTop: 0, bandBottom: Infinity,
      pos: computeGroupPositions(fallbackGroup),
    });
  }

  function drawPageHeader(pageIdx, total) {
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, PAGE_W, PAGE_HEADER_H, 'F');
    doc.setFontSize(11);
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.text(
      `${(tournament.sport || '').toUpperCase()} ${tournament.year} — ${CAT_LABELS[tournament.category] || tournament.category} — DRAW SHEET`,
      MARGIN, 10
    );
    doc.setFontSize(7);
    doc.setTextColor(190, 190, 190);
    doc.text(`Page ${pageIdx + 1} of ${total}`, PAGE_W - MARGIN, 7, { align: 'right' });
    doc.text(`Printed: ${new Date().toLocaleString()}`, PAGE_W - MARGIN, 12, { align: 'right' });
  }

  function drawPageFooter() {
    doc.setFontSize(7);
    doc.setTextColor(150);
    doc.setFont('helvetica', 'normal');
    doc.text(
      'Official Tournament Draw Sheet — University of Jaffna Sports Portal',
      PAGE_W / 2, PAGE_H - 2.5, { align: 'center' }
    );
  }

  function drawCard(m, x, y) {
    const layout = heightMap[m._id];
    const h = layout.height;

    doc.setDrawColor(m.isCompleted ? 16 : 190, m.isCompleted ? 185 : 190, m.isCompleted ? 129 : 200);
    doc.setLineWidth(m.isCompleted ? 0.5 : 0.25);
    doc.setFillColor(m.isCompleted ? 242 : 250, 250, 255);
    doc.roundedRect(x, y, COL_W, h, 0.8, 0.8, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6);
    doc.setTextColor(90, 110, 150);
    doc.text(matchLabelMap[m._id] || '', x + SIDE_PAD_X, y + 2.4);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(FONT_SIZE);
    doc.setTextColor(30, 30, 30);

    let cy = y + TOP_PAD + LABEL_H;
    const side1FirstLineY = cy;
    layout.side1.lines.forEach(line => {
      if (line.regNo) doc.text(line.regNo, x + SIDE_PAD_X, cy);
      doc.text(line.text, x + SIDE_PAD_X + line.indent, cy);
      cy += LINE_H;
    });

    const p1IsWinner = m.isCompleted && m.winner?._id === m.player1?._id;
    if (m.isCompleted && m.player1) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(p1IsWinner ? 16 : 239, p1IsWinner ? 185 : 68, p1IsWinner ? 129 : 68);
      doc.text(p1IsWinner ? 'W' : 'L', x + COL_W - SIDE_PAD_X - 2.5, side1FirstLineY);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(FONT_SIZE);
      doc.setTextColor(30, 30, 30);
    }

    const dividerY = y + TOP_PAD + LABEL_H + layout.side1.lines.length * LINE_H + DIVIDER_SPACE / 2;
    doc.setDrawColor(210, 210, 210);
    doc.setLineWidth(0.15);
    doc.line(x + 1, dividerY, x + COL_W - 1, dividerY);

    cy = y + TOP_PAD + LABEL_H + layout.side1.lines.length * LINE_H + DIVIDER_SPACE;
    const side2FirstLineY = cy;
    layout.side2.lines.forEach(line => {
      if (line.regNo) doc.text(line.regNo, x + SIDE_PAD_X, cy);
      doc.text(line.text, x + SIDE_PAD_X + line.indent, cy);
      cy += LINE_H;
    });

    const p2IsWinner = m.isCompleted && m.winner?._id === m.player2?._id;
    if (m.isCompleted && m.player2) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(p2IsWinner ? 16 : 239, p2IsWinner ? 185 : 68, p2IsWinner ? 129 : 68);
      doc.text(p2IsWinner ? 'W' : 'L', x + COL_W - SIDE_PAD_X - 2.5, side2FirstLineY);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(FONT_SIZE);
      doc.setTextColor(30, 30, 30);
    }
  }

  const totalPages = pagesToRender.length;
  pagesToRender.forEach((page, pageIdx) => {
    if (pageIdx > 0) doc.addPage();
    drawPageHeader(pageIdx, totalPages);

    const pos = page.pos;

    const colX = {};
    page.group.forEach((r, localIdx) => {
      colX[r] = MARGIN + localIdx * (COL_W + COL_GAP);
    });

    page.group.forEach(r => {
      const absoluteIdx = roundNums.indexOf(r);
      doc.setFontSize(6);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(59, 130, 246);
      doc.text(
        getRoundLabel(absoluteIdx, roundNums.length),
        colX[r] + COL_W / 2, PAGE_HEADER_H + 4,
        { align: 'center' }
      );
    });

    // Connector lines — only drawn when both the source and target match
    // fall within this same page's round-group AND vertical band.
    for (let gi = 0; gi < page.group.length - 1; gi++) {
      const r = page.group[gi];
      const nextR = page.group[gi + 1];
      const prevVisible = (visibleByRound[r] || []).filter(m => {
        const c = pos[m._id].top + pos[m._id].height / 2;
        return c >= page.bandTop && c < page.bandBottom;
      });

      const groups = {};
      prevVisible.forEach(m => {
        if (!m.nextMatchId || !pos[m.nextMatchId]) return;
        const targetCenter = pos[m.nextMatchId].top + pos[m.nextMatchId].height / 2;
        if (targetCenter < page.bandTop || targetCenter >= page.bandBottom) return;
        if (!groups[m.nextMatchId]) groups[m.nextMatchId] = [];
        groups[m.nextMatchId].push(m);
      });

      Object.entries(groups).forEach(([targetId, sources]) => {
        const targetPos = pos[targetId];
        if (!targetPos) return;
        const targetX = colX[nextR];
        const targetCY = CONTENT_TOP + Math.max(0, targetPos.top - page.bandTop) + targetPos.height / 2;
        const sourceX = colX[r] + COL_W;
        const stubs = sources.map(s => ({
          x1: sourceX,
          y1: CONTENT_TOP + Math.max(0, pos[s._id].top - page.bandTop) + pos[s._id].height / 2,
        }));
        const midX = (sourceX + targetX) / 2;

        doc.setDrawColor(100, 130, 180);
        doc.setLineWidth(0.3);

        if (stubs.length === 1) {
          const s = stubs[0];
          doc.line(s.x1, s.y1, midX, s.y1);
          doc.line(midX, s.y1, midX, targetCY);
          doc.line(midX, targetCY, targetX, targetCY);
        } else if (stubs.length > 1) {
          stubs.forEach(s => doc.line(s.x1, s.y1, midX, s.y1));
          const ys = stubs.map(s => s.y1);
          doc.line(midX, Math.min(...ys), midX, Math.max(...ys));
          doc.line(midX, targetCY, targetX, targetCY);
        }
      });
    }

    page.group.forEach(r => {
      (visibleByRound[r] || []).forEach(m => {
        const center = pos[m._id].top + pos[m._id].height / 2;
        if (center < page.bandTop || center >= page.bandBottom) return;
        const x = colX[r];
        // Defensive clamp: a card's position should always fall cleanly
        // within its assigned band by construction, but this guarantees
        // it can never render with a negative offset overlapping the
        // page header, even in an edge case.
        const y = CONTENT_TOP + Math.max(0, pos[m._id].top - page.bandTop);
        drawCard(m, x, y);
      });
    });

    drawPageFooter();
  });

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