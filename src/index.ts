import { exec, execSync } from 'child_process'
import * as yargs from 'yargs'
import * as fs from 'fs-extra'
import * as path from 'path'
import * as os from 'os'

const ignore = require('ignore')

export const getYargs = (command: Command) => {
  const cliCommand = {
    'yarn': 'ycl',
    'npm': 'ncl'
  }[command]
  console.log(`Copy ${command} linked modules like a boss:\n`)
  return yargs
    .usage(cliCommand + ' [options] module1 [module2...]')
    .describe('empty', 'cleans up destignation module directory before copying')
    .describe('no-npmingore', 'do not read .npmignore')
    .boolean('empty')
    .example(cliCommand + ' my-module', '- simple copy')
    .example(cliCommand + ' --empty mongoose express', '- empty destignation directory before')
    .demand(1, 'You should provide one or more linked modules to copy')
    .help(true)
    .argv
}

export interface Options {
  modules: string[]
  npmignore: boolean,
  empty?: boolean
}

type Command = 'npm' | 'yarn'

const getLinkDir = (command: Command) => {
  let linkDir = ''
  if (command === 'yarn') {
    linkDir = execSync('yarn config get link').toString().trim()
  }
  if (command === 'npm') {
    const prefixConfig = execSync('npm config get prefix').toString().trim()
    linkDir = path.join(prefixConfig, 'node_modules')
  }
  return linkDir
}

export const copyLinkedModules = (command: Command, options: Options) => {
  const modules = options.modules
  const linkedModulesDir = getLinkDir(command)
  const destModulesDir = path.join(process.cwd(), 'node_modules')

  type FileFilter = ((fileName: string) => boolean)

  const defaultFilters: FileFilter[] = [
    (f: string) => !/node_modules/.test(f)
  ]
  const makeCopyFilter = (filters: FileFilter[], moduleDir: string) =>
    (filePath: string) => {
      const fileName = filePath.slice(moduleDir.length).trim()
      return !fileName || !filters.reduce((notPassed, filter) =>
        notPassed || !filter(fileName), false)
    }

  options.modules.forEach((m) => {    
    const linkedSrc = path.join(linkedModulesDir, m)
    if (!fs.existsSync(linkedSrc)) {
      console.log(`${m} does not exits in ` + linkedModulesDir)
      return
    }
    const src = fs.readlinkSync(path.join(linkedModulesDir, m))
    const filters = defaultFilters.concat([])
    if (options.npmignore !== false) {
      try {
        const npmIgnore = ignore().add(
          fs.readFileSync(path.join(src, '.npmignore'), 'utf-8')
        )
        filters.push((f: string) => !npmIgnore.ignores(f))
      } catch (e) { }
    }
    const dest = path.join(destModulesDir, m)
    if (options.empty) {
      fs.emptyDirSync(dest)
    }
    const copyFilter = makeCopyFilter(filters, src)
    fs.copySync(src, dest, copyFilter)
    console.log(m + ' copied to', path.join(destModulesDir))
  })
}

export const execute = (command: 'npm' | 'yarn') => {
  const args = getYargs(command)
  copyLinkedModules(command, Object.assign({
    modules: args._
  }, args))
}
