import { Router } from 'express'
import { authenticateToken, type AuthRequest } from '../middleware/auth'
import { supabase } from '../config/supabase'

const router = Router()

// GET: Fetch user's suggestions
router.get('/my-suggestions', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.auth?.userId
    if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' })

    const { data, error } = await supabase
      .from('service_suggestions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return res.status(200).json({ success: true, data })
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message })
  }
})

// POST: Create a new suggestion
router.post('/suggest', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.auth?.userId
    if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' })

    const { name, type, formatted_address, phone, website, opening_hours } = req.body

    if (!name) return res.status(400).json({ success: false, error: 'Name is required' })

    const { data, error } = await supabase
      .from('service_suggestions')
      .insert({
        user_id: userId,
        name,
        type,
        formatted_address,
        phone,
        website,
        opening_hours
      })
      .select()
      .single()

    if (error) throw error
    return res.status(201).json({ success: true, data })
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message })
  }
})

export default router