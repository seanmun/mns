import { useParams } from 'react-router-dom';

export function Draft() {
  const { leagueId } = useParams<{ leagueId: string }>();

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        <div className="bg-[#121212] rounded-lg border border-gray-800 p-8 md:p-12 text-center">
          {/* Icon */}
          <div className="mb-6">
            <div className="inline-flex items-center justify-center w-20 h-20">
              <img src="/icons/draft-icon.png" alt="Draft" className="w-20 h-20 rounded-full" />
            </div>
          </div>

          {/* Title */}
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Draft Coming Soon
          </h1>

          {/* Message */}
          <p className="text-lg md:text-xl text-gray-300 mb-6">
            This feature will be available after keepers lock on
          </p>

          {/* Date/Time */}
          <div className="bg-purple-400/10 border border-purple-400/30 rounded-lg p-6 mb-8">
            <div className="text-2xl md:text-3xl font-bold text-purple-400 mb-2">
              October 15th
            </div>
            <div className="text-xl md:text-2xl font-semibold text-purple-300">
              High Noon
            </div>
          </div>

          {/* Additional Info */}
          <p className="text-sm text-gray-400 mb-8">
            Once keepers are locked, you'll be able to view the draft board, see all team keepers, and access draft tools.
          </p>

          {/* Back Button */}
          <a
            href={`/league/${leagueId}`}
            className="inline-block border-2 border-purple-400 text-purple-400 px-6 py-3 rounded-lg font-medium hover:bg-purple-400/10 hover:shadow-[0_0_15px_rgba(192,132,252,0.5)] transition-all cursor-pointer"
          >
            Back to League Home
          </a>
        </div>
      </div>
    </div>
  );
}
