import test from 'node:test'
import assert from 'node:assert/strict'
import {challengeVariant,challengeYears,eligibleChallengeBooks,eligibleChallengeBooksForMonth} from '../src/challengeRules.js'
const books=[
 {id:'a',status:'finished',finished_on:'2020-04-01'},
 {id:'b',status:'finished',finished_on:'2025-12-15'},
 {id:'c',status:'dnf',finished_on:'2026-03-02'},
 {id:'d',status:'finished',finished_on:null},
 {id:'e',status:'reading',finished_on:'2026-02-02'}
]
const sessions=[
 {book_id:'a',finished_on:'2026-03-10'},
 {book_id:'a',finished_on:'2020-04-01'},
 {book_id:'d',finished_on:'2026-01-04'},
 {book_id:'c',finished_on:'2026-03-02'}
]
test('alternates A/B from 2020',()=>{assert.equal(challengeVariant(2020),'A');assert.equal(challengeVariant(2021),'B');assert.equal(challengeVariant(2026),'A');assert.equal(challengeVariant(2027),'B')})
test('includes historical years and reread years',()=>{assert.deepEqual(challengeYears(books,sessions,2026),[2026,2025,2020])})
test('recognizes completed rereads in a different year',()=>{assert.deepEqual(eligibleChallengeBooks(books,sessions,2026).map(b=>b.id),['a','d'])})
test('excludes DNF and in-progress books',()=>{assert.equal(eligibleChallengeBooks(books,sessions,2026).some(b=>['c','e'].includes(b.id)),false)})
test('uses dated sessions rather than a stale book finish date',()=>{assert.deepEqual(eligibleChallengeBooksForMonth(books,sessions,2026,[3]).map(b=>b.id),['a']);assert.deepEqual(eligibleChallengeBooksForMonth(books,sessions,2026,[1]).map(b=>b.id),['d'])})
test('does not infer dates for missing sessions',()=>{assert.deepEqual(eligibleChallengeBooksForMonth(books,sessions,2026,[2]).map(b=>b.id),[])})
