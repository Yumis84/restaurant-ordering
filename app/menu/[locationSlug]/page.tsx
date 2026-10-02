import MenuClient from './MenuClient'

export function generateStaticParams(){
  return [{ locationSlug: 'kashtanovaya-73a' }]
}

export default async function MenuPage({params}:{params:Promise<{locationSlug:string}>}){
  const {locationSlug}=await params
  return <MenuClient locationSlug={locationSlug}/>
}
