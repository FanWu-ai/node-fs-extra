'use strict'

const fs = require('../../..')
const path = require('path')
const os = require('os')
const assert = require('assert')
const proxyquire = require('proxyquire')
const stat = require('../../util/stat')

/* global describe, it, beforeEach, afterEach */

describe('move preserves existing destinations without overwrite', () => {
  let dir
  beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fs-extra-move-link-')) })
  afterEach(() => fs.removeSync(dir))

  for (const sync of [false, true]) {
    for (const sourceLink of [false, true]) {
      for (const overwrite of [undefined, false, true]) {
        it(`${sync ? 'sync' : 'async'} ${sourceLink ? 'link' : 'file'} with overwrite=${overwrite}`, async () => {
          const source = path.join(dir, 'source')
          const dest = path.join(dir, 'dest')
          fs.writeFileSync(path.join(dir, 'target'), 'original source data')
          if (sourceLink) fs.symlinkSync('target', source)
          else fs.writeFileSync(source, 'original source data')
          fs.symlinkSync('missing-target', dest)
          const options = overwrite === undefined ? {} : { overwrite }
          const move = () => sync ? fs.moveSync(source, dest, options) : fs.move(source, dest, options)
          if (overwrite) {
            await move()
            assert(!fs.existsSync(source))
            assert.strictEqual(fs.readFileSync(dest, 'utf8'), 'original source data')
            assert.strictEqual(fs.lstatSync(dest).isSymbolicLink(), sourceLink)
          } else {
            if (sync) assert.throws(move, /dest already exists/)
            else await assert.rejects(move, /dest already exists/)
            assert.strictEqual(fs.readlinkSync(dest), 'missing-target')
            assert.strictEqual(fs.readFileSync(source, 'utf8'), 'original source data')
            assert.strictEqual(fs.lstatSync(source).isSymbolicLink(), sourceLink)
          }
        })
      }
    }
  }

  for (const sync of [false, true]) {
    for (const destinationLink of [false, true]) {
      it(`${sync ? 'sync' : 'async'} preserves a ${destinationLink ? 'link' : 'file'} created after the initial path check`, async () => {
        const source = path.join(dir, 'source')
        const dest = path.join(dir, 'dest')
        fs.writeFileSync(source, 'original source data')
        const createDestination = () => {
          if (destinationLink) fs.symlinkSync('missing-target', dest)
          else fs.writeFileSync(dest, 'new destination data')
        }
        const move = proxyquire(sync ? '../move-sync' : '../move', {
          '../util/stat': {
            checkParentPathsSync: (...args) => {
              stat.checkParentPathsSync(...args)
              createDestination()
            },
            checkParentPaths: async (...args) => {
              await stat.checkParentPaths(...args)
              createDestination()
            }
          }
        })
        if (sync) assert.throws(() => move(source, dest), /dest already exists/)
        else await assert.rejects(move(source, dest), /dest already exists/)
        assert.strictEqual(fs.readFileSync(source, 'utf8'), 'original source data')
        if (destinationLink) assert.strictEqual(fs.readlinkSync(dest), 'missing-target')
        else assert.strictEqual(fs.readFileSync(dest, 'utf8'), 'new destination data')
      })
    }
  }
})
