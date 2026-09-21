export interface ApiResponse<T = null> {
  success: boolean
  data?: T
  error?: string
  message?: string
}