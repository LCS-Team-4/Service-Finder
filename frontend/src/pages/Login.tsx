import { useEffect } from 'react';
import AuthLayout from '../components/Auth/AuthLayout';
import LoginForm from '../components/Auth/LoginForm';

function Login() {
	useEffect(() => {
		localStorage.removeItem('servicefinder_access_token');
		localStorage.removeItem('servicefinder_refresh_token');
	}, []);

	return <AuthLayout label="Log in to your Cape Guide account"><LoginForm /></AuthLayout>;
}

export default Login;
