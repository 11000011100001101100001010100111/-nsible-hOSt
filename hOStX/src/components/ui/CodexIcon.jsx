import React from 'react';
import { cn } from '@/lib/utils';

const CodexIcon = ({ className, size = 24 }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={cn('schematic-battery-icon', className)}
  >
    {/* Positive terminal */}
    <line x1="8" y1="5" x2="8" y2="7" />
    <line x1="6" y1="6" x2="10" y2="6" />

    {/* Battery cells */}
    <line x1="4" y1="10" x2="12" y2="10" />
    <line x1="6" y1="12" x2="10" y2="12" />
    <line x1="4" y1="14" x2="12" y2="14" />
    <line x1="6" y1="16" x2="10" y2="16" />

    {/* Negative terminal */}
    <line x1="4" y1="18" x2="12" y2="18" />
    
    {/* Wires */}
    <path d="M8 7v1" />
    <path d="M8 18v2" />
    
    {/* Data motion representation */}
    <path d="M16 8l3 3-3 3" />
    <path d="M19 11H14" />

  </svg>
);

export default CodexIcon;