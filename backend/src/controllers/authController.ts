import type { Request, Response } from 'express'
import { supabase } from '../config/supabase'

function getErrorMessage(error: unknown, fallback: string) {
	return error instanceof Error && error.message ? error.message : fallback
}


export async function login(req: Request, res: Response) {
	const { email, password } = req.body as { email?: string; password?: string }

	if (!email || !password) {
		return res.status(400).json({ error: 'Email and password are required.' })
	}

	const { data, error } = await supabase.auth.signInWithPassword({ email, password })
	if (error || !data.session || !data.user) {
		return res.status(401).json({ error: error?.message || 'Invalid email or password.' })
	}

	return res.json({
		user: { id: data.user.id, email: data.user.email },
		session: data.session,
	})
}

export async function signup(req: Request, res: Response) {
	const {
		name,
		firstName,
		lastName,
		phoneNumber,
		email,
		password,
	} = req.body as {
		name?: string
		firstName?: string
		lastName?: string
		phoneNumber?: string
		email?: string
		password?: string
	}
	const normalizedFirstName = firstName?.trim() || name?.trim().split(/\s+/)[0]
	const normalizedLastName = lastName?.trim() || name?.trim().split(/\s+/).slice(1).join(' ')

	if (!normalizedFirstName || !normalizedLastName || !email || !password || !phoneNumber) {
		return res.status(400).json({ error: 'First name, last name, phone number, email, and password are required.' })
	}

	const autoConfirmUsers = process.env.SUPABASE_AUTO_CONFIRM_USERS === 'true'
	const { data, error } = autoConfirmUsers
		? await supabase.auth.admin.createUser({
			email,
			password,
			email_confirm: true,
				user_metadata: { full_name: `${normalizedFirstName} ${normalizedLastName}` },
		})
		: await supabase.auth.signUp({
			email,
			password,
			options: { data: { full_name: name } },
		})

	if (error || !data.user) {
		if (error?.code === 'over_email_send_rate_limit') {
			return res.status(429).json({ error: 'Supabase has temporarily limited confirmation emails. Wait before trying again or configure custom SMTP in Supabase.' })
		}
		return res.status(400).json({ error: getErrorMessage(error, 'Unable to create your account.') })
	}

	const { error: profileError } = await supabase.from('profiles').insert({
		id: data.user.id,
		first_name: normalizedFirstName,
		last_name: normalizedLastName,
		phone_number: phoneNumber.trim(),
		email: email.trim().toLowerCase(),
		role: 'user',
		password: null,
	})

	if (profileError) {
		await supabase.auth.admin.deleteUser(data.user.id)
		return res.status(400).json({ error: `Account profile could not be created: ${profileError.message}` })
	}

	return res.status(201).json({
		user: { id: data.user.id, email: data.user.email },
		needsEmailConfirmation: !autoConfirmUsers && !('session' in data && data.session),
	})
}

export async function forgotPassword(req: Request, res: Response) {
	const { email } = req.body as { email?: string }

	if (!email) {
		return res.status(400).json({ error: 'Email is required.' })
	}

	const requestOrigin = req.get('origin')
	const redirectBase = requestOrigin?.startsWith('http://localhost:5173') || requestOrigin?.startsWith('http://127.0.0.1:5173')
		? requestOrigin
		: process.env.APP_BASE_URL
	const redirectTo = redirectBase
		? `${redirectBase}/reset-password`
		: undefined
	const { error } = await supabase.auth.resetPasswordForEmail(email, redirectTo ? { redirectTo } : undefined)

	if (error) {
		if (error.code === 'over_email_send_rate_limit') {
			return res.status(429).json({ error: 'Password reset emails are temporarily limited. Please wait before trying again or configure custom SMTP in Supabase.' })
		}
		return res.status(400).json({ error: error.message })
	}

	return res.json({ message: 'If an account exists, password reset instructions will be sent shortly.' })
}

export async function resetPassword(req: Request, res: Response) {
	const { accessToken, password } = req.body as { accessToken?: string; password?: string }
	if (!accessToken || !password || password.length < 6) {
		return res.status(400).json({ error: 'A valid reset token and a password of at least 6 characters are required.' })
	}

	const { data, error } = await supabase.auth.getUser(accessToken)
	if (error || !data.user) return res.status(401).json({ error: 'This reset link is missing or has expired.' })

	const { error: updateError } = await supabase.auth.admin.updateUserById(data.user.id, { password })
	if (updateError) return res.status(400).json({ error: updateError.message })
	return res.json({ message: 'Password updated successfully.' })
}
