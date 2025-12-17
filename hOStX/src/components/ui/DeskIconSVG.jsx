import React from 'react';

const DeskIconSVG = ({ className }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <title>Desk Icon SVG</title>
    {/* The Delta (Δ) shape */}
    <path d="M12 2 L2 20 H22 Z" />
    {/* The "@" symbol, slightly modified to fit inside the Delta */}
    <path d="M12 18a6 6 0 1 1 0-12 6 6 0 0 1 0 12z" />
    <path d="M12 15v-1a3 3 0 0 0-3-3H8" />
    <path d="M15 9.5a3.5 3.5 0 0 1-3.5 3.5H11" />
  </svg>
);

export default DeskIconSVG;