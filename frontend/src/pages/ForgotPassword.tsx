import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import AuthLayout from '../components/Auth/AuthLayout';
import { forgotPasswordRequest } from '../services/api';

function ForgotPassword() {
	const [email, setEmail] = useState('');
	const [message, setMessage] = useState('');
	const [isSuccess, setIsSuccess] = useState(false);

	async function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (!email.trim()) {
			setIsSuccess(false);
			setMessage('Enter the email address linked to your account.');
			return;
		}
		const atIndex = email.indexOf('@');
		const dotIndex = email.lastIndexOf('.');
		if (atIndex <= 0 || dotIndex <= atIndex + 1 || dotIndex === email.length - 1) {
			setIsSuccess(false);
			setMessage('Enter a valid email address.');
			return;
		}
		try {
			const response = await forgotPasswordRequest(email.trim());
			setIsSuccess(true);
			setMessage(response.message);
		} catch (error) {
			setIsSuccess(false);
			setMessage(error instanceof Error ? error.message : 'Unable to send reset instructions.');
		}
	}

	return (
		<AuthLayout label="Reset your ServiceFinder password">
			<div className="login-card auth-form-card">
				<div className="login-heading">
					<p className="panel-kicker">ACCOUNT RECOVERY</p>
					<h2>Forgot Password?</h2>
					<p>Enter your email and we will help you<br />get back into your account.</p>
				</div>
				<form onSubmit={handleSubmit} noValidate>
					{message && <p className={isSuccess ? 'form-success' : 'form-error'} role="alert">{message}</p>}
					<label className="field-label" htmlFor="reset-email">Email address</label>
					<input className="auth-input" id="reset-email" type="email" value={email} onChange={(event) => { setEmail(event.target.value); setMessage(''); }} placeholder="Email address" autoComplete="email" />
					<button className="submit-button" type="submit">Send Reset Link <span aria-hidden="true">→</span></button>
				</form>
				<p className="signup-prompt"><Link to="/login">← Back to Log In</Link></p>
			</div>
		</AuthLayout>
	);
}

export default ForgotPassword;
