export function TableContainer({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[640px]">{children}</div>
    </div>
  );
}
