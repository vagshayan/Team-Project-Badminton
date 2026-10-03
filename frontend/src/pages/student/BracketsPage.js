import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { CLOCK_3, ARROW_RIGHT } from '../../components/Icons';
import { HomeButton } from '../../components/HeaderControls';
import { SPORTS } from '../../constants/sports';

export default function BracketsPage() {
  const [tournaments, setTournaments] = useState({});
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    const filterBrackets = (tournaments = []) =>
      tournaments.filter(t => t.isPublished || t.isLocked);

    Promise.all(
      SPORTS.map(s => axios.get(`/api/tournaments/public/${s.id}`)
        .then(r => ({ sport: s.id, data: filterBrackets(r.data) }))
        .catch(() => ({ sport: s.id, data: [] }))
      )
    )
      .then(results => {
        if (!mounted) return;
        const map = {};
        results.forEach(r => map[r.sport] = (r.data || []));
        setTournaments(map);
      })
      .finally(() => setLoading(false));
    return () => { mounted = false; };
  }, []);

  if (loading) return <div style={{ padding: 40 }}>Loading available brackets...</div>;

  const formatDateTime = (value) => {
    if (!value) return 'Date TBD';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Date TBD';
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  return (
    <div className="brackets-page">
      <div className="brackets-header-row">
        <div>
          <h1 className="brackets-title">Live Brackets</h1>
          <p className="brackets-subtitle">Select a sport and view the published brackets.</p>
        </div>
        <HomeButton />
      </div>

      <div className="brackets-grid">
        {SPORTS.map(s => {
          const sportTournaments = tournaments[s.id] || [];
          const publishedCount = sportTournaments.filter(t => t.isPublished).length;
          const pendingCount = sportTournaments.filter(t => !t.isPublished).length;

          return (
            <div key={s.id} className="brackets-sport-card" style={{ '--sport-color': s.color }}>
              <div className="sport-card-topbar">
                <div className="sport-icon-wrap" style={{ background: `${s.color}18`, color: s.color }}>
                  {s.icon}
                </div>
                <div className="sport-header-copy">
                  <span className="sport-label">{s.label}</span>
                  <span className="sport-count">{sportTournaments.length} tournament{sportTournaments.length === 1 ? '' : 's'}</span>
                </div>
              </div>

              <div className="sport-summary-row">
                <span className="summary-pill published-pill">{publishedCount} Published</span>
                <span className="summary-pill pending-pill">{pendingCount} Pending</span>
              </div>

              <div className="sport-card-list">
                {sportTournaments.length === 0 ? (
                  <div className="brackets-empty-box">
                    <div className="empty-icon">{CLOCK_3}</div>
                    <div className="empty-title">No brackets published yet.</div>
                    <div className="empty-copy">Brackets post once matches are complete or when the draw is published.</div>
                  </div>
                ) : (
                  sportTournaments.map(t => {
                    const isPublished = Boolean(t.isPublished);

                    return (
                      <div key={t._id} className="bracket-item-card">
                        <div className="bracket-item-top">
                          <div className="bracket-title">{t.name || `${t.year} ${t.category}`}</div>
                          <span className={`status-badge ${isPublished ? 'status-published' : 'status-pending'}`}>
                            {isPublished ? 'Published' : 'Pending'}
                          </span>
                        </div>

                        <div className="bracket-item-meta">
                          <div><span>Last updated</span><strong>{formatDateTime(t.updatedAt || t.date)}</strong></div>
                        </div>

                        <div className="bracket-item-footer">
                          {isPublished ? (
                            <button
                              className="view-bracket-btn"
                              onClick={() => navigate(`/${s.id}?view=${t._id}`, { state: { fromBrackets: true } })}
                            >
                              View Bracket {ARROW_RIGHT}
                            </button>
                          ) : (
                            <span className="coming-soon-text">Bracket coming soon</span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
