
interface SparkLineProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  filled?: boolean;
  className?: string;
}

export function SparkLine({ data, width = 80, height = 24, color = '#06B6D4', filled = true, className = '' }: SparkLineProps) {
  if (data.length < 2) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const padding = 2;
  const w = width - padding * 2;
  const h = height - padding * 2;

  const points = data.map((v, i) => {
    const x = padding + (i / (data.length - 1)) * w;
    const y = padding + h - ((v - min) / range) * h;
    return `${x},${y}`;
  });

  const linePath = `M ${points.join(' L ')}`;
  const firstPoint = points[0].split(',');
  const lastPoint = points[points.length - 1].split(',');
  const areaPath = `M ${firstPoint[0]},${height - padding} L ${points.join(' L ')} L ${lastPoint[0]},${height - padding} Z`;

  return (
    <svg width={width} height={height} className={className}>
      {filled && (
        <path
          d={areaPath}
          fill={color}
          fillOpacity={0.12}
        />
      )}
      <path
        d={linePath}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
