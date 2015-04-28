'use strict';

/*
 * Memory structur looks similar to this:
 * 
 *   +---------------------+  |  ~0xffffff (upper address)
 *   |  The Stack          |  |     
 *   |                     |  |
 *   |---------------------|  \/  stack grows this way
 *   |                     |
 *   |  Unallocated        |
 *   |  virtual            |
 *   |  memory             |
 *   |                     |
 *   |---------------------|  /\  allocated memory grows this way
 *   |                     |  |
 *   |  .bss section       |  |   named uninitialized bytes (buffers)
 *   |                     |  |
 *   |---------------------|  |
 *   |                     |
 *   |  .data section      |      definitions of initialized data items 
 *   |                     |
 *   |---------------------|  
 *   |                     |
 *   |  .text section      |      machine instructions (our program) 
 *   |                     |
 *   +---------------------+    ~0x00000 (lower address)
 *   
 *   For simplicity our memory starts at 0x0, even though in real life 
 *   program code and data  will be down somewhere near (but not below) 08048000h. 
 *   Your stack will be up somewhere near (but not above) 0BFFFFFFFh.
 */
function Memory(size) {
  if (!(this instanceof Memory)) return new Memory(size);
  size = size || 0xffff;
  this._memStart = 0x0;
  this._memEnd = this._memStart + size;
  this._mem = new Array(size);
}
module.exports = Memory;

var proto = Memory.prototype;

proto.init = function init(text, data, bss, stack) {
  var i;
  // copy each section into the proper memory slots
  this._textStart = this._memStart;
  this._dataStart = this._textStart + text.length;
  this._bssStart =  this._dataStart + data.length;

  for (i = 0; i < text.length; i++)
    this._mem[this._textStart + i] = text[i];

  for (i = 0; i < data.length; i++)
    this._mem[this._dataStart + i] = data[i];

  for (i = 0; i < bss.length; i++)
    this._mem[this._bssStart + i] = bss[i];
  
  // we assume that the stack is given to us LIFO order
  var sp = this._memEnd;
  for (i = stack.length - 1; i >= 0; i--, sp--)
    this._mem[sp] = stack[i];  

  // sp is managed in regs like all other registers
  return sp;
}

proto.store = function store(addr, bytes) {
  if (!Array.isArray(bytes)) return (this._mem[addr] = bytes);
  for (var i = 0; i < bytes.length; i++) this._mem[addr + i] = bytes[i];
}

proto.load = function load(addr, size /* in bytes */) {
  return this._mem.slice(addr, size);
}