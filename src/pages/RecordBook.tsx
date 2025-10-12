import { useParams } from 'react-router-dom';

// Record Book Data
const recordBookData = {
  firstPlaces: [
    { name: 'Kirbiak', count: 3 },
    { name: 'Sean', count: 2 },
    { name: 'Rick', count: 2 },
    { name: 'Tea Mike', count: 1 },
    { name: 'Ian', count: 1 },
    { name: 'Woods', count: 1 },
    { name: 'Bad', count: 1 },
    { name: 'Stine', count: 1 },
  ],
  secondPlaces: [
    { name: 'Sean', count: 3 },
    { name: 'Bad', count: 3 },
    { name: 'Woods', count: 2 },
    { name: 'Kirbiak', count: 1 },
    { name: 'Tea Mike', count: 1 },
    { name: 'Pudd', count: 1 },
    { name: 'Rick', count: 1 },
  ],
  thirdPlaces: [
    { name: 'Sean', count: 3 },
    { name: 'Stine', count: 3 },
    { name: 'Rick', count: 2 },
    { name: 'Kirbiak', count: 2 },
    { name: 'Ian', count: 1 },
    { name: 'PJ', count: 1 },
  ],
};

export function RecordBook() {
  const { leagueId } = useParams<{ leagueId: string }>();

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white flex items-center gap-2">
            <img src="/icons/book-icon.png" alt="Record Book" className="w-8 h-8 rounded-full" />
            Record Book
          </h1>
          <p className="text-gray-400 mt-1">League history and championship records</p>
        </div>

        {/* Reigning Champion Banner */}
        <div className="bg-gradient-to-br from-yellow-400 via-yellow-500 to-yellow-600 rounded-lg shadow-lg p-6 mb-8">
          <div className="text-center">
            <div className="text-lg font-semibold text-gray-900 mb-2">🏆 Reigning Champion</div>
            <div className="text-4xl font-bold text-gray-900">Kirbiak</div>
            <div className="text-sm text-gray-800 mt-2">2024-25 Season</div>
          </div>
        </div>

        {/* Records Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* 1st Place Finishes */}
          <div className="bg-[#121212] rounded-lg border border-gray-800 p-6">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-3xl">🥇</span>
              <h2 className="text-xl font-bold text-yellow-400">1st Place</h2>
            </div>
            <div className="space-y-3">
              {recordBookData.firstPlaces.map((record) => (
                <div key={record.name} className="flex justify-between items-center">
                  <span className="text-white font-medium">{record.name}</span>
                  <span className="bg-yellow-400/10 text-yellow-400 border border-yellow-400/30 px-3 py-1 rounded-full text-sm font-semibold">
                    {record.count}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* 2nd Place Finishes */}
          <div className="bg-[#121212] rounded-lg border border-gray-800 p-6">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-3xl">🥈</span>
              <h2 className="text-xl font-bold text-gray-400">2nd Place</h2>
            </div>
            <div className="space-y-3">
              {recordBookData.secondPlaces.map((record) => (
                <div key={record.name} className="flex justify-between items-center">
                  <span className="text-white font-medium">{record.name}</span>
                  <span className="bg-gray-700 text-gray-300 px-3 py-1 rounded-full text-sm font-semibold">
                    {record.count}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* 3rd Place Finishes */}
          <div className="bg-[#121212] rounded-lg border border-gray-800 p-6">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-3xl">🥉</span>
              <h2 className="text-xl font-bold text-orange-400">3rd Place</h2>
            </div>
            <div className="space-y-3">
              {recordBookData.thirdPlaces.map((record) => (
                <div key={record.name} className="flex justify-between items-center">
                  <span className="text-white font-medium">{record.name}</span>
                  <span className="bg-orange-400/10 text-orange-400 border border-orange-400/30 px-3 py-1 rounded-full text-sm font-semibold">
                    {record.count}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Back Button */}
        <div className="mt-8">
          <a
            href={`/league/${leagueId}`}
            className="inline-block border-2 border-green-400 text-green-400 px-6 py-3 rounded-lg font-medium hover:bg-green-400/10 hover:shadow-[0_0_15px_rgba(74,222,128,0.5)] transition-all cursor-pointer"
          >
            Back to League Home
          </a>
        </div>
      </div>
    </div>
  );
}
