import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="py-16 text-center">
      <h1 className="text-lg font-semibold text-ink">Page not found</h1>
      <p className="mt-2 text-sm text-ink-secondary">That route doesn't exist in this dashboard.</p>
      <Link to="/" className="mt-4 inline-block text-sm underline underline-offset-2 text-ink-secondary hover:text-ink">
        Back to the overview
      </Link>
    </div>
  );
}
