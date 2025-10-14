import { getDailyQuote } from '../data/hinkieQuotes';

export function Inbox() {
  const dailyQuote = getDailyQuote();
  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  return (
    <div className="min-h-screen bg-[#0a0a0a] py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white">Inbox</h1>
          <p className="text-gray-400 mt-1">
            Daily wisdom from the Process
          </p>
        </div>

        {/* Daily Quote Message */}
        <div className="bg-[#121212] rounded-lg border border-gray-800 overflow-hidden">
          {/* Message Header */}
          <div className="px-6 py-4 border-b border-gray-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold">
                SH
              </div>
              <div className="flex-1">
                <h3 className="text-white font-semibold">Sam Hinkie</h3>
                <p className="text-gray-400 text-sm">{today}</p>
              </div>
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-400/20 text-blue-400 border border-blue-400/30">
                Daily Quote
              </span>
            </div>
          </div>

          {/* Message Content */}
          <div className="px-6 py-8">
            {/* Quote Image */}
            <div className="mb-6 rounded-lg overflow-hidden border border-gray-800">
              <img
                src={dailyQuote.image}
                alt={dailyQuote.quote}
                className="w-full h-auto"
                onError={(e) => {
                  // Fallback if image doesn't exist
                  e.currentTarget.style.display = 'none';
                }}
              />
            </div>

            {/* Quote Text */}
            <blockquote className="text-center">
              <p className="text-2xl md:text-3xl font-serif text-white italic mb-4">
                "{dailyQuote.quote}"
              </p>
              <footer className="text-gray-400 text-sm">
                — Sam Hinkie
              </footer>
            </blockquote>
          </div>

          {/* Message Footer */}
          <div className="px-6 py-4 bg-[#0a0a0a] border-t border-gray-800">
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>Quote #{dailyQuote.id} of 6</span>
              <span>Trust the Process 🏀</span>
            </div>
          </div>
        </div>

        {/* Empty State / Future Messages */}
        <div className="mt-6 text-center py-12">
          <svg
            className="w-16 h-16 text-gray-600 mx-auto mb-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
            />
          </svg>
          <p className="text-gray-400 text-sm">
            No other messages
          </p>
          <p className="text-gray-500 text-xs mt-2">
            Check back tomorrow for another quote
          </p>
        </div>
      </div>
    </div>
  );
}
