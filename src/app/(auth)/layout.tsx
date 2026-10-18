export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <div className="relative flex min-h-dvh flex-col overflow-x-clip">{children}</div>;
}
