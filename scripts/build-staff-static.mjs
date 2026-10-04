import { cp, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawn } from 'node:child_process'

const root=process.cwd()
const temp=await mkdtemp(join(tmpdir(),'shavalleya-staff-static-'))
const appDir=join(temp,'app')

try {
  await cp(join(root,'app'),appDir,{recursive:true})
  // GitHub Pages preview contains only the safe demo board, never server-only staff APIs.
  await rm(join(appDir,'staff'),{recursive:true,force:true})
  await rm(join(appDir,'orders','live'),{recursive:true,force:true})
  await cp(appDir,join(root,'.staff-static-app'),{recursive:true})
  await rm(join(root,'app'),{recursive:true})
  await cp(join(root,'.staff-static-app'),join(root,'app'),{recursive:true})
  await rm(join(root,'.staff-static-app'),{recursive:true,force:true})
  const child=spawn(process.platform==='win32'?'npm.cmd':'npm',['run','build'],{
    cwd:root,stdio:'inherit',env:{...process.env,PAGES_DEPLOYMENT_MODE:'custom-domain'}
  })
  const code=await new Promise(resolve=>child.on('exit',resolve))
  if(code!==0) process.exitCode=code??1
} finally {
  await rm(join(root,'app'),{recursive:true,force:true})
  await cp(appDir,join(root,'app'),{recursive:true})
  await rm(temp,{recursive:true,force:true})
}
