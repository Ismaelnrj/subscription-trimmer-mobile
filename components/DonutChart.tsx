import { View } from "react-native";
import Svg, { Circle } from "react-native-svg";

export interface DonutSegment {
  value: number;
  color: string;
}

interface Props {
  segments: DonutSegment[];
  size?: number;
  strokeWidth?: number;
  trackColor?: string;
}

export function DonutChart({ segments, size = 140, strokeWidth = 18, trackColor }: Props) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const total = segments.reduce((sum, s) => sum + s.value, 0);

  let cumulative = 0;

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {trackColor && (
          <Circle cx={size / 2} cy={size / 2} r={radius} stroke={trackColor} strokeWidth={strokeWidth} fill="none" />
        )}
        {total > 0 && segments.map((seg, i) => {
          if (seg.value <= 0) return null;
          const fraction = seg.value / total;
          const dash = fraction * circumference;
          const rotation = (cumulative / total) * 360 - 90;
          cumulative += seg.value;
          return (
            <Circle
              key={i}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke={seg.color}
              strokeWidth={strokeWidth}
              strokeDasharray={`${dash} ${circumference - dash}`}
              strokeLinecap="butt"
              fill="none"
              origin={`${size / 2}, ${size / 2}`}
              rotation={rotation}
            />
          );
        })}
      </Svg>
    </View>
  );
}
