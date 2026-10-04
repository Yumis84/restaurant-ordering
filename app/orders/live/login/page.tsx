import { redirect } from 'next/navigation'
import LoginForm from './LoginForm'

export default function StaffLoginPage(){
  if(process.env.KDS_LIVE_ENABLED!=='true') redirect('/orders')
  return <LoginForm/>
}
