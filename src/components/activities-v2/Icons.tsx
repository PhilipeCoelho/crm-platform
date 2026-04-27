// SVG Icons for Activities V2 — Lucide/Feather style
import React from 'react';

const s = { stroke: 'currentColor', strokeWidth: 1.8, fill: 'none', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

export const Icons: Record<string, React.FC<{ size?: number; className?: string; style?: React.CSSProperties }>> = {
  phone:    ({ size = 15, ...p }) => <svg width={size} height={size} viewBox="0 0 24 24" {...s} {...p}><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6A19.79 19.79 0 012.12 4.18 2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>,
  mail:     ({ size = 15, ...p }) => <svg width={size} height={size} viewBox="0 0 24 24" {...s} {...p}><rect x="2" y="4" width="20" height="16" rx="2"/><polyline points="22,7 12,13 2,7"/></svg>,
  whatsapp: ({ size = 15, ...p }) => <svg width={size} height={size} viewBox="0 0 24 24" {...s} {...p}><path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"/></svg>,
  video:    ({ size = 15, ...p }) => <svg width={size} height={size} viewBox="0 0 24 24" {...s} {...p}><rect x="2" y="5" width="14" height="14" rx="2"/><polygon points="23,7 16,12 23,17"/></svg>,
  check:    ({ size = 15, ...p }) => <svg width={size} height={size} viewBox="0 0 24 24" {...s} {...p}><polyline points="20,6 9,17 4,12"/></svg>,
  flame:    ({ size = 15, ...p }) => <svg width={size} height={size} viewBox="0 0 24 24" {...s} {...p}><path d="M8.5 14.5A2.5 2.5 0 0011 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 11-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 002.5 2.5z"/></svg>,
  clock:    ({ size = 15, ...p }) => <svg width={size} height={size} viewBox="0 0 24 24" {...s} {...p}><circle cx="12" cy="12" r="10"/><polyline points="12,6 12,12 16,14"/></svg>,
  target:   ({ size = 15, ...p }) => <svg width={size} height={size} viewBox="0 0 24 24" {...s} {...p}><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>,
  calendar: ({ size = 15, ...p }) => <svg width={size} height={size} viewBox="0 0 24 24" {...s} {...p}><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  plus:     ({ size = 15, ...p }) => <svg width={size} height={size} viewBox="0 0 24 24" {...s} {...p}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  search:   ({ size = 15, ...p }) => <svg width={size} height={size} viewBox="0 0 24 24" {...s} {...p}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
  filter:   ({ size = 15, ...p }) => <svg width={size} height={size} viewBox="0 0 24 24" {...s} {...p}><polygon points="22,3 2,3 10,12.46 10,19 14,21 14,12.46"/></svg>,
  close:    ({ size = 15, ...p }) => <svg width={size} height={size} viewBox="0 0 24 24" {...s} {...p}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  spark:    ({ size = 15, ...p }) => <svg width={size} height={size} viewBox="0 0 24 24" {...s} {...p}><path d="M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8z"/></svg>,
  undo:     ({ size = 15, ...p }) => <svg width={size} height={size} viewBox="0 0 24 24" {...s} {...p}><polyline points="1,4 1,10 7,10"/><path d="M3.51 15a9 9 0 102.13-9.36L1 10"/></svg>,
  user:     ({ size = 15, ...p }) => <svg width={size} height={size} viewBox="0 0 24 24" {...s} {...p}><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  zap:      ({ size = 15, ...p }) => <svg width={size} height={size} viewBox="0 0 24 24" {...s} {...p}><polygon points="13,2 3,14 12,14 11,22 21,10 12,10"/></svg>,
  more:     ({ size = 15, ...p }) => <svg width={size} height={size} viewBox="0 0 24 24" {...s} {...p}><circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/></svg>,
  chevronLeft:  ({ size = 15, ...p }) => <svg width={size} height={size} viewBox="0 0 24 24" {...s} {...p}><polyline points="15,18 9,12 15,6"/></svg>,
  chevronRight: ({ size = 15, ...p }) => <svg width={size} height={size} viewBox="0 0 24 24" {...s} {...p}><polyline points="9,18 15,12 9,6"/></svg>,
  history:  ({ size = 15, ...p }) => <svg width={size} height={size} viewBox="0 0 24 24" {...s} {...p}><path d="M12 8v4l3 3"/><circle cx="12" cy="12" r="10"/></svg>,
};
