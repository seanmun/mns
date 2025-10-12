export function Rules() {
  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white flex items-center gap-2">
            <img src="/icons/rules-icon.png" alt="Rules" className="w-8 h-8 rounded-full" />
            Money Never Sleeps
          </h1>
          <p className="text-gray-400 mt-1">League Rules • 2025-26 Season</p>
        </div>

        {/* Overview */}
        <div className="bg-[#121212] rounded-lg border border-gray-800 mb-6">
          <div className="p-6">
            <p className="text-base text-gray-300 leading-relaxed">
              A fantasy basketball dynasty league that uses actual NBA salary cap rules and player salaries to construct teams for head-to-head weekly matchups. Each owner must keep their team under the cap or pay monetary penalties. This is a 12-team dynasty league where you can keep up to 8 players season to season.
            </p>
          </div>
        </div>

        {/* Rules Sections */}
        <div className="space-y-6">
          {/* Salary Cap */}
          <div className="bg-[#121212] rounded-lg border border-gray-800">
            <div className="p-6 border-b border-gray-800">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <img src="/icons/money-icon.png" alt="Money" className="w-6 h-6 rounded-full" />
                Salary Cap
              </h2>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                <div>
                  <h3 className="text-base font-semibold text-white mb-2">Cap Structure (2024-25 Season)</h3>
                  <ul className="text-sm text-gray-300 space-y-2 list-disc list-inside">
                    <li><strong className="text-green-400">Floor:</strong> $170M (minimum salary cap)</li>
                    <li><strong className="text-green-400">Base Cap:</strong> $210M (Fantrax default)</li>
                    <li><strong className="text-green-400">Hard Cap:</strong> $250M (maximum with trades)</li>
                    <li><strong className="text-green-400">Trade Limit:</strong> ±$40M from base cap</li>
                    <li>Fantrax will not let you execute roster moves that exceed $210M</li>
                    <li>All teams must stay above $170M minimum</li>
                  </ul>
                </div>

                <div className="border-t border-gray-800 pt-4">
                  <h3 className="text-base font-semibold text-white mb-2">Penalties</h3>
                  <ul className="text-sm text-gray-300 space-y-2 list-disc list-inside">
                    <li><strong className="text-green-400">First Apron Fee:</strong> $50 if over $170M (one-time fee, then you can stay over)</li>
                    <li><strong className="text-green-400">Second Apron Penalty:</strong> $2 per $1M over $210M (rounded up)</li>
                    <li><strong className="text-green-400">Example:</strong> Trading for $4M at $214M cap = $8 penalty</li>
                    <li><strong className="text-green-400">Maximum Penalty:</strong> Trading for $40M = $80 penalty</li>
                    <li>All penalties go directly into the prize pool</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* League Settings */}
          <div className="bg-[#121212] rounded-lg border border-gray-800">
            <div className="p-6 border-b border-gray-800">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <img src="/icons/settings-icon.png" alt="Settings" className="w-6 h-6 rounded-full" />
                League Settings
              </h2>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                <div>
                  <h3 className="text-base font-semibold text-white mb-2">Match-ups</h3>
                  <p className="text-sm text-gray-300 mb-2">Weekly head-to-head with one opponent each week. Earn a win or loss for each stat category.</p>
                  <p className="text-sm font-semibold text-white mb-1">9 Categories:</p>
                  <ul className="text-sm text-gray-300 space-y-1 list-disc list-inside">
                    <li>Points</li>
                    <li>Blocks</li>
                    <li>Steals</li>
                    <li>Assists</li>
                    <li>Rebounds</li>
                    <li>Ast/TO Ratio</li>
                    <li>Three Pointers Made</li>
                    <li>Field Goal Percentage</li>
                    <li>Free Throw Percentage</li>
                  </ul>
                </div>

                <div className="border-t border-gray-800 pt-4">
                  <h3 className="text-base font-semibold text-white mb-2">Fantrax Roster</h3>
                  <ul className="text-sm text-gray-300 space-y-2 list-disc list-inside">
                    <li><strong className="text-green-400">Active (10):</strong> 10 spots for active players, unlimited games per week</li>
                    <li><strong className="text-green-400">Bench (3):</strong> 3 bench spots</li>
                    <li><strong className="text-green-400">IR (2):</strong> 2 IR spots for injured players (count against cap)</li>
                    <li><strong className="text-green-400">Total:</strong> 15 players per team (10 active + 3 bench + 2 IR)</li>
                    <li><strong className="text-green-400">Minor (∞):</strong> Unlimited redshirt player spots (do not count against cap)</li>
                  </ul>
                </div>

                <div className="border-t border-gray-800 pt-4">
                  <h3 className="text-base font-semibold text-white mb-2">Playoffs</h3>
                  <ul className="text-sm text-gray-300 space-y-2 list-disc list-inside">
                    <li>6 teams make the playoffs</li>
                    <li>Top 2 teams receive first-round bye</li>
                    <li>Non-playoff teams enter consolation bracket</li>
                    <li>Consolation bracket winner gets best rookie draft lottery odds</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* Draft Rules */}
          <div className="bg-[#121212] rounded-lg border border-gray-800">
            <div className="p-6 border-b border-gray-800">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <img src="/icons/draft-icon.png" alt="Draft" className="w-6 h-6 rounded-full" />
                Draft Rules
              </h2>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                <div>
                  <h3 className="text-base font-semibold text-white mb-2">Regular Season Draft</h3>
                  <ul className="text-sm text-gray-300 space-y-2 list-disc list-inside">
                    <li>13 rounds, snake format</li>
                    <li>Draft order is randomized after keepers are submitted</li>
                    <li>Keepers occupy designated rounds based on previous year</li>
                    <li>Each team can keep up to 8 players (not required)</li>
                    <li>Regular season draft picks cannot be traded until after keepers are set</li>
                  </ul>
                </div>

                <div className="border-t border-gray-800 pt-4">
                  <h3 className="text-base font-semibold text-white mb-2">Rookie Draft</h3>
                  <ul className="text-sm text-gray-300 space-y-2 list-disc list-inside">
                    <li><strong className="text-green-400">When:</strong> Two rounds held in July (day of NBA draft)</li>
                    <li><strong className="text-green-400">Round 1:</strong> Starts at midnight EST, finishes before NBA draft at 3pm EST</li>
                    <li><strong className="text-green-400">Rounds 2-3:</strong> Immediately following NBA draft conclusion</li>
                    <li><strong className="text-green-400">Draft Order:</strong> Lottery-based for non-playoff teams (unless pick was traded)</li>
                    <li><strong className="text-green-400">Best Odds:</strong> Consolation bracket winner gets best lottery odds (reverse of NBA)</li>
                    <li>International prospects eligible (you own rights until NBA contract)</li>
                    <li>Draft picks and international stashes can be traded anytime</li>
                    <li>Future rookie picks can be traded up to 3 years in advance</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* Keeper Rules */}
          <div className="bg-[#121212] rounded-lg border border-gray-800">
            <div className="p-6 border-b border-gray-800">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <img src="/icons/lock-icon.png" alt="Lock" className="w-6 h-6 rounded-full" />
                Keeper Rules
              </h2>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                <div>
                  <h3 className="text-base font-semibold text-white mb-2">General Rules</h3>
                  <ul className="text-sm text-gray-300 space-y-2 list-disc list-inside">
                    <li>Maximum of 8 keepers per team (0-8 allowed)</li>
                    <li>Keepers advance one round earlier each year (previous round - 1)</li>
                    <li>Submit keepers one week prior to regular season draft</li>
                  </ul>
                </div>

                <div className="border-t border-gray-800 pt-4">
                  <h3 className="text-base font-semibold text-white mb-2">Rookie Keeper Rounds</h3>
                  <ul className="text-sm text-gray-300 space-y-2 list-disc list-inside">
                    <li><strong className="text-green-400">Round 1, Picks 1-3:</strong> 5th round keeper</li>
                    <li><strong className="text-green-400">Round 1, Picks 4-6:</strong> 6th round keeper</li>
                    <li><strong className="text-green-400">Round 1, Picks 7-9:</strong> 7th round keeper</li>
                    <li><strong className="text-green-400">Round 1, Picks 10-12:</strong> 8th round keeper</li>
                    <li><strong className="text-green-400">Rounds 2 & 3:</strong> 13th round keeper</li>
                    <li>If redshirted, keeper rounds stay the same for following year</li>
                  </ul>
                </div>

                <div className="border-t border-gray-800 pt-4">
                  <h3 className="text-base font-semibold text-white mb-2">Keeper Stacking Rules</h3>
                  <p className="text-sm text-white mb-2"><strong className="text-green-400">Bottom of Draft:</strong></p>
                  <ul className="text-sm text-gray-300 space-y-2 list-disc list-inside mb-3">
                    <li>If multiple players have same keeper round, assign rounds working down from 13-1</li>
                    <li>If you reach top of draft, follow "Top of Draft" rules</li>
                  </ul>

                  <p className="text-sm text-white mb-2"><strong className="text-green-400">Top of Draft:</strong></p>
                  <ul className="text-sm text-gray-300 space-y-2 list-disc list-inside">
                    <li><strong className="text-green-400">One Free 1st Round Keeper:</strong> Each team can keep one 1st round keeper without fee</li>
                    <li><strong className="text-green-400">Franchise Tag Fee:</strong> $15 per additional 1st round keeper</li>
                    <li>Work backwards assigning rounds from 1-13 for multiple 1st round keepers</li>
                    <li><strong className="text-green-400">Example:</strong> Keep LeBron and Durant → LeBron in round 1, Durant in round 2 (if no other 2nd round keeper, otherwise pushes to round 3, etc.)</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* Redshirt Rules */}
          <div className="bg-[#121212] rounded-lg border border-gray-800">
            <div className="p-6 border-b border-gray-800">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <img src="/icons/rookie-icon.png" alt="Rookie" className="w-6 h-6 rounded-full" />
                Redshirt Rules
              </h2>
            </div>
            <div className="p-6">
              <ul className="text-sm text-gray-300 space-y-2 list-disc list-inside">
                <li>Only players in their first contract year are eligible to be redshirted</li>
                <li><strong className="text-green-400">Redshirt Fee:</strong> $10 per player</li>
                <li>Must be submitted before keeper deadline</li>
                <li>Redshirted players do not count as keepers</li>
                <li>Redshirted players do not count against salary cap</li>
                <li>Stored in "Minor" roster spot on Fantrax (unlimited spots)</li>
                <li><strong className="text-green-400">Activation Fee:</strong> $25 to activate redshirt player during season</li>
                <li>Once activated, player counts against cap</li>
                <li>After redshirt year, player can be kept at original draft round</li>
              </ul>
            </div>
          </div>

          {/* International Stash */}
          <div className="bg-[#121212] rounded-lg border border-gray-800">
            <div className="p-6 border-b border-gray-800">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <img src="/icons/planet-icon.png" alt="International" className="w-6 h-6 rounded-full" />
                International Stash
              </h2>
            </div>
            <div className="p-6">
              <ul className="text-sm text-gray-300 space-y-2 list-disc list-inside">
                <li>International prospects eligible in rookie draft</li>
                <li>You own rights until player's first NBA contract begins</li>
                <li>Stashed players do not count against keeper limit</li>
                <li>Stashed players do not count against salary cap</li>
                <li>Option to keep, trade, or drop when player signs NBA contract</li>
                <li><strong className="text-green-400">Activation Fee:</strong> $25 when bringing player to active roster</li>
                <li>Can be traded at any point during season or off-season</li>
              </ul>
            </div>
          </div>

          {/* League Fees */}
          <div className="bg-[#121212] rounded-lg border border-gray-800">
            <div className="p-6 border-b border-gray-800">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <img src="/icons/money-icon.png" alt="Money" className="w-6 h-6 rounded-full" />
                League Fees & Dues
              </h2>
            </div>
            <div className="p-6">
              <p className="text-sm text-gray-300 mb-4 italic">All fees collected immediately to maximize time in the market.</p>
              <ul className="text-sm text-gray-300 space-y-2 list-disc list-inside">
                <li><strong className="text-green-400">Regular Season Entry:</strong> $50 per team</li>
                <li><strong className="text-green-400">Franchise Tag Fee:</strong> $15 per additional 1st round keeper</li>
                <li><strong className="text-green-400">Redshirt Rookie Fee:</strong> $10 per redshirted player</li>
                <li><strong className="text-green-400">Redshirt Activation Fee:</strong> $25 per player</li>
                <li><strong className="text-green-400">First Apron Penalty:</strong> $50 if over $170M</li>
                <li><strong className="text-green-400">Second Apron Penalty:</strong> $2 per $1M over $210M</li>
                <li><strong className="text-green-400">Commissioner Fines:</strong> $1-$10 per violation (e.g., drafting already-drafted player = $1)</li>
              </ul>
            </div>
          </div>

          {/* Prize Pool */}
          <div className="bg-[#121212] rounded-lg border border-gray-800">
            <div className="p-6 border-b border-gray-800">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <img src="/icons/trophy-icon.png" alt="Trophy" className="w-6 h-6 rounded-full" />
                Prize Pool Rules
              </h2>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                <p className="text-sm text-gray-300">
                  After collecting all fees ($600 base from 12 teams), possibly up to $1,500+ including penalties and fines, the entire prize pool will be invested into a voted-upon stock, futures bet, or Bitcoin!
                </p>

                <p className="text-sm text-gray-300">
                  By April, the prize pool could remain at $600, grow to $2,000,000, or decline to a minimum of $150. If investments fall below $150, we cash out and only first place is paid.
                </p>

                <div className="border-t border-gray-800 pt-4">
                  <h3 className="text-base font-semibold text-white mb-2">Payout Structures</h3>

                  <div className="mb-4">
                    <p className="text-sm font-semibold text-white mb-1">📉 Boiler Room Rule (Prize pool declines):</p>
                    <ul className="text-sm text-gray-300 space-y-1 list-disc list-inside ml-4">
                      <li>Below initial investment: 80% first, 20% second</li>
                      <li>Below $300: 100% first</li>
                      <li>Falls to $150: Cash out, 100% first</li>
                    </ul>
                  </div>

                  <div className="mb-4">
                    <p className="text-sm font-semibold text-white mb-1">💹 Gordon Gekko Rule (Prize pool grows):</p>
                    <ul className="text-sm text-gray-300 space-y-1 list-disc list-inside ml-4">
                      <li>70% first place</li>
                      <li>20% second place</li>
                      <li>10% third place</li>
                    </ul>
                  </div>

                  <div>
                    <p className="text-sm font-semibold text-white mb-1">🚀 Bernie Sanders Rule (Prize pool grows to $10,000+):</p>
                    <ul className="text-sm text-gray-300 space-y-1 list-disc list-inside ml-4">
                      <li>40% first place</li>
                      <li>15% second place</li>
                      <li>9% third place</li>
                      <li>4% to each remaining team</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Additional Notes */}
          <div className="bg-[#121212] rounded-lg border border-gray-800">
            <div className="p-6 border-b border-gray-800">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <img src="/icons/note-icon.png" alt="Notes" className="w-6 h-6 rounded-full" />
                Additional Notes
              </h2>
            </div>
            <div className="p-6">
              <ul className="text-sm text-gray-300 space-y-2 list-disc list-inside">
                <li>Players without salary in file default to league minimum</li>
                <li>10-day contracts and two-way contracts = league minimum salary</li>
                <li>Total roster: 15 spots (10 active, 3 bench, 2 IR) + unlimited minor</li>
                <li>Redshirt salaries do not count against the cap</li>
                <li>Regular season draft picks cannot be traded until after keepers are set</li>
                <li>Moving from ESPN to Fantrax (handles all salary cap calculations)</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
