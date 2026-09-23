// TODO: implement request logging middleware (method, path, status, duration).
// Mount in server.ts before routes when built. Not required for current goals.

// import type { NextFunction, Request, Response } from 'express'

// export function requestLogger(req: Request, res: Response, next: NextFunction) {
//   const start = Date.now()
//   res.on('finish', () => {
//     const ms = Date.now() - start
//     console.log(`${req.method} ${req.originalUrl} ${res.statusCode} ${ms}ms`)
//   })
//   next()
// }

// to do