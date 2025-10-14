import { useState, useEffect } from 'react';
import { getDailyQuote } from '../data/hinkieQuotes';

export function Inbox() {
  const dailyQuote = getDailyQuote();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isRead, setIsRead] = useState(false);

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  // Load read status from localStorage
  useEffect(() => {
    const readKey = `hinkie-quote-read-${dailyQuote.id}-${new Date().toDateString()}`;
    const hasRead = localStorage.getItem(readKey) === 'true';
    setIsRead(hasRead);
  }, [dailyQuote.id]);

  // Handle expand and mark as read
  const handleExpand = () => {
    if (!isExpanded) {
      setIsExpanded(true);
      setIsRead(true);
      const readKey = `hinkie-quote-read-${dailyQuote.id}-${new Date().toDateString()}`;
      localStorage.setItem(readKey, 'true');

      // Trigger a custom event to update the header notification
      window.dispatchEvent(new Event('inboxRead'));
    } else {
      setIsExpanded(false);
    }
  };

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
        <div className={`bg-[#121212] rounded-lg border overflow-hidden transition-colors ${
          isRead ? 'border-gray-800' : 'border-green-400/50 shadow-[0_0_15px_rgba(74,222,128,0.3)]'
        }`}>
          {/* Message Header - Clickable */}
          <button
            onClick={handleExpand}
            className="w-full px-6 py-4 border-b border-gray-800 hover:bg-gray-800/30 transition-colors text-left"
          >
            <div className="flex items-center gap-3">
              {/* Unread Indicator */}
              {!isRead && (
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
              )}

              <div className="w-10 h-10 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center text-black font-bold">
                SH
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className={`font-semibold truncate ${isRead ? 'text-gray-400' : 'text-white'}`}>
                    Sam Hinkie
                  </h3>
                  {!isRead && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-green-400 text-black">
                      NEW
                    </span>
                  )}
                </div>
                <p className="text-gray-500 text-sm truncate">{dailyQuote.quote.substring(0, 50)}...</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-500">{today.split(',')[0]}</span>
                <svg
                  className={`w-5 h-5 text-gray-400 transition-transform ${
                    isExpanded ? 'rotate-180' : ''
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </button>

          {/* Message Content - Expandable */}
          {isExpanded && (
            <div className="px-6 py-8 md:flex md:items-center md:gap-8">
            {/* Quote Image - 50% width on desktop */}
            <div className="mb-6 md:mb-0 md:w-1/2 rounded-lg overflow-hidden border border-gray-800 flex-shrink-0">
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

            {/* Quote Text - 50% width on desktop */}
            <blockquote className="text-center md:text-left md:w-1/2">
              <p className="text-2xl md:text-3xl font-serif text-green-400 italic mb-4">
                "{dailyQuote.quote}"
              </p>
              <footer className="text-green-400 text-sm font-semibold">
                — Sam Hinkie
              </footer>
            </blockquote>
            </div>
          )}

          {/* Message Footer - Only show when expanded */}
          {isExpanded && (
            <div className="px-6 py-4 bg-[#0a0a0a] border-t border-gray-800">
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>Quote #{dailyQuote.id} of 7</span>
                <span>Trust the Process 🏀</span>
              </div>
            </div>
          )}
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
