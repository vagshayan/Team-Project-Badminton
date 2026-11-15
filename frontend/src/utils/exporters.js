import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const CAT_LABELS = {
  'singles-men': 'Singles - Men', 'singles-women': 'Singles - Women',
  'doubles-men': 'Doubles - Men', 'doubles-women': 'Doubles - Women', 'mixed-doubles': 'Mixed Doubles',
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
// Layout pipeline:
//   1. Group + sort matches by round.
//   2. Assign stage-aware labels ("QF1", "SF2", "FINAL" instead of a
//      flat "Match 4.1") globally, before any pagination, so a reader
//      can tell what stage a card belongs to from the label alone -
//      not just from which page it happens to land on.
//   3. For each match, build wrapped text lines per side against a
//      real measured width at a fixed, non-shrinking font size.
//   4. Compute each match's card height directly from its own line
//      count - no fixed constant, no shrinking.
//   5. Position every match (including hidden byes, for correct feeder
//      centering) using the same tree algorithm as the admin bracket
//      view, generalized to variable per-match heights.
//   6. Paginate horizontally by round-groups and vertically by bands,
//      so a card is never split across pages.
//   7. Record exactly which page every match lands on (matchRenderInfo)
//      BEFORE drawing anything.
//   8. Render cards. Where a match's next match falls on a *different*
//      page than the match itself, draw a small in-card reference tag
//      instead of a line that can't physically continue - "► p.3" on
//      the feeding match, "◄ p.2" on the match it feeds into - so the
//      draw always reads as one continuous bracket even split across a
//      printed booklet, the same way your reference photo's red arrow
//      pointed from Match 3.2 to Match 4.1.
//   9. Where both ends of a connector land on the SAME page, draw the
//      normal elbow connector line, via doc.setPage() so this can
//      happen in a second pass after every page already exists.
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

  // Fixed, non-shrinking layout constants - bracket size is handled via
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
  // Left accent bar showing the match's stage color, plus a small gap
  // before text starts. All left-side text (label, reg no, name) is
  // inset by this amount instead of plain SIDE_PAD_X.
  const ACCENT_BAR_W = 1.3;
  const CONTENT_INSET = SIDE_PAD_X + ACCENT_BAR_W + 0.3;
  // "Ghost" continuity stub - a compact, dashed, ~half-width preview of
  // a match that actually lives on a later page. Placed in whatever
  // trailing page space is left after the last real column, so a page
  // boundary never just dead-ends into blank space.
  const STUB_GAP_X = 8;
  const MIN_STUB_W = 20;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(FONT_SIZE);

  // Ghost stubs always show one placeholder line per side ("TBD"/"TBD"),
  // so their height is fixed regardless of what the real card will hold.
  const STUB_H = TOP_PAD + LABEL_H + LINE_H + DIVIDER_SPACE + LINE_H + BOTTOM_PAD;

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

  // ── Text measurement + wrapping - real pixel width, not char counts ──
  function textWidth(t) { return doc.getTextWidth(t); }

  function normalizeName(name) {
    return String(name || '').replace(/\s+/g, ' ').trim();
  }

  // Greedy word-wrap against a real measured width. Falls back to a
  // character-level split only for a single word that alone exceeds the
  // available width (very rare) - every character is preserved, nothing
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
    const avail = Math.max(COL_W - CONTENT_INSET - SIDE_PAD_X - indent - (reserveBadge ? BADGE_W : 0), 14);
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

  // ── Stage-aware labels + colors ──
  // "Remaining rounds until the final" drives both - the same rule
  // getRoundLabel already used for ROUND 1 / QUARTER FINALS / etc.
  // QF/SF/FINAL get short, unambiguous codes instead of a running
  // match number, and every stage gets a fixed accent color that's
  // reused for the round header, the card's left accent bar, and the
  // page-continuity legend, so color alone is enough to identify a
  // stage even without reading the label.
  function getRoundAbbrev(roundIdx, total) {
    const remaining = total - roundIdx;
    if (remaining === 1) return 'FINAL';
    if (remaining === 2) return 'SF';
    if (remaining === 3) return 'QF';
    return `R${roundIdx + 1}`;
  }

  function getRoundColor(roundIdx, total) {
    const remaining = total - roundIdx;
    if (remaining === 1) return [181, 136, 18];   // gold - Final
    if (remaining === 2) return [147, 51, 234];   // purple - Semi Final
    if (remaining === 3) return [8, 145, 178];    // teal - Quarter Final
    return [100, 116, 139];                        // slate - earlier rounds
  }

  function getRoundLabel(roundIdx, total) {
    const remaining = total - roundIdx;
    if (remaining === 1) return 'FINAL';
    if (remaining === 2) return 'SEMI FINALS';
    if (remaining === 3) return 'QUARTER FINALS';
    return `ROUND ${roundIdx + 1}`;
  }

  // ── Match label + round index - position within its own round,
  // computed once globally so numbering stays stable no matter how
  // pages split later. roundIdxOf covers every match (including hidden
  // byes) since later lookups (heightMap, markers) need it broadly. ──
  const matchLabelMap = {};
  const roundIdxOf = {};
  roundNums.forEach((r, ri) => {
    const abbrev = getRoundAbbrev(ri, roundNums.length);
    const list = visibleByRound[r] || [];
    list.forEach((m, i) => {
      // Dot-separated so "R1.12" can never be misread as "match 112" -
      // same convention applied to QF/SF ("QF.1", "SF.2") for consistency.
      matchLabelMap[m._id] = abbrev === 'FINAL'
        ? (list.length > 1 ? `FINAL.${i + 1}` : 'FINAL')
        : `${abbrev}.${i + 1}`;
    });
    (roundsMap[r] || []).forEach(m => { roundIdxOf[m._id] = ri; });
  });

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

  // ── Position algorithm - computed FRESH, per round-group. ──
  // Every round-group starts its own independent, compact coordinate
  // system so a small later group (e.g. "Semi Finals + Final") always
  // gets its own tight layout regardless of how tall an earlier group
  // was, instead of inheriting round 1's full vertical spread.
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
  // that group's own content. Cuts fall only between two matches, and
  // only visible cards count toward the page-break budget.
  function computeGroupPages(group, groupIdx, pos) {
    const groupMatches = [];
    group.forEach(r => {
      (visibleByRound[r] || []).forEach(m => groupMatches.push(m));
    });
    if (groupMatches.length === 0) return [];

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
  const totalPages = pagesToRender.length;

  // ── Pre-pass: figure out exactly which page (and where on it) every
  // match will land, WITHOUT drawing anything yet. Everything downstream
  // - cross-page reference tags, same-page connector lines - reads from
  // this map instead of recomputing band/group logic a second time. ──
  const matchRenderInfo = {};
  pagesToRender.forEach((page, pageIdx) => {
    const pos = page.pos;
    const colX = {};
    page.group.forEach((r, localIdx) => { colX[r] = MARGIN + localIdx * (COL_W + COL_GAP); });
    page.group.forEach(r => {
      (visibleByRound[r] || []).forEach(m => {
        const center = pos[m._id].top + pos[m._id].height / 2;
        if (center < page.bandTop || center >= page.bandBottom) return;
        matchRenderInfo[m._id] = {
          pageIdx,
          x: colX[r],
          y: CONTENT_TOP + Math.max(0, pos[m._id].top - page.bandTop),
          height: pos[m._id].height,
        };
      });
    });
  });

  // ── Cross-page tracking ──
  // For every match whose next match lands on a DIFFERENT page, record
  // it on both ends. `outgoingMarker` is consulted per-page to decide
  // whether a ghost stub column can be drawn (preferred); if a page has
  // no room for one, the source card falls back to a small "> p.N" text
  // tag instead. `incomingMarker` always draws a small "< p.N" tag on
  // the real destination card, regardless of whether a stub existed.
  const outgoingMarker = {};
  const incomingMarker = {};
  matches.forEach(m => {
    if (!m.nextMatchId) return;
    const src = matchRenderInfo[m._id];
    const tgt = matchRenderInfo[m.nextMatchId];
    if (!src || !tgt) return;
    if (src.pageIdx === tgt.pageIdx) return;
    outgoingMarker[m._id] = { pageNum: tgt.pageIdx + 1, roundIdx: roundIdxOf[m.nextMatchId] };
    if (!incomingMarker[m.nextMatchId]) incomingMarker[m.nextMatchId] = { pageNums: new Set() };
    incomingMarker[m.nextMatchId].pageNums.add(src.pageIdx + 1);
  });

  // Which page each page's last round is, and what targets it should
  // preview - computed lazily per page inside the render loop below,
  // but the target-id set for the CURRENT page being drawn is tracked
  // here so drawCard (called earlier in the same page's render pass)
  // knows to skip its own fallback text tag for anything a stub will
  // already cover.
  let activeStubTargetIds = new Set();

  // Groups a page's last-round outgoing matches by shared target (two
  // semifinal feeders both point at one final, etc.), then stacks the
  // resulting stub boxes top-to-bottom without overlap, roughly aligned
  // to the vertical position of their real feeder card(s).
  function buildOutgoingStubs(lastRound, pageIdx) {
    const sourceMatches = (visibleByRound[lastRound] || []).filter(m => {
      const info = matchRenderInfo[m._id];
      return info && info.pageIdx === pageIdx && outgoingMarker[m._id];
    });
    if (sourceMatches.length === 0) return [];

    const byTarget = {};
    sourceMatches.forEach(m => {
      if (!byTarget[m.nextMatchId]) byTarget[m.nextMatchId] = [];
      byTarget[m.nextMatchId].push(m);
    });

    const avgY = (arr) => arr.reduce((s, m) => s + matchRenderInfo[m._id].y, 0) / arr.length;
    const targetIds = Object.keys(byTarget).sort((a, b) => avgY(byTarget[a]) - avgY(byTarget[b]));

    let cursorY = CONTENT_TOP;
    return targetIds.map(targetId => {
      const sources = byTarget[targetId];
      const avgCY = sources.reduce((s, m) => s + matchRenderInfo[m._id].y + matchRenderInfo[m._id].height / 2, 0) / sources.length;
      const top = Math.max(cursorY, avgCY - STUB_H / 2);
      cursorY = top + STUB_H + CARD_GAP_Y;
      return { targetId, sources, top };
    });
  }

  function drawStubCard(x, y, w, targetId, pageNum) {
    const rc = getRoundColor(roundIdxOf[targetId], roundNums.length);
    const h = STUB_H;

    doc.setLineDashPattern([1.2, 1], 0);
    doc.setDrawColor(175, 175, 175);
    doc.setLineWidth(0.3);
    doc.setFillColor(248, 248, 250);
    doc.roundedRect(x, y, w, h, 0.8, 0.8, 'FD');
    doc.setLineDashPattern([], 0);

    doc.setFillColor(rc[0], rc[1], rc[2]);
    doc.rect(x, y + 0.6, ACCENT_BAR_W, h - 1.2, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6);
    doc.setTextColor(rc[0], rc[1], rc[2]);
    doc.text(matchLabelMap[targetId] || '', x + CONTENT_INSET, y + 2.4);

    doc.setFont('helvetica', 'italic');
    doc.setFontSize(6);
    doc.setTextColor(150, 150, 150);
    doc.text('TBD', x + CONTENT_INSET, y + TOP_PAD + LABEL_H + LINE_H - 0.5);
    doc.text('TBD', x + CONTENT_INSET, y + TOP_PAD + LABEL_H + LINE_H + DIVIDER_SPACE + LINE_H - 0.5);

    const midY = y + TOP_PAD + LABEL_H + LINE_H + DIVIDER_SPACE / 2;
    doc.setDrawColor(215, 215, 215);
    doc.setLineWidth(0.15);
    doc.line(x + 1, midY, x + w - 1, midY);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5);
    doc.setTextColor(120, 120, 120);
    doc.text(`See Page ${pageNum} ->`, x + w / 2, y + h - 1.2, { align: 'center' });
  }

  function drawPageHeader(pageIdx, total) {
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, PAGE_W, PAGE_HEADER_H, 'F');
    doc.setFontSize(11);
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.text(
      `${(tournament.sport || '').toUpperCase()} ${tournament.year} - ${CAT_LABELS[tournament.category] || tournament.category} - DRAW SHEET`,
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
      'Official Tournament Draw Sheet - University of Jaffna Sports Portal',
      MARGIN, PAGE_H - 2.5
    );

    // Stage color legend - reuses the exact colors shown on round
    // headers and card accent bars, so a reader can match a card's
    // color straight back to "which stage is this."
    const legend = [];
    if (roundNums.length >= 3) legend.push({ label: 'QF', idx: roundNums.length - 3 });
    if (roundNums.length >= 2) legend.push({ label: 'SF', idx: roundNums.length - 2 });
    legend.push({ label: 'FINAL', idx: roundNums.length - 1 });

    let lx = PAGE_W - MARGIN;
    for (let i = legend.length - 1; i >= 0; i--) {
      const item = legend[i];
      const rc = getRoundColor(item.idx, roundNums.length);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6);
      const tw = doc.getTextWidth(item.label);
      doc.setTextColor(90, 90, 90);
      doc.text(item.label, lx - tw, PAGE_H - 2.5);
      lx -= tw + 3.2;
      doc.setFillColor(rc[0], rc[1], rc[2]);
      doc.rect(lx - 2.6, PAGE_H - 4.9, 2.6, 2.6, 'F');
      lx -= 2.6 + 4.5;
    }
  }

  function drawCard(m, x, y) {
    const layout = heightMap[m._id];
    const h = layout.height;
    const rc = getRoundColor(roundIdxOf[m._id], roundNums.length);
    const isFinalStage = roundNums.length - roundIdxOf[m._id] === 1;

    doc.setDrawColor(m.isCompleted ? 16 : 190, m.isCompleted ? 185 : 190, m.isCompleted ? 129 : 200);
    doc.setLineWidth(m.isCompleted ? 0.5 : 0.25);
    doc.setFillColor(m.isCompleted ? 242 : 250, 250, 255);
    doc.roundedRect(x, y, COL_W, h, 0.8, 0.8, 'FD');

    // Stage-color accent bar on the left edge - an immediate visual cue
    // for which round this is, independent of reading any text at all.
    doc.setFillColor(rc[0], rc[1], rc[2]);
    doc.rect(x, y + 0.6, ACCENT_BAR_W, h - 1.2, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(isFinalStage ? 7 : 6);
    doc.setTextColor(rc[0], rc[1], rc[2]);
    const labelText = matchLabelMap[m._id] || '';
    doc.text(labelText, x + CONTENT_INSET, y + 2.4);

    // Incoming reference - this match receives a winner from a page
    // other than its own. Plain ASCII '<' - Unicode arrow glyphs (◄/►)
    // aren't in Helvetica's WinAnsi encoding and render as garbage.
    const inc = incomingMarker[m._id];
    if (inc) {
      const labelW = doc.getTextWidth(labelText);
      const pages = Array.from(inc.pageNums).sort((a, b) => a - b).join(',');
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(5);
      doc.setTextColor(140, 140, 140);
      doc.text(`< p.${pages}`, x + CONTENT_INSET + labelW + 2, y + 2.4);
    }

    // Outgoing reference - only drawn as a text fallback when this
    // page had no room for a ghost stub column (see buildOutgoingStubs).
    // When a stub exists, it already shows this visually, so skip the
    // redundant text tag.
    const out = outgoingMarker[m._id];
    if (out && !activeStubTargetIds.has(m.nextMatchId)) {
      const orc = getRoundColor(out.roundIdx, roundNums.length);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(5);
      doc.setTextColor(orc[0], orc[1], orc[2]);
      doc.text(`> p.${out.pageNum}`, x + COL_W - SIDE_PAD_X, y + 2.4, { align: 'right' });
    }

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(FONT_SIZE);
    doc.setTextColor(30, 30, 30);

    let cy = y + TOP_PAD + LABEL_H;
    const side1FirstLineY = cy;
    layout.side1.lines.forEach(line => {
      if (line.regNo) doc.text(line.regNo, x + CONTENT_INSET, cy);
      doc.text(line.text, x + CONTENT_INSET + line.indent, cy);
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
      if (line.regNo) doc.text(line.regNo, x + CONTENT_INSET, cy);
      doc.text(line.text, x + CONTENT_INSET + line.indent, cy);
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

  // ── Render every page: header, colored round labels, cards. No
  // connector lines yet - those need every page to already exist. ──
  pagesToRender.forEach((page, pageIdx) => {
    if (pageIdx > 0) doc.addPage();
    drawPageHeader(pageIdx, totalPages);

    const colX = {};
    page.group.forEach((r, localIdx) => { colX[r] = MARGIN + localIdx * (COL_W + COL_GAP); });

    page.group.forEach(r => {
      const absoluteIdx = roundNums.indexOf(r);
      const rc = getRoundColor(absoluteIdx, roundNums.length);
      const isFinalStage = roundNums.length - absoluteIdx === 1;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(isFinalStage ? 7.5 : 6);
      doc.setTextColor(rc[0], rc[1], rc[2]);
      doc.text(
        getRoundLabel(absoluteIdx, roundNums.length),
        colX[r] + COL_W / 2, PAGE_HEADER_H + 4,
        { align: 'center' }
      );
    });

    // Decide BEFORE drawing any real cards whether this page's last
    // round will get a ghost stub column, so drawCard (called next) can
    // correctly skip the fallback text tag for anything the stub covers.
    const lastRound = page.group[page.group.length - 1];
    const lastColRightEdge = colX[lastRound] + COL_W;
    const availableForStub = PAGE_W - MARGIN - lastColRightEdge - STUB_GAP_X;
    const stubs = availableForStub >= MIN_STUB_W
      ? buildOutgoingStubs(lastRound, pageIdx)
      : [];
    activeStubTargetIds = new Set(stubs.map(s => s.targetId));

    page.group.forEach(r => {
      (visibleByRound[r] || []).forEach(m => {
        const info = matchRenderInfo[m._id];
        if (!info || info.pageIdx !== pageIdx) return;
        drawCard(m, info.x, info.y);
      });
    });

    // Draw the ghost stub column + its connector lines. Source and stub
    // are on the same page by construction, so this is a normal same-
    // pass draw - no page-jumping needed here.
    if (stubs.length > 0) {
      const stubW = Math.min(availableForStub, COL_W * 0.55);
      const stubX = lastColRightEdge + STUB_GAP_X;

      stubs.forEach(stub => {
        const targetPageNum = matchRenderInfo[stub.targetId]?.pageIdx + 1
          ?? outgoingMarker[stub.sources[0]._id].pageNum;
        const targetCY = stub.top + STUB_H / 2;
        const stubSources = stub.sources.map(sr => ({
          x1: lastColRightEdge,
          y1: matchRenderInfo[sr._id].y + matchRenderInfo[sr._id].height / 2,
        }));
        const midX = (lastColRightEdge + stubX) / 2;

        doc.setDrawColor(100, 130, 180);
        doc.setLineWidth(0.3);
        if (stubSources.length === 1) {
          const s0 = stubSources[0];
          doc.line(s0.x1, s0.y1, midX, s0.y1);
          doc.line(midX, s0.y1, midX, targetCY);
          doc.line(midX, targetCY, stubX, targetCY);
        } else {
          stubSources.forEach(sr => doc.line(sr.x1, sr.y1, midX, sr.y1));
          const ys = stubSources.map(sr => sr.y1);
          doc.line(midX, Math.min(...ys), midX, Math.max(...ys));
          doc.line(midX, targetCY, stubX, targetCY);
        }

        drawStubCard(stubX, stub.top, stubW, stub.targetId, targetPageNum);
      });
    }

    drawPageFooter();
  });

  // ── Second pass: same-page connector lines. Runs after every page
  // already exists, using doc.setPage() to jump back and draw on the
  // correct page regardless of render order. Only pairs where BOTH the
  // feeding match and the match it feeds into share a page get a line -
  // cross-page pairs already have their "► p.N" / "◄ p.N" tags from the
  // render pass above. ──
  const samePageGroups = {};
  matches.forEach(m => {
    if (!m.nextMatchId) return;
    const src = matchRenderInfo[m._id];
    const tgt = matchRenderInfo[m.nextMatchId];
    if (!src || !tgt || src.pageIdx !== tgt.pageIdx) return;
    if (!samePageGroups[m.nextMatchId]) samePageGroups[m.nextMatchId] = [];
    samePageGroups[m.nextMatchId].push(m);
  });

  Object.entries(samePageGroups).forEach(([targetId, sources]) => {
    const tgt = matchRenderInfo[targetId];
    if (!tgt) return;
    doc.setPage(tgt.pageIdx + 1);

    const targetX = tgt.x;
    const targetCY = tgt.y + tgt.height / 2;
    const sourceX = matchRenderInfo[sources[0]._id].x + COL_W;
    const stubs = sources.map(sr => ({
      x1: sourceX,
      y1: matchRenderInfo[sr._id].y + matchRenderInfo[sr._id].height / 2,
    }));
    const midX = (sourceX + targetX) / 2;

    doc.setDrawColor(100, 130, 180);
    doc.setLineWidth(0.3);

    if (stubs.length === 1) {
      const s0 = stubs[0];
      doc.line(s0.x1, s0.y1, midX, s0.y1);
      doc.line(midX, s0.y1, midX, targetCY);
      doc.line(midX, targetCY, targetX, targetCY);
    } else if (stubs.length > 1) {
      stubs.forEach(sr => doc.line(sr.x1, sr.y1, midX, sr.y1));
      const ys = stubs.map(sr => sr.y1);
      doc.line(midX, Math.min(...ys), midX, Math.max(...ys));
      doc.line(midX, targetCY, targetX, targetCY);
    }
  });

  doc.setPage(totalPages);
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