'use strict';

const Store      = require('orbit-db-store');
const ArrayIndex = require('./ArrayIndex');
const Chance     = require('chance');

const chance = new Chance();

class ArrayStore extends Store {
  constructor(ipfs, id, dbname, options) {
    if(!options) options = {};
    if(!options.Index) Object.assign(options, { Index: ArrayIndex });
    super(ipfs, id, dbname, options)
  }

  toString() {
    return this._index.get();
  }

  insert(index, data) {
    return this._addOperation({
      op: 'INSERT',
      pos: index,
      value: data,
      id: chance.hash()
    });
  }

  delete(index) {
    return this._addOperation({
      op: 'DEL',
      pos: index,
      value: null
    });
  }
}

module.exports = ArrayStore;
