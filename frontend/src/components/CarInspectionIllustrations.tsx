/**
 * Car Inspection Position Illustrations
 * SVG illustrations showing a car from different angles for the guided inspection
 */
import React from 'react';
import Svg, { Path, Circle, Rect, Ellipse, G, Line } from 'react-native-svg';

interface CarIllustrationProps {
  width?: number;
  height?: number;
  color?: string;
  highlightColor?: string;
}

// ── FRONT VIEW ──
export const CarFrontView = ({ width = 120, height = 90, color = '#1E3A5F', highlightColor = '#3B82F6' }: CarIllustrationProps) => (
  <Svg width={width} height={height} viewBox="0 0 120 90">
    {/* Body */}
    <Path d="M20 55 L25 35 L35 20 L85 20 L95 35 L100 55 L100 70 L20 70 Z" fill={color} opacity={0.9} />
    {/* Roof */}
    <Path d="M35 20 L40 8 L80 8 L85 20 Z" fill={color} opacity={0.7} />
    {/* Windshield */}
    <Path d="M38 18 L42 10 L78 10 L82 18 Z" fill="#B3D4FC" opacity={0.8} />
    {/* Headlights */}
    <Rect x={22} y={40} width={12} height={8} rx={3} fill={highlightColor} opacity={0.9} />
    <Rect x={86} y={40} width={12} height={8} rx={3} fill={highlightColor} opacity={0.9} />
    {/* Grille */}
    <Rect x={40} y={45} width={40} height={12} rx={4} fill="#111" opacity={0.5} />
    {/* Bumper */}
    <Rect x={25} y={60} width={70} height={8} rx={3} fill={color} opacity={0.6} />
    {/* Wheels */}
    <Circle cx={32} cy={72} r={10} fill="#333" />
    <Circle cx={32} cy={72} r={6} fill="#666" />
    <Circle cx={88} cy={72} r={10} fill="#333" />
    <Circle cx={88} cy={72} r={6} fill="#666" />
    {/* Arrow indicator */}
    <Path d="M60 82 L55 88 L65 88 Z" fill={highlightColor} />
  </Svg>
);

// ── REAR VIEW ──
export const CarRearView = ({ width = 120, height = 90, color = '#1E3A5F', highlightColor = '#EF4444' }: CarIllustrationProps) => (
  <Svg width={width} height={height} viewBox="0 0 120 90">
    {/* Body */}
    <Path d="M20 55 L25 35 L35 20 L85 20 L95 35 L100 55 L100 70 L20 70 Z" fill={color} opacity={0.9} />
    {/* Roof */}
    <Path d="M35 20 L40 8 L80 8 L85 20 Z" fill={color} opacity={0.7} />
    {/* Rear window */}
    <Path d="M38 18 L42 10 L78 10 L82 18 Z" fill="#B3D4FC" opacity={0.6} />
    {/* Tail lights */}
    <Rect x={22} y={40} width={14} height={8} rx={3} fill={highlightColor} opacity={0.9} />
    <Rect x={84} y={40} width={14} height={8} rx={3} fill={highlightColor} opacity={0.9} />
    {/* Trunk */}
    <Rect x={35} y={30} width={50} height={20} rx={4} fill={color} opacity={0.7} />
    {/* License plate */}
    <Rect x={42} y={50} width={36} height={12} rx={2} fill="#FFF" opacity={0.8} />
    <Rect x={48} y={53} width={24} height={6} rx={1} fill="#333" opacity={0.3} />
    {/* Bumper */}
    <Rect x={25} y={60} width={70} height={8} rx={3} fill={color} opacity={0.6} />
    {/* Wheels */}
    <Circle cx={32} cy={72} r={10} fill="#333" />
    <Circle cx={32} cy={72} r={6} fill="#666" />
    <Circle cx={88} cy={72} r={10} fill="#333" />
    <Circle cx={88} cy={72} r={6} fill="#666" />
    {/* Arrow indicator */}
    <Path d="M60 82 L55 88 L65 88 Z" fill={highlightColor} />
  </Svg>
);

// ── LEFT SIDE VIEW ──
export const CarLeftSideView = ({ width = 140, height = 80, color = '#1E3A5F', highlightColor = '#3B82F6' }: CarIllustrationProps) => (
  <Svg width={width} height={height} viewBox="0 0 140 80">
    {/* Body */}
    <Path d="M15 50 L20 40 L30 25 L55 15 L90 15 L110 25 L120 40 L125 50 L125 55 L15 55 Z" fill={color} opacity={0.9} />
    {/* Windows */}
    <Path d="M35 24 L55 17 L65 17 L65 35 L35 35 Z" fill="#B3D4FC" opacity={0.7} />
    <Path d="M68 17 L88 17 L95 24 L95 35 L68 35 Z" fill="#B3D4FC" opacity={0.7} />
    {/* Door line */}
    <Line x1={66} y1={17} x2={66} y2={50} stroke="#0F172A" strokeWidth={1} opacity={0.4} />
    {/* Door handle */}
    <Rect x={75} y={38} width={10} height={3} rx={1.5} fill="#FFF" opacity={0.5} />
    {/* Wheels */}
    <Circle cx={35} cy={58} r={12} fill="#333" />
    <Circle cx={35} cy={58} r={8} fill="#555" />
    <Circle cx={35} cy={58} r={4} fill="#888" />
    <Circle cx={105} cy={58} r={12} fill="#333" />
    <Circle cx={105} cy={58} r={8} fill="#555" />
    <Circle cx={105} cy={58} r={4} fill="#888" />
    {/* Highlight arrow on left side */}
    <Path d="M5 40 L0 35 L0 45 Z" fill={highlightColor} />
    <Line x1={0} y1={40} x2={12} y2={40} stroke={highlightColor} strokeWidth={2} />
  </Svg>
);

