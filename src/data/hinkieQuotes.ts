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
  }
];

// Get quote based on day of week (0 = Sunday, 6 = Saturday)
// Using 7 quotes, one for each day of the week
export function getDailyQuote(): HinkieQuote {
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0-6

  return hinkieQuotes[dayOfWeek];
}
