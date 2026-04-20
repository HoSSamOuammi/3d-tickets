import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const rootDirectory = process.cwd()
const distDirectory = path.join(rootDirectory, 'dist')
const apiDirectory = path.join(rootDirectory, 'alwaysdata', 'api')
const alwaysdataHtaccessPath = path.join(rootDirectory, 'alwaysdata', '.htaccess')
const deployDirectory = path.join(rootDirectory, 'deploy')
const deployApiDirectory = path.join(deployDirectory, 'api')
const deployStorageDirectory = path.join(deployDirectory, 'storage')

if (!existsSync(distDirectory)) {
  throw new Error('Le dossier dist est introuvable. Lancez d abord `npm run build`.')
}

if (!existsSync(apiDirectory)) {
  throw new Error('Le dossier alwaysdata/api est introuvable.')
}

rmSync(deployDirectory, { recursive: true, force: true })
mkdirSync(deployDirectory, { recursive: true })

cpSync(distDirectory, deployDirectory, { recursive: true })
cpSync(apiDirectory, deployApiDirectory, { recursive: true })
if (existsSync(alwaysdataHtaccessPath)) {
  cpSync(alwaysdataHtaccessPath, path.join(deployDirectory, '.htaccess'))
}
mkdirSync(deployStorageDirectory, { recursive: true })
writeFileSync(path.join(deployStorageDirectory, '.gitkeep'), '')

console.log('Package alwaysdata genere dans deploy/')
