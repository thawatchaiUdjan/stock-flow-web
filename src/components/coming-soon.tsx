// users-and-access R40: a page whose module is not built yet.
export function ComingSoon({ title }: { title: string }) {
  return (
    <>
      <h1 className="text-title">{title}</h1>
      <p className="mt-2 text-muted-foreground">Coming soon</p>
    </>
  );
}
