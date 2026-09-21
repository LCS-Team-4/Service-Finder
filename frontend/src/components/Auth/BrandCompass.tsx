
function BrandCompass() {
	return (
		<svg viewBox="0 0 100 100">
			{/* Outer brass bezel */}
			<circle cx="50" cy="50" r="47" fill="none" stroke="#3f2410" strokeWidth="3.4" />
			<circle cx="50" cy="50" r="44.6" fill="none" stroke="#6b4423" strokeWidth="0.8" />

			{/* Degree ticks around the bezel */}
			<g stroke="#6b4423" strokeLinecap="round">
				{[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((angle) => (
					<line key={`tick-${angle}`} x1="50" y1="6.8" x2="50" y2="9.7" strokeWidth="1.3" transform={`rotate(${angle} 50 50)`} />
				))}
				{[0, 90, 180, 270].map((angle) => (
					<line key={`cardinal-${angle}`} x1="50" y1="5.7" x2="50" y2="9.7" strokeWidth="2.4" transform={`rotate(${angle} 50 50)`} />
				))}
			</g>

			{/* Parchment dial */}
			<circle cx="50" cy="50" r="40" fill="#f0ddb8" stroke="#8b5a2b" strokeWidth="1.3" />
			<circle cx="50" cy="50" r="36.3" fill="none" stroke="#a97e4a" strokeWidth="0.7" />
			<ellipse cx="37" cy="39" rx="20" ry="15" fill="#ffffff" opacity="0.1" />

			{/* Cardinal letters on the dial */}
			<g fontFamily="Georgia, serif" fontSize="11" fontWeight="700" fill="#6b4423" textAnchor="middle">
				<text x="50" y="19.5">N</text>
				<text x="50" y="87.5">S</text>
				<text x="84" y="53.5">E</text>
				<text x="16" y="53.5">W</text>
			</g>

			{/* Compass rose */}
			<g fill="#c28a3b">
				<circle cx="50" cy="50" r="23" fill="none" stroke="#a97e4a" strokeWidth="0.7" />
				{[0, 90, 180, 270].map((angle) => (
					<polygon key={`petal-${angle}`} points="50,29 46.2,44 53.8,44 50,50" opacity="0.95" transform={`rotate(${angle} 50 50)`} />
				))}
				{[45, 135, 225, 315].map((angle) => (
					<polygon key={`half-petal-${angle}`} points="50,36 47.4,44 52.6,44 50,50" opacity="0.8" transform={`rotate(${angle} 50 50)`} />
				))}
			</g>

			{/* Magnetic needle (red north, dark south) with center pivot */}
			<g>
				<polygon points="50,24 48.7,43 51.3,43 50,50" fill="#b53124" />
				<polygon points="50,76 48.7,57 51.3,57 50,50" fill="#35200d" />
				<circle cx="50" cy="50" r="5.2" fill="#2c1b0c" stroke="#6b4423" strokeWidth="0.6" />
				<circle cx="50" cy="50" r="2.1" fill="#cbb689" />
			</g>
		</svg>
	);
}

export default BrandCompass;