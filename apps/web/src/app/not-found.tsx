import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <h2 className="text-2xl font-bold text-slate-700">Page not found</h2>
      <p className="text-slate-500 text-sm">The page you are looking for does not exist.</p>
      <Link href="/dashboard" className="text-primary-600 hover:underline text-sm font-medium">
        Back to Dashboard
      </Link>
    </div>
  );
}
