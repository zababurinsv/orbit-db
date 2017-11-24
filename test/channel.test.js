'use strict'

const assert = require('assert')
const rmrf = require('rimraf')
const OrbitDB = require('../src/OrbitDB')
const config = require('./utils/config')
const startIpfs = require('./utils/start-ipfs')

const dbPath = './orbitdb/tests/kvstore'
const ipfsPath = './orbitdb/tests/kvstore/ipfs'

describe.only('orbit-db - Channel Store', function() {
  this.timeout(config.timeout)

  let ipfs, orbitdb1, orbitdb2, db

  before(async () => {
    config.daemon1.repo = ipfsPath
    rmrf.sync(config.daemon1.repo)
    rmrf.sync(dbPath)
    ipfs = await startIpfs(config.daemon1)
    orbitdb1 = new OrbitDB(ipfs, dbPath + '/1')
    orbitdb2 = new OrbitDB(ipfs, dbPath + '/2')
  })

  after(async () => {
    if(orbitdb1) 
      orbitdb1.stop()

    if(orbitdb2) 
      orbitdb2.stop()

    if (ipfs)
      await ipfs.stop()
  })

  beforeEach(async () => {
    db = await orbitdb1.channel(config.dbname, { path: dbPath })
  })

  afterEach(async () => {
    await db.drop()
  })

  it('inits a channel', async () => {
    assert.equal(db.state.max, -1)
    assert.equal(db.state.origin, null)
    assert.equal(db.state.source, null)
    assert.equal(db.state.sent, -1)
  })

  it('creates a channel', async () => {
    await db.create('hash1', 'id1', 1)
    assert.equal(db.state.max, 1)
    assert.equal(db.state.origin, 'hash1')
    assert.equal(db.state.source, 'id1')
    assert.equal(db.state.sent, 0)
  })

  it('sends data to a channel', async () => {
    await db.create('hash1', 'id1', 1)
    await db.send(1)
    assert.equal(db.state.sent, 1)
  })

  it('throws an error if trying to send to an uninitialized channel ', async () => {
    let err
    try {
      await db.send(1)
    } catch (e) {
      err = e.toString()
    }
    assert.equal(err, 'Error: Channel is not initialized yet, can\'t send!')
  })

  describe('Close', () => {
    it('closes a channel', async () => {
      await db.create('hash1', 'id1', 1)
      const hash = await db.send(1)
      await db.close(hash, 1)
      assert.equal(db.state.final, hash)
    })

    it('throws an error if final amount is missing from the closing operation', async () => {
      await db.create('hash1', 'id1', 1)
      const hash = await db.send(1)
      let err
      try {
        await db.close(hash)
      } catch (e) {
        err = e.toString()
      }
      assert.equal(err, 'Error: Final amount is missing from closing operation!')
    })

    it('throws an error if final amount is more than the maximum', async () => {
      await db.create('hash1', 'id1', 1)
      const hash = await db.send(10)
      let err
      try {
        await db.close(hash, 10)
      } catch (e) {
        err = e.toString()
      }
      assert.equal(err, 'Error: Final amount is more than deposit!')
    })
  })
})
