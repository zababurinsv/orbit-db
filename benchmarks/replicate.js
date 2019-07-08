'use strict'

const IPFSRepo = require('ipfs-repo')
const OrbitDB = require('../src/OrbitDB')
const pMapSeries = require('p-map-series')
const rmrf = require('rimraf')
const mapSeries = require('p-each-series')

// Include test utilities
const {
  config,
  startIpfs,
  stopIpfs,
  testAPIs,
  connectPeers,
  waitForPeers,
  MemStore,
} = require('../test/utils')

const dbPath1 = './orbitdb/tests/replication/1'
const dbPath2 = './orbitdb/tests/replication/2'
const ipfsPath1 = './orbitdb/tests/replication/1/ipfs'
const ipfsPath2 = './orbitdb/tests/replication/2/ipfs'

let API = "js-ipfs"

let ipfsd1, ipfsd2, ipfs1, ipfs2
let orbitdb1, orbitdb2, db1, db2
let id1, id2

let timer
let options1, options2

let metrics2 = {
  totalQueries: 0,
  seconds: 0,
  queriesPerSecond: 0,
  lastTenSeconds: 0,
}

let prevCount = 0

const base = {
  prepare: async function () {
    config.daemon1.repo = ipfsPath1
    config.daemon2.repo = ipfsPath2
    rmrf.sync(config.daemon1.repo)
    rmrf.sync(config.daemon2.repo)
    rmrf.sync(dbPath1)
    rmrf.sync(dbPath2)

    ipfsd1 = await startIpfs(API, config.daemon1)
    ipfsd2 = await startIpfs(API, config.daemon2)
    ipfs1 = ipfsd1.api
    ipfs2 = ipfsd2.api

    // Use memory store for quicker tests
    const memstore = new MemStore()
    ipfs1.dag.put = memstore.put.bind(memstore)
    ipfs1.dag.get = memstore.get.bind(memstore)
    ipfs2.dag.put = memstore.put.bind(memstore)
    ipfs2.dag.get = memstore.get.bind(memstore)
    // Connect the peers manually to speed up test times
    await connectPeers(ipfs1, ipfs2)

    orbitdb1 = await OrbitDB.createInstance(ipfs1, { directory: dbPath1 })
    orbitdb2 = await OrbitDB.createInstance(ipfs2, { directory: dbPath2 })

    const defaultOptions = {
      // Set write access for both clients
      accessController: {
        write: [
          orbitdb1.identity.id,
          orbitdb2.identity.id
        ],
      }
    }

    options1 = Object.assign({}, defaultOptions, { directory: dbPath1 })
    options2 = Object.assign({}, defaultOptions, { directory: dbPath2 })
    db1 = await orbitdb1.eventlog('replication-tests', options1)
    db2 = await orbitdb2.eventlog(db1.address.toString(), options2)

    const entryCount = 1000
    const entryArr = []

    for (let i = 0; i < entryCount; i ++)
      entryArr.push(i)

    const add = i => db1.add('hello' + i)
    await mapSeries(entryArr, add)

    await waitForPeers(ipfs2, [orbitdb1.id], db1.address.toString())
  },
  cycle: async function() {
    metrics2.totalQueries = db2._oplog.length
    metrics2.queriesPerSecond = metrics2.totalQueries
    metrics2.lastTenSeconds += metrics2.queriesPerSecond
    prevCount = metrics2.totalQueries
    console.log(metrics2)
  },
  teardown: async function() {
    clearInterval(timer)
    options1 = {}
    options2 = {}
    if (db1) await db1.drop()
    if (db2) await db2.drop()
    if(orbitdb1) await orbitdb1.stop()
    if(orbitdb2) await orbitdb2.stop()
    if (ipfsd1) await stopIpfs(ipfsd1)
    if (ipfsd2) await stopIpfs(ipfsd2)
  }
}

// // Metrics output function
// const outputMetrics = (name, db, metrics) => {
//     metrics.seconds ++
//     console.log(`[${name}] ${metrics.queriesPerSecond} queries per second, ${metrics.totalQueries} queries in ${metrics.seconds} seconds (Oplog: ${db._oplog.length})`)
//     metrics.queriesPerSecond = 0
// 
//     if(metrics.seconds % 10 === 0) {
//       console.log(`[${name}] --> Average of ${metrics.lastTenSeconds/10} q/s in the last 10 seconds`)
//       metrics.lastTenSeconds = 0
//     }
// }
// 
//       console.log(e)
//       process.exit(1)
//     }
//   })
// 

const baseline = {
  while: ({ stats, startTime, baselineLimit }) => {
    return stats.count < baselineLimit
  }
}

const stress = {
  while: ({ stats, startTime, stressLimit }) => {
    return process.hrtime(startTime)[0] < stressLimit
  }
}

module.exports = [
  { name: 'replicate-baseline', ...base, ...baseline },
  { name: 'replicate-stress', ...base, ...stress }
]
