import React from 'react';

interface VamusLogoProps {
  size?: number;
  className?: string;
  color?: string; // Se fornecido, substitui o gradiente padrão
}

export const VamusLogo: React.FC<VamusLogoProps> = ({ size = 24, className = '', color }) => {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width={size} 
      height={size} 
      viewBox="0 0 512 512" 
      className={className}
      fill="none"
    >
      <path 
        d="M 140 160 L 372 160 L 256 360 Z" 
        stroke={color || "url(#vamus-blue-grad)"} 
        strokeWidth="64" 
        strokeLinejoin="round" 
        strokeLinecap="round"
      />
      {!color && (
        <defs>
          <linearGradient id="vamus-blue-grad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#5a89fc" />
            <stop offset="100%" stopColor="#2563eb" />
          </linearGradient>
        </defs>
      )}
    </svg>
  );
};
