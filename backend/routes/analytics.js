/**
 * analytics.js
 * ------------
 * API routes for Player Performance Analytics and Smart Suggestions.
 * Supports Badminton, Table Tennis, and Carrom.
 */

'use strict';

const express = require('express');
const router = express.Router();
const analyticsService = require('../services/analyticsService');

/**
 * GET /api/analytics/players
 * Lists registered players for search / autocomplete / picker.
 * Query params:
 *  - sport: 'badminton' | 'table-tennis' | 'carrom' | 'all' (default: 'badminton')
 *  - search: string (optional search term)
 *  - limit: number (default: 30)
 */
router.get('/players', async (req, res) => {
  try {
    const { sport, search, limit } = req.query;
    const max = limit ? parseInt(limit, 10) : 30;
    const players = await analyticsService.listPlayersForSport(sport, search, isNaN(max) ? 30 : max);
    res.json(players);
  } catch (err) {
    console.error('[AnalyticsRoute] Error listing players:', err.message);
    res.status(500).json({ message: err.message || 'Failed to list players' });
  }
});

/**
 * GET /api/analytics/benchmarks/:sport
 * Returns sport-wide performance benchmarks.
 */
router.get('/benchmarks/:sport', async (req, res) => {
  try {
    const { sport } = req.params;
    const benchmarks = await analyticsService.getSportBenchmarks(sport);
    res.json(benchmarks);
  } catch (err) {
    console.error('[AnalyticsRoute] Error fetching benchmarks:', err.message);
    res.status(500).json({ message: err.message || 'Failed to fetch sport benchmarks' });
  }
});

/**
 * GET /api/analytics/player/:registrationNumber
 * GET /api/players/:registrationNumber/performance
 * Returns complete performance analytics for the given player.
 * Query params:
 *  - sport: 'badminton' | 'table-tennis' | 'carrom' (default: 'badminton')
 */
const getPlayerPerformanceHandler = async (req, res) => {
  try {
    const registrationNumber = decodeURIComponent(req.params.registrationNumber || '');
    const sport = req.query.sport || 'badminton';

    if (!registrationNumber || !registrationNumber.trim()) {
      return res.status(400).json({ message: 'Registration number is required' });
    }

    const performance = await analyticsService.calculatePlayerPerformance(
      registrationNumber,
      sport
    );

    if (!performance) {
      return res.status(404).json({
        message: `No player found with registration number "${registrationNumber}" for ${sport}.`,
      });
    }

    res.json(performance);
  } catch (err) {
    console.error('[AnalyticsRoute] Error calculating performance:', err.message);
    res.status(500).json({ message: err.message || 'Failed to calculate player performance' });
  }
};

/**
 * GET /api/analytics/h2h
 * GET /api/analytics/compare
 * Returns head-to-head comparison, direct match history, common opponents, and predictive analysis.
 * Query params:
 *  - playerA: string (registration number for Player A)
 *  - playerB: string (registration number for Player B)
 *  - sport: 'badminton' | 'table-tennis' | 'carrom' (default: 'badminton')
 */
const getHeadToHeadHandler = async (req, res) => {
  try {
    const { playerA, playerB, sport } = req.query;

    if (!playerA || !playerA.trim() || !playerB || !playerB.trim()) {
      return res.status(400).json({
        message: 'Both playerA and playerB registration numbers are required for comparison.',
      });
    }

    const comparison = await analyticsService.compareHeadToHead(
      decodeURIComponent(playerA),
      decodeURIComponent(playerB),
      sport || 'badminton'
    );

    res.json(comparison);
  } catch (err) {
    console.error('[AnalyticsRoute] Error comparing players:', err.message);
    const statusCode = err.message.includes('not found') ? 404 : 400;
    res.status(statusCode).json({ message: err.message || 'Failed to compare players' });
  }
};

router.get('/h2h', getHeadToHeadHandler);
router.get('/compare', getHeadToHeadHandler);

router.get('/player/:registrationNumber', getPlayerPerformanceHandler);
router.get('/:registrationNumber/performance', getPlayerPerformanceHandler);

module.exports = router;

