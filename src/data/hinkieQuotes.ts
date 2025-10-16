export interface HinkieQuote {
  id: number;
  quote: string;
  image: string;
}

export const hinkieQuotes: HinkieQuote[] = [
  {
    id: 1,
    quote: "The goal is not to be the richest guy in the cemetery.",
    image: "/hinkie/grave.png"
  },
  {
    id: 2,
    quote: "We focus on process rather than outcome.",
    image: "/hinkie/focusOnProcess.png"
  },
  {
    id: 3,
    quote: "You don't get to the moon by climbing a tree.",
    image: "/hinkie/treeMoon.png"
  },
  {
    id: 4,
    quote: "The longest view in the room.",
    image: "/hinkie/longestView.png"
  },
  {
    id: 5,
    quote: "Progress isn't linear.",
    image: "/hinkie/progress.png"
  },
  {
    id: 6,
    quote: "Trust the Process.",
    image: "/hinkie/TrustTheProcess.png"
  },
  {
    id: 7,
    quote: "The first step in a process is to understand the end goal.",
    image: "/hinkie/understandTheGoal.png"
  },
  {
    id: 8,
    quote: "Give me six hours to chop down a tree and I will spend the first four sharpening the axe. - Abe Lincoln",
    image: "/hinkie/hinkieAxe.png"
  }
];

// Get quote based on day of year
// Rotates through all quotes cyclically
export function getDailyQuote(): HinkieQuote {
  const today = new Date();
  // Get day of year (1-365/366)
  const start = new Date(today.getFullYear(), 0, 0);
  const diff = today.getTime() - start.getTime();
  const dayOfYear = Math.floor(diff / (1000 * 60 * 60 * 24));

  // Cycle through all quotes
  const quoteIndex = dayOfYear % hinkieQuotes.length;
  return hinkieQuotes[quoteIndex];
}
