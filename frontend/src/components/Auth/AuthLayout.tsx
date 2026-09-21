import { ReactNode } from 'react';

type AuthLayoutProps = {
	children: ReactNode;
	label: string;
};

function AuthLayout({ children, label }: Readonly<AuthLayoutProps>) {
	return (
		<main className="auth-page">
			<section className="auth-story" aria-label="ServiceFinder introduction">
				<div className="story-content">
					<a className="brand" href="/" aria-label="The Cape Guide home">
						<span className="brand-mark" aria-hidden="true"><span>⌕</span></span>
						<span className="brand-name">THE CAPE <span>GUIDE</span></span>
					</a>

					<div className="story-copy">
						<p className="eyebrow">FIND <span>•</span> CONNECT <span>•</span> ACCESS</p>
						<h1>Your Gateway to <strong>Essential Services</strong></h1>
						<p className="story-description">
							Find public and private services near you — quickly, easily and reliably.
							From hospitals and libraries to police stations and more.
						</p>
					</div>

					<div className="story-features" aria-label="ServiceFinder benefits">
						<div className="story-feature"><span className="feature-icon">⌖</span><strong>Locate</strong><small>nearby services</small></div>
						<div className="story-feature"><span className="feature-icon">➤</span><strong>Get</strong><small>directions</small></div>
						<div className="story-feature"><span className="feature-icon">♢</span><strong>Access</strong><small>what you need</small></div>
					</div>
				</div>
			</section>
			<section className="auth-panel" aria-label={label}>
				{children}
			</section>
		</main>
	);
}

export default AuthLayout;
