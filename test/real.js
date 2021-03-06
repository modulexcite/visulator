'use strict';

process.env.DEBUG = 'cpu';
// Test against data generated by running this on an x86 system
// using [gai](https://github.com/thlorenz/gai)
// Only registers (including ebp and esp) are checked, but NOT the
// memory or stack. Additional tests should take care of that.

var test = require('tape')
var fs = require('fs')
var path = require('path')
var colors = require('ansicolors')
var format = require('util').format
var hex = require('../lib/hexstring')
var Regs = require('../lib/x86/regs')

var ControlUnit = require('../lib/x86/cu')

function inspect(obj, depth) {
  console.error(require('util').inspect(obj, false, depth || 5, true));
}

var filter = [
/*jshint elision:true*/
  'je_jne'
]

fs
  .readdirSync(path.join(__dirname, 'fixtures'))
  .filter(function (x) { return path.extname(x) === '.json' })
// .filter(function (x) { return ~filter.indexOf(path.basename(x).slice(0, -5)) })
//.filter(function (x) { return !~filter.indexOf(path.basename(x).slice(0, -5)) })
  .filter(function (x) { return !/^sample-/.test(path.basename(x)) })
  .forEach(runTest)

function parseOpcode(c) { return parseInt(c, 16) }

function parseRegs(regs) {
  function parse(acc, r) {
    acc[r] = parseInt(regs[r].hex, 16)
    return acc;
  }
  return Object.keys(regs).reduce(parse, {});
}

function RealTester(t, fixture) {
  if (!(this instanceof RealTester)) return new RealTester(t, fixture);

  this._t       = t;
  this._fixture = fixture;
  this._steps   = fixture.steps
  this._opcodes = fixture.opcodes.map(parseOpcode, [])

  this._initCu(this._opcodes)
}

var proto = RealTester.prototype;

proto.run = function run() {
  for (var i = 0, len = this._steps.length; i < len; i++)
    this._stepNcheck(this._steps[i])

  this._t.end()
}

proto._initCu = function _initCu(code) {
  var initial = this._fixture.initialState
    , parsedRegs = parseRegs(initial.regs)

  // assume that we have nothing on stack yet and therefore
  // esp points to upper ceiling of memory
  var cu = new ControlUnit();
  var opts = {
      memSize    : parsedRegs.esp
    , entryPoint : parseInt(initial.entryPoint, 16)
    , text       : code
    , regs       : parsedRegs
  }
  this._cu = cu.init(opts);
}

proto._stepNcheck = function _stepNcheck(step) {
  // print instruction
  // this._t.pass(colors.brightBlue(step.instruction))
  this._t.pass(colors.brightBlue(step.line))
  this._cu.next();
  this._checkRegs(step.regs)
}

function eflagsToString(val) {
  var r = new Regs();
  r.eflags = val;
  return r.flagsToString();
}

proto._checkRegs = function _checkRegs(expected) {
  var self = this;
  var expectedRegs;
  function pullHex(acc, r) {
    acc[r] = parseInt(expected[r].hex, 16);
    return acc;
  }

  function checkReg(r) {
    var expect = expectedRegs[r];
    var act = self._cu.regs[r];
    self._t.equal(act, expect,
                  format('%s: 0x%s === 0x%s', r, hex(act), hex(expect)))
    if (r === 'eflags' && act !== expect) {
      console.error('Expected:%s\nActual:  %s',
                    eflagsToString(expect), eflagsToString(act))
    }
  }

  expectedRegs = Object.keys(expected).reduce(pullHex, {});
  Object.keys(expectedRegs).forEach(checkReg)
}

function runTest(jsonFile) {
  test('\ngai ' + jsonFile, function (t) {
    t.ok(1, colors.green(jsonFile + ' ...'))
    new RealTester(t, require('./fixtures/' + jsonFile)).run()
  })
}