// ── RIGHT SIDE VIEW (mirrored) ──
export const CarRightSideView = ({ width = 140, height = 80, color = '#1E3A5F', highlightColor = '#3B82F6' }: CarIllustrationProps) => (
  <Svg width={width} height={height} viewBox="0 0 140 80">
    {/* Body - mirrored */}
    <Path d="M15 50 L20 40 L30 25 L50 15 L85 15 L110 15 L120 25 L125 50 L125 55 L15 55 Z" fill={color} opacity={0.9} />
    {/* Windows - mirrored */}
    <Path d="M45 24 L75 17 L75 35 L45 35 L35 24 Z" fill="#B3D4FC" opacity={0.7} />
    <Path d="M78 17 L95 17 L105 24 L105 35 L78 35 Z" fill="#B3D4FC" opacity={0.7} />
    {/* Door line */}
    <Line x1={76} y1={17} x2={76} y2={50} stroke="#0F172A" strokeWidth={1} opacity={0.4} />
    {/* Door handle */}
    <Rect x={55} y={38} width={10} height={3} rx={1.5} fill="#FFF" opacity={0.5} />
    {/* Wheels */}
    <Circle cx={35} cy={58} r={12} fill="#333" />
    <Circle cx={35} cy={58} r={8} fill="#555" />
    <Circle cx={35} cy={58} r={4} fill="#888" />
    <Circle cx={105} cy={58} r={12} fill="#333" />
    <Circle cx={105} cy={58} r={8} fill="#555" />
    <Circle cx={105} cy={58} r={4} fill="#888" />
    {/* Highlight arrow on right side */}
    <Path d="M135 40 L140 35 L140 45 Z" fill={highlightColor} />
    <Line x1={128} y1={40} x2={140} y2={40} stroke={highlightColor} strokeWidth={2} />
  </Svg>
);

// ── TOP/ROOF VIEW ──
export const CarTopView = ({ width = 100, height = 120, color = '#1E3A5F', highlightColor = '#3B82F6' }: CarIllustrationProps) => (
  <Svg width={width} height={height} viewBox="0 0 100 120">
    {/* Car body outline - top down */}
    <Path d="M30 15 L35 5 L65 5 L70 15 L75 30 L75 90 L70 105 L65 115 L35 115 L30 105 L25 90 L25 30 Z" fill={color} opacity={0.85} />
    {/* Windshield */}
    <Path d="M35 20 L38 12 L62 12 L65 20 L65 35 L35 35 Z" fill="#B3D4FC" opacity={0.6} />
    {/* Roof */}
    <Rect x={35} y={38} width={30} height={30} rx={3} fill={color} opacity={0.5} />
    {/* Rear window */}
    <Path d="M35 72 L65 72 L65 85 L62 90 L38 90 L35 85 Z" fill="#B3D4FC" opacity={0.5} />
    {/* Wheels */}
    <Ellipse cx={26} cy={30} rx={4} ry={8} fill="#333" />
    <Ellipse cx={74} cy={30} rx={4} ry={8} fill="#333" />
    <Ellipse cx={26} cy={90} rx={4} ry={8} fill="#333" />
    <Ellipse cx={74} cy={90} rx={4} ry={8} fill="#333" />
    {/* Sunroof indicator */}
    <Circle cx={50} cy={50} r={8} fill={highlightColor} opacity={0.3} />
    <Path d="M50 44 L47 48 L53 48 Z" fill={highlightColor} />
  </Svg>
);

