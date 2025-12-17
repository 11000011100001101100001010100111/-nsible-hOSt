import React from 'react';
import { cn } from '@/lib/utils';

const DeskIcon = ({ className }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={cn('lucide lucide-pyramid', className)}
  >
    <path d="M2.5 16.5A2 2 0 0 0 4.25 20h15.5A2 2 0 0 0 21.5 16.5L12.5 3.16a2 2 0 0 0-3.5 0L2.5 16.5Z"/>
    <path d="M12 22V4"/>
  </svg>
);

export default DeskIcon;