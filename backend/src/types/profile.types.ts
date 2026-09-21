export interface Profile {
  id: string
  first_name: string
  last_name: string
  employee_id: string
  role: "admin" | "user"
  is_active: boolean
  email: string
  password: string
  phone_number: string
}