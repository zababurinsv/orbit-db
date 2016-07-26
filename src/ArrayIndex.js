'use strict';

class ArrayIndex {
  constructor() {
    this._index = [];
  }

  get() {
    return this._index.join('');
  }

  updateIndex(oplog, added) {
    added.reverse().reduce((handled, item) => {
      if(handled.indexOf(item.payload.id) === -1) {
        handled.push(item.payload.id);
        if(item.payload.op === 'INSERT') {
          this._index.splice(item.payload.pos, 0, item.payload.value)
        } else if(item.payload.op === 'DEL') {
          delete this._index[item.payload.key];
        }
      }
      return handled;
    }, []);
  }
}

module.exports = ArrayIndex;
