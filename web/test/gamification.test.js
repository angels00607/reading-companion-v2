import test from 'node:test'
import assert from 'node:assert/strict'
import {achievements,monthlyQuests} from '../src/gamification.js'
const books=[
 {id:'a',status:'finished',finished_on:'2026-04-04',page_count:300,favorite:true},
 {id:'b',status:'finished',finished_on:'2026-04-10',page_count:250,favorite:false},
 {id:'c',status:'dnf',finished_on:'2026-04-10',page_count:900,favorite:true},
 {id:'d',status:'finished',finished_on:'2025-05-03',page_count:null}
]
const sessions=[
 {book_id:'a',finished_on:'2026-04-04'},
 {book_id:'a',finished_on:'2026-04-20'},
 {book_id:'c',finished_on:'2026-04-10'}
]
test('unlocks first completed book without counting DNF',()=>{const a=achievements(books,sessions);assert.equal(a.find(x=>x.id==='first').unlocked,true);assert.equal(a.find(x=>x.id==='ten').value,3)})
test('tracks dated rereads as achievements',()=>{assert.equal(achievements(books,sessions).find(x=>x.id==='reread').value,1)})
test('renews quests for the selected calendar month',()=>{assert.equal(monthlyQuests(books,sessions,2026,4)[0].value,3);assert.equal(monthlyQuests(books,sessions,2026,5)[0].value,0)})
test('sums only known completed page counts',()=>{assert.equal(monthlyQuests(books,sessions,2026,4).find(x=>x.id==='read-pages').value,850)})
test('does not count DNF favorites',()=>{assert.equal(achievements(books,sessions).find(x=>x.id==='favorites').value,1)})
