import logo from './logo.png'

export function Logo({ size = 44 }: { size?: number }) {
  return (
    <img
      src={logo}
      alt="Dashboard logo"
      width={size}
      height={size}
      className="rounded-xl shadow-sm"
      style={{ width: size, height: size }}
    />
  )
}
