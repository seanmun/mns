import { useParams } from 'react-router-dom';

export function Draft() {
  const { leagueId } = useParams<{ leagueId: string }>();

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        <div className="bg-white rounded-lg shadow-xl p-8 md:p-12 text-center">
          {/* Icon */}
          <div className="mb-6">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-purple-100 rounded-full">
              <svg className="w-10 h-10 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
          </div>

          {/* Title */}
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            Draft Coming Soon
          </h1>

          {/* Message */}
          <p className="text-lg md:text-xl text-gray-600 mb-6">
            This feature will be available after keepers lock on
          </p>

          {/* Date/Time */}
          <div className="bg-purple-50 rounded-lg p-6 mb-8">
            <div className="text-2xl md:text-3xl font-bold text-purple-900 mb-2">
              October 15th
            </div>
            <div className="text-xl md:text-2xl font-semibold text-purple-700">
              High Noon
            </div>
          </div>

          {/* Additional Info */}
          <p className="text-sm text-gray-500 mb-8">
            Once keepers are locked, you'll be able to view the draft board, see all team keepers, and access draft tools.
          </p>

          {/* Back Button */}
          <a
            href={`/league/${leagueId}`}
            className="inline-block bg-purple-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-purple-700 transition-colors"
          >
            Back to League Home
          </a>
        </div>
      </div>
    </div>
  );
}
