export default function LobbyLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <div className="h-full w-full overflow-hidden">{children}</div>;
}
