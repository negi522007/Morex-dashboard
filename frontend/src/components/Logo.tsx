// The mark is wider than tall (viewBox 100x76, centred on the infinity so it lines up with text); `size` sets its height.
export function Logo({ size = 44 }: { size?: number }) {
  const width = Math.round((size * 100) / 76)
  return <img src="/logo.svg" alt="Morex logo" width={width} height={size} style={{ width, height: size }} />
}
