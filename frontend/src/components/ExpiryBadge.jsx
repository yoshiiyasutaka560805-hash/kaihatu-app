import React from 'react';

export default function ExpiryBadge({ date, level }) {
  if (!date) {
    return <span className="badge gray">在留期限未登録</span>;
  }

  const daysLeft = Math.ceil((new Date(date) - new Date(new Date().toDateString())) / (1000 * 60 * 60 * 24));
  const label = daysLeft < 0
    ? `期限切れ（${date}）`
    : `残り${daysLeft}日（${date}）`;

  return (
    <span className={`badge ${level || 'green'}`} style={{ fontWeight: 600 }}>
      {label}
    </span>
  );
}
