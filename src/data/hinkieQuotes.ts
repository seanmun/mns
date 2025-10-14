export interface HinkieQuote {
  id: number;
  quote: string;
  image: string;
}

export const hinkieQuotes: HinkieQuote[] = [
  {
    id: 1,
    quote: "The goal is not to be the richest guy in the cemetery.",
    image: "/quotes/cemetery.png"
  },
  {
    id: 2,
    quote: "We focus on process rather than outcome.",
    image: "/quotes/focusOnProcess.png"
  },
  {
    id: 3,
    quote: "You don't get to the moon by climbing a tree.",
    image: "/quotes/treeMoon.png"
  },
  {
    id: 4,
    quote: "The longest view in the room.",
    image: "/quotes/longestView.png"
  },
  {
    id: 5,
    quote: "Progress isn't linear.",
    image: "/quotes/progress.png"
  },
  {
    id: 6,
    quote: "Trust the Process.",
    image: "/quotes/TrustTheProcess.png"
  }
];

// Get quote based on day of week (0 = Sunday, 6 = Saturday)
// Using 6 quotes, Sunday will show quote 1, Monday quote 2, etc.
// Saturday wraps to quote 6
export function getDailyQuote(): HinkieQuote {
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0-6

  // Map day to quote (0-6 maps to indices 0-5, wrapping around)
  const quoteIndex = dayOfWeek % hinkieQuotes.length;

  return hinkieQuotes[quoteIndex];
}
