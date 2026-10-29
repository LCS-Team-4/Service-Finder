import { NextFunction, Request, Response } from 'express'
import { authenticateToken, requireAdmin, type AuthRequest } from './auth'

// Chain the standard JWT check and the admin role check.
// This means we only need the user's standard Authorization header.
export function requireAdminJwt(req: AuthRequest, res: Response, next: NextFunction) {
  authenticateToken(req, res, (err) => {
    if (err) return next(err);
    
    // After authenticateToken runs, req.auth is populated
    requireAdmin(req, res, next);
  });
}