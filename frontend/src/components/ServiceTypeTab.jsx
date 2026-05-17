import React from 'react';

export default function ServiceTypeTab({ serviceTypes, activeCode, onChange }) {
  return (
    <div className="service-tabs no-print">
      <button
        className={`service-tab ${activeCode === 'all' ? 'active' : ''}`}
        onClick={() => onChange('all')}
      >全て</button>
      {serviceTypes.map(st => (
        <button
          key={st.code}
          className={`service-tab ${activeCode === st.code ? 'active' : ''}`}
          onClick={() => onChange(st.code)}
        >
          {st.name_ja}
        </button>
      ))}
    </div>
  );
}
