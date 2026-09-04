import { NextFunction, Request, Response } from 'express'
export function requireAdminImportToken(req: Request, res: Response, next: NextFunction) {
  const expectedToken = process.env.ADMIN_IMPORT_TOKEN
  const receivedToken = req.header('x-admin-import-token')

  if (!expectedToken || receivedToken !== expectedToken) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  next()
}