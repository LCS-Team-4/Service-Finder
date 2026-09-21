import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthLayout from '../components/Auth/AuthLayout';
import { resetPasswordRequest } from '../services/api';

function ResetPassword() {
	const navigate = useNavigate();
	const [password, setPassword] = useState('');
	const [confirmPassword, setConfirmPassword] = useState('');
	const [message, setMessage] = useState('');
	const [isSuccess, setIsSuccess] = useState(false);

	async function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (password.length < 6) {
			setIsSuccess(false);
			setMessage('Your password must be at least 6 characters.');
			return;
		}
		if (password !== confirmPassword) {
			setIsSuccess(false);
			setMessage('Passwords do not match.');
			return;
		}
		const accessToken = new URLSearchParams(window.location.hash.replace(/^#/, '')).get('access_token');
		if (!accessToken) {
			setIsSuccess(false);
			setMessage('This reset link is missing or has expired.');
			return;
		}
		try {
			await resetPasswordRequest(accessToken, password);
			setIsSuccess(true);
			setMessage('Password updated. You can now log in.');
			window.history.replaceState({}, document.title, window.location.pathname);
			setTimeout(() => navigate('/login'), 900);
		} catch (error) {
			setIsSuccess(false);
			setMessage(error instanceof Error ? error.message : 'Unable to update your password.');
		}
	}

	return (
		<AuthLayout label="Set a new Cape Guide password">
			<div className="login-card auth-form-card">
				<div className="login-heading">
					<p className="panel-kicker">ACCOUNT RECOVERY</p>
					<h2>Set New Password</h2>
					<p>Choose a new password for your<br />Cape Guide account.</p>
				</div>
				<form onSubmit={handleSubmit} noValidate>
					{message && <p className={isSuccess ? 'form-success' : 'form-error'} role="alert">{message}</p>}
					<label className="field-label" htmlFor="new-password">New password</label>
					<input className="auth-input" id="new-password" type="password" value={password} onChange={(event) => { setPassword(event.target.value); setMessage(''); }} placeholder="New password" autoComplete="new-password" />
					<label className="field-label" htmlFor="confirm-new-password">Confirm new password</label>
					<input className="auth-input" id="confirm-new-password" type="password" value={confirmPassword} onChange={(event) => { setConfirmPassword(event.target.value); setMessage(''); }} placeholder="Confirm new password" autoComplete="new-password" />
					<button className="submit-button" type="submit">Update Password <span aria-hidden="true">→</span></button>
				</form>
				<p className="signup-prompt"><Link to="/login">← Back to Log In</Link></p>
			</div>
		</AuthLayout>
	);
}

export default ResetPassword;
