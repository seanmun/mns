import { Link } from 'react-router-dom';

const coreColors = [
  { name: 'Neon Green', value: 'oklch(79.2% 0.209 151.711)', css: 'green-400', usage: 'Primary accent, CTAs, links, highlights' },
  { name: 'Dark BG', value: '#0a0a0a', css: '[#0a0a0a]', usage: 'Page backgrounds' },
  { name: 'Card BG', value: '#121212', css: '[#121212]', usage: 'Cards, panels, elevated surfaces' },
  { name: 'Border', value: 'oklch(27.8% 0.033 256.848)', css: 'gray-800', usage: 'Borders, dividers' },
  { name: 'Primary Text', value: '#ffffff', css: 'white', usage: 'Headlines, important text' },
  { name: 'Secondary Text', value: 'oklch(70.7% 0.022 261.325)', css: 'gray-400', usage: 'Body text, descriptions' },
  { name: 'Muted Text', value: 'oklch(55.1% 0.027 264.364)', css: 'gray-500', usage: 'Captions, timestamps' },
];

const accentColors = [
  { name: 'Green', value: 'oklch(79.2% 0.209 151.711)', css: 'green-400', usage: 'Salary Cap, primary actions' },
  { name: 'Purple', value: 'oklch(71.4% 0.203 305.504)', css: 'purple-400', usage: 'Keepers, version badges' },
  { name: 'Pink', value: 'oklch(71.8% 0.176 22.768)', css: 'pink-400', usage: 'Rookies, development' },
  { name: 'Blue', value: 'oklch(70.7% 0.165 254.624)', css: 'blue-400', usage: 'Draft, real-time features' },
  { name: 'Yellow', value: 'oklch(85.2% 0.199 91.936)', css: 'yellow-400', usage: 'Prize pool, payouts' },
  { name: 'Emerald', value: 'oklch(76.5% 0.177 163.223)', css: 'emerald-400', usage: 'Analytics, metrics' },
];

export function Media() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <div className="max-w-3xl mx-auto px-4 py-12">
        <div className="mb-8">
          <Link to="/" className="text-gray-400 hover:text-green-400 text-sm transition-colors">
            &larr; Back to Home
          </Link>
        </div>

        <h1 className="text-3xl font-bold mb-2">Media Kit</h1>
        <p className="text-gray-400 mb-8">
          Brand assets, colors, and visual guidelines for Money Never Sleeps.
        </p>

        <div className="space-y-10">
          {/* Branding */}
          <section>
            <h2 className="text-xl font-bold text-white mb-4">Branding</h2>
            <div className="bg-[#121212] rounded-lg border border-gray-800 p-6">
              <div className="flex flex-wrap items-center gap-6 mb-6">
                <img
                  src="/icons/moneyneversleeps-icon.webp"
                  alt="MNS Logo"
                  className="w-24 h-24 rounded-lg"
                />
                <img
                  src="/icons/mnsBall-icon.webp"
                  alt="MNS Ball"
                  className="w-24 h-24 rounded-full"
                />
                <img
                  src="/icons/mns-icon.webp"
                  alt="MNS Icon"
                  className="w-24 h-24 rounded-lg"
                />
              </div>
              <div className="space-y-3 text-sm text-gray-400">
                <p><strong className="text-white">Full name:</strong> Money Never Sleeps</p>
                <p><strong className="text-white">Short name:</strong> MNS</p>
                <p><strong className="text-white">Tagline:</strong> Where Fantasy Basketball Meets Wall Street</p>
                <p><strong className="text-white">Font:</strong> Inter (system fallback: sans-serif)</p>
              </div>
            </div>
          </section>

          {/* Colors */}
          <section>
            <h2 className="text-xl font-bold text-white mb-4">Colors</h2>
            <div className="bg-[#121212] rounded-lg border border-gray-800 p-6 space-y-6">
              <div>
                <h3 className="text-sm font-semibold text-gray-300 mb-3">Core Palette</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {coreColors.map((color) => (
                    <div key={color.css} className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-md shrink-0 border border-gray-700"
                        style={{ backgroundColor: color.value }}
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-white text-sm font-medium">{color.name}</span>
                          <span className="text-gray-500 text-xs font-mono">{color.css}</span>
                        </div>
                        <p className="text-gray-500 text-xs truncate">{color.usage}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-300 mb-3">Feature Accents</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {accentColors.map((color) => (
                    <div key={color.css} className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-md shrink-0 border border-gray-700"
                        style={{ backgroundColor: color.value }}
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-white text-sm font-medium">{color.name}</span>
                          <span className="text-gray-500 text-xs font-mono">{color.css}</span>
                        </div>
                        <p className="text-gray-500 text-xs truncate">{color.usage}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* Vibe */}
          <section>
            <h2 className="text-xl font-bold text-white mb-4">Vibe</h2>
            <div className="bg-[#121212] rounded-lg border border-gray-800 p-6 space-y-4">
              <p className="text-gray-400 leading-relaxed">
                MNS blends Wall Street intensity with street basketball culture. The visual identity is dark, moody, and electric — think late-night trading floors meets midnight pickup games.
              </p>
              <ul className="space-y-2 text-sm text-gray-400">
                <li className="flex items-start gap-2">
                  <span className="text-green-400 mt-0.5 shrink-0">•</span>
                  <span>Dark backgrounds with neon green accents that glow</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-400 mt-0.5 shrink-0">•</span>
                  <span>Clean, data-heavy layouts — dashboards over decoration</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-400 mt-0.5 shrink-0">•</span>
                  <span>Confidence without arrogance — serious about the game, not about gatekeeping</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-400 mt-0.5 shrink-0">•</span>
                  <span>Glow effects on hover states and CTAs — the UI feels alive</span>
                </li>
              </ul>
            </div>
          </section>

          {/* Image Prompt Template */}
          <section>
            <h2 className="text-xl font-bold text-white mb-4">Image Prompt Template</h2>
            <div className="bg-[#121212] rounded-lg border border-gray-800 p-6 space-y-4">
              <p className="text-gray-400 text-sm">
                Use this template when generating MNS-branded images with AI tools (Midjourney, DALL-E, etc.):
              </p>
              <div className="bg-[#0a0a0a] rounded-md border border-gray-700 p-4">
                <code className="text-green-400 text-sm leading-relaxed whitespace-pre-wrap">
                  [subject], neon green lighting, faint brick wall in background, dark moody atmosphere, cinematic, high contrast, green glow accents, urban basketball aesthetic, Wall Street energy
                </code>
              </div>
              <p className="text-gray-500 text-xs">
                Replace [subject] with the specific content — e.g. "basketball on a desk next to stock charts" or "hooded figure studying a draft board"
              </p>
            </div>
          </section>

          {/* Ads */}
          <section>
            <h2 className="text-xl font-bold text-white mb-4">Advertising</h2>
            <div className="bg-[#121212] rounded-lg border border-gray-800 p-6">
              <p className="text-gray-400 text-sm">
                Ad placements and partnership opportunities coming soon. Contact us for early access.
              </p>
              <a
                href="mailto:sean.munley@protonmail.com"
                className="inline-block mt-3 text-sm text-green-400 hover:text-green-300 transition-colors"
              >
                sean.munley@protonmail.com
              </a>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
