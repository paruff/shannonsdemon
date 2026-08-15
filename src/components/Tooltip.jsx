import { useState, useId } from 'react';

export default function Tooltip({ children, tip }) {
  const [show, setShow] = useState(false);
  const id = useId();
  return (
    <span
      style={{ position: 'relative', display: 'inline-flex' }}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
      onFocus={() => setShow(true)}
      onBlur={() => setShow(false)}
    >
      <span tabIndex={0} aria-describedby={id} style={{ outline: 'none' }}>
        {children}
      </span>
      {show && (
        <div
          id={id}
          role="tooltip"
          style={{
            position: 'absolute',
            bottom: '120%',
            left: '50%',
            transform: 'translateX(-50%)',
            background: '#0d1424',
            border: '1px solid #1e293b',
            borderRadius: 6,
            padding: '8px 12px',
            fontSize: 11,
            color: '#cbd5e1',
            width: 280,
            zIndex: 10,
          }}
        >
          {tip}
        </div>
      )}
    </span>
  );
}
