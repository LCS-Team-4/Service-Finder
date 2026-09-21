import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { loginRequest } from '../../services/api';

function LoginForm() {
	const navigate = useNavigate();
	const [showPassword, setShowPassword] = useState(false);
	const [rememberMe, setRememberMe] = useState(true);
	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');
	const [errorMessage, setErrorMessage] = useState('');
	const [isSubmitting, setIsSubmitting] = useState(false);

	function validateForm() {
		if (!email.trim()) return 'Enter your email address.';
		const atIndex = email.indexOf('@');
		const dotIndex = email.lastIndexOf('.');
		if (atIndex <= 0 || dotIndex <= atIndex + 1 || dotIndex === email.length - 1) return 'Enter a valid email address.';
		if (!password) return 'Enter your password.';
		if (password.length < 6) return 'Your password must be at least 6 characters.';
		return '';
	}

	function handleFieldChange(setValue: (value: string) => void, value: string) {
		setValue(value);
		if (errorMessage) setErrorMessage('');
	}

	return (
		<div className="login-card" aria-labelledby="login-title">
				<div className="login-heading">
					<p className="panel-kicker">SERVICEFINDER ACCOUNT</p>
					<h2 id="login-title">Welcome Back</h2>
					<p>Log in to your ServiceFinder account<br />to continue.</p>
				</div>

				<form onSubmit={async (event) => {
					event.preventDefault();
					const validationError = validateForm();
					if (validationError) {
						setErrorMessage(validationError);
						return;
					}
					setIsSubmitting(true);
					try {
						const response = await loginRequest(email.trim(), password);
						if (response.session) {
							localStorage.setItem('servicefinder_access_token', response.session.access_token);
							localStorage.setItem('servicefinder_refresh_token', response.session.refresh_token);
						}
						setErrorMessage('');
						navigate('/dashboard');
					} catch (error) {
						setErrorMessage(error instanceof Error ? error.message : 'Unable to log in. Please try again.');
					} finally {
						setIsSubmitting(false);
					}
				}} noValidate>
					{errorMessage && <p className="form-error" role="alert">{errorMessage}</p>}
					<label className="field-label" htmlFor="email">Email address</label>
					<div className="input-wrap">
						<span className="input-icon" aria-hidden="true">✉</span>
						<input id="email" name="email" type="email" value={email} onChange={(event) => handleFieldChange(setEmail, event.target.value)} placeholder="Email address" autoComplete="email" aria-invalid={Boolean(errorMessage)} required />
					</div>

					<label className="field-label" htmlFor="password">Password</label>
					<div className="input-wrap">
						<span className="input-icon" aria-hidden="true">♙</span>
						<input id="password" name="password" type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => handleFieldChange(setPassword, event.target.value)} placeholder="Password" autoComplete="current-password" aria-invalid={Boolean(errorMessage)} required />
						<button className="visibility-button" type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Hide password' : 'Show password'}>
							{showPassword ? '◉' : '◌'}
						</button>
					</div>

					<div className="form-options">
						<label className="remember-option"><input type="checkbox" checked={rememberMe} onChange={(event) => setRememberMe(event.target.checked)} /><span>Remember me</span></label>
						<Link to="/forgot-password">Forgot password?</Link>
					</div>

					<button className="submit-button" type="submit" disabled={isSubmitting}>{isSubmitting ? 'Logging in...' : <>Log In <span aria-hidden="true">→</span></>}</button>
				</form>

				<p className="signup-prompt">Don't have an account? <Link to="/signup">Sign Up</Link></p>
		</div>
	);
}

export default LoginForm;
