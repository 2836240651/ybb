import Link from "next/link";

export default function NotFound() {
  return (
    <div className="page-container py-20 text-center">
      <h1 className="text-title-md mb-4">Page not found</h1>
      <p className="text-foreground/60 mb-8">The page you requested does not exist.</p>
      <Link
        href="/"
        className="inline-flex rounded-pill bg-foreground px-6 py-3 text-sm font-medium text-background"
      >
        Back to home
      </Link>
    </div>
  );
}
