import { ReactNode } from 'react';
import { MapPin, Navigation, Sparkles } from 'lucide-react';
import AuthMap from './AuthMap';
import BrandCompass from './BrandCompass';

type AuthLayoutProps = {
	children: ReactNode;
	label: string;
};

function AuthLayout({ children, label }: Readonly<AuthLayoutProps>) {
	return (
		<main className="auth-page">
			<AuthMap />
			<section className="auth-story" aria-label="The Cape Guide introduction">
				<div className="story-content">
					<a className="brand" href="/" aria-label="The Cape Guide home">
						<span className="brand-mark" aria-hidden="true"><span>⌕</span></span>
						<span className="brand-name">THE CAPE <span>GUIDE</span></span>
					</a>

					<div className="story-copy">
						<p className="eyebrow">FIND <span>•</span> NAVIGATE <span>•</span> CONNECT</p>
						<h1>Your guide to <strong>essential services.</strong></h1>
						<p className="story-description">
							Find public and private services near you — quickly, easily and reliably.
							From hospitals and libraries to police stations and more.
						</p>
					</div>

					<div className="story-features" aria-label="The Cape Guide benefits">
						<div className="story-feature"><MapPin className="feature-icon" aria-hidden="true" /><strong>Locate</strong><small>nearby services</small></div>
						<div className="story-feature"><Navigation className="feature-icon" aria-hidden="true" /><strong>Navigate</strong><small>with confidence</small></div>
						<div className="story-feature"><Sparkles className="feature-icon" aria-hidden="true" /><strong>Discover</strong><small>what you need</small></div>
					</div>
				</div>
			</section>
			<section className="auth-panel" aria-label={label}>{children}</section>
		</main>
	);
}

export default AuthLayout;