// ── INTERIOR/DASHBOARD VIEW ──
export const CarInteriorView = ({ width = 120, height = 90, color = '#1E3A5F', highlightColor = '#3B82F6' }: CarIllustrationProps) => (
  <Svg width={width} height={height} viewBox="0 0 120 90">
    {/* Dashboard */}
    <Path d="M10 60 L10 30 L110 30 L110 60 L100 65 L20 65 Z" fill="#2C2C2C" opacity={0.9} />
    {/* Windshield frame */}
    <Path d="M5 28 L15 5 L105 5 L115 28 Z" fill={color} opacity={0.8} />
    {/* Windshield glass */}
    <Path d="M15 25 L22 8 L98 8 L105 25 Z" fill="#B3D4FC" opacity={0.4} />
    {/* Steering wheel */}
    <Circle cx={35} cy={55} r={15} fill="none" stroke="#444" strokeWidth={3} />
    <Circle cx={35} cy={55} r={5} fill="#555" />
    {/* Speedometer */}
    <Circle cx={60} cy={42} r={10} fill="#111" />
    <Circle cx={60} cy={42} r={8} fill="#222" />
    <Path d="M60 42 L60 35" stroke={highlightColor} strokeWidth={1.5} />
    {/* Screen/Display */}
    <Rect x={75} y={36} width={25} height={16} rx={2} fill="#111" />
    <Rect x={77} y={38} width={21} height={12} rx={1} fill={highlightColor} opacity={0.3} />
    {/* Gear shift */}
    <Rect x={55} y={62} width={10} height={18} rx={3} fill="#333" />
    <Circle cx={60} cy={67} r={4} fill="#555" />
    {/* Seats */}
    <Path d="M15 70 L15 85 L50 85 L50 70 Z" fill="#3D3D3D" opacity={0.5} rx={3} />
    <Path d="M70 70 L70 85 L105 85 L105 70 Z" fill="#3D3D3D" opacity={0.5} rx={3} />
  </Svg>
);

// ── TIRE/WHEEL VIEW ──
export const CarTireView = ({ width = 100, height = 100, color = '#1E3A5F', highlightColor = '#3B82F6' }: CarIllustrationProps) => (
  <Svg width={width} height={height} viewBox="0 0 100 100">
    {/* Outer tire */}
    <Circle cx={50} cy={50} r={40} fill="#222" />
    {/* Tire tread */}
    <Circle cx={50} cy={50} r={38} fill="none" stroke="#444" strokeWidth={3} strokeDasharray="8 4" />
    {/* Rim */}
    <Circle cx={50} cy={50} r={25} fill="#666" />
    <Circle cx={50} cy={50} r={22} fill="#888" />
    {/* Spokes */}
    <Line x1={50} y1={30} x2={50} y2={40} stroke="#AAA" strokeWidth={3} />
    <Line x1={50} y1={60} x2={50} y2={70} stroke="#AAA" strokeWidth={3} />
    <Line x1={30} y1={50} x2={40} y2={50} stroke="#AAA" strokeWidth={3} />
    <Line x1={60} y1={50} x2={70} y2={50} stroke="#AAA" strokeWidth={3} />
    <Line x1={36} y1={36} x2={43} y2={43} stroke="#AAA" strokeWidth={3} />
    <Line x1={57} y1={57} x2={64} y2={64} stroke="#AAA" strokeWidth={3} />
    <Line x1={64} y1={36} x2={57} y2={43} stroke="#AAA" strokeWidth={3} />
    <Line x1={43} y1={57} x2={36} y2={64} stroke="#AAA" strokeWidth={3} />
    {/* Center cap */}
    <Circle cx={50} cy={50} r={8} fill="#AAA" />
    <Circle cx={50} cy={50} r={4} fill="#CCC" />
    {/* Checkmark for inspection */}
    <Circle cx={80} cy={20} r={12} fill={highlightColor} opacity={0.9} />
    <Path d="M74 20 L78 24 L86 16" stroke="#FFF" strokeWidth={2.5} fill="none" />
  </Svg>
);

// ── EXTRA/ADDITIONAL PHOTO ──
export const CarExtraView = ({ width = 100, height = 80, color = '#1E3A5F', highlightColor = '#3B82F6' }: CarIllustrationProps) => (
  <Svg width={width} height={height} viewBox="0 0 100 80">
    {/* Camera body */}
    <Rect x={20} y={25} width={60} height={40} rx={8} fill="#333" />
    {/* Lens */}
    <Circle cx={50} cy={45} r={14} fill="#111" />
    <Circle cx={50} cy={45} r={11} fill="#222" />
    <Circle cx={50} cy={45} r={8} fill="#444" />
    <Circle cx={50} cy={45} r={3} fill={highlightColor} opacity={0.7} />
    {/* Flash */}
    <Rect x={60} y={28} width={12} height={5} rx={2} fill="#555" />
    {/* Viewfinder */}
    <Rect x={38} y={18} width={24} height={10} rx={3} fill="#444" />
    {/* Plus sign */}
    <Circle cx={82} cy={60} r={10} fill={highlightColor} />
    <Line x1={82} y1={54} x2={82} y2={66} stroke="#FFF" strokeWidth={2.5} />
    <Line x1={76} y1={60} x2={88} y2={60} stroke="#FFF" strokeWidth={2.5} />
  </Svg>
);

// Map of position ID to component
export const INSPECTION_ILLUSTRATIONS: Record<string, React.FC<CarIllustrationProps>> = {
  front: CarFrontView,
  rear: CarRearView,
  left: CarLeftSideView,
  right: CarRightSideView,
  roof: CarTopView,
  interior: CarInteriorView,
  tires: CarTireView,
  extra: CarExtraView,
};
