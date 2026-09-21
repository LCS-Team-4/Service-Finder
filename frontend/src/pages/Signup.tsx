import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthLayout from '../components/Auth/AuthLayout';
import { signupRequest } from '../services/api';

function Signup() {
	const navigate = useNavigate();
	const [form, setForm] = useState({ firstName: '', lastName: '', phoneNumber: '', email: '', password: '', confirmPassword: '' });
	const [message, setMessage] = useState('');
	const [isSuccess, setIsSuccess] = useState(false);

	function updateField(field: keyof typeof form, value: string) {
		setForm({ ...form, [field]: value });
		setMessage('');
	}

	async function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (!form.firstName.trim() || !form.lastName.trim() || !form.phoneNumber.trim() || !form.email.trim() || !form.password || !form.confirmPassword) {
			setIsSuccess(false);
			setMessage('Complete your name, phone number, email, and password to create your account.');
			return;
		}
		const atIndex = form.email.indexOf('@');
		const dotIndex = form.email.lastIndexOf('.');
		if (atIndex <= 0 || dotIndex <= atIndex + 1 || dotIndex === form.email.length - 1) {
			setIsSuccess(false);
			setMessage('Enter a valid email address.');
			return;
		}
		if (form.password.length < 6) {
			setIsSuccess(false);
			setMessage('Your password must be at least 6 characters.');
			return;
		}
		if (form.password !== form.confirmPassword) {
			setIsSuccess(false);
			setMessage('Passwords do not match.');
			return;
		}
		try {
			const response = await signupRequest(form.firstName.trim(), form.lastName.trim(), form.phoneNumber.trim(), form.email.trim(), form.password);
			setIsSuccess(true);
			setMessage(response.needsEmailConfirmation
				? 'Account created. Check your email to confirm your account.'
				: 'Account created successfully. You can now log in.');
			navigate('/login');
		} catch (error) {
			setIsSuccess(false);
			setMessage(error instanceof Error ? error.message : 'Unable to create your account.');
		}
	}

	return (
		<AuthLayout label="Create your Cape Guide account">
			<div className="login-card auth-form-card">
				<div className="login-heading">
					<p className="panel-kicker">THE CAPE GUIDE</p>
					<h2>Create Account</h2>
					<p>Join The Cape Guide to find essential services<br />near you.</p>
				</div>
				<form onSubmit={handleSubmit} noValidate>
					{message && <p className={isSuccess ? 'form-success' : 'form-error'} role="alert">{message}</p>}
					<div className="auth-input-row">
						<div className="auth-field"><label className="field-label" htmlFor="signup-first-name">First name</label><input className="auth-input" id="signup-first-name" type="text" value={form.firstName} onChange={(event) => updateField('firstName', event.target.value)} placeholder="First name" autoComplete="given-name" /></div>
						<div className="auth-field"><label className="field-label" htmlFor="signup-last-name">Last name</label><input className="auth-input" id="signup-last-name" type="text" value={form.lastName} onChange={(event) => updateField('lastName', event.target.value)} placeholder="Last name" autoComplete="family-name" /></div>
					</div>
					<div className="auth-field"><label className="field-label" htmlFor="signup-phone">Phone number</label><input className="auth-input" id="signup-phone" type="tel" value={form.phoneNumber} onChange={(event) => updateField('phoneNumber', event.target.value)} placeholder="Phone number" autoComplete="tel" /></div>
					<div className="auth-field"><label className="field-label" htmlFor="signup-email">Email address</label><input className="auth-input" id="signup-email" type="email" value={form.email} onChange={(event) => updateField('email', event.target.value)} placeholder="Email address" autoComplete="email" /></div>
					<div className="auth-field"><label className="field-label" htmlFor="signup-password">Password</label><input className="auth-input" id="signup-password" type="password" value={form.password} onChange={(event) => updateField('password', event.target.value)} placeholder="Password" autoComplete="new-password" /></div>
					<div className="auth-field"><label className="field-label" htmlFor="signup-confirm-password">Confirm password</label><input className="auth-input" id="signup-confirm-password" type="password" value={form.confirmPassword} onChange={(event) => updateField('confirmPassword', event.target.value)} placeholder="Confirm password" autoComplete="new-password" /></div>
					<button className="submit-button" type="submit">Create Account <span aria-hidden="true">→</span></button>
				</form>
				<p className="signup-prompt">Already have an account? <Link to="/login">Log In</Link></p>
			</div>
		</AuthLayout>
	);
}

export default Signup;
