import test from 'node:test'
import assert from 'node:assert/strict'
import {readingStatistics,validReadingDate} from '../src/readingStatistics.js'
const books=[
 {id:'a',title:'A',author:'One',status:'finished',finished_on:'2025-12-31',page_count:300,rating:5,book_format:'ebook'},
 {id:'b',title:'B',author:'Two',status:'finished',finished_on:'2026-02-03',page_count:200,rating:4},
 {id:'c',title:'C',status:'dnf',finished_on:'2026-02-04',page_count:1000,rating:1},
 {id:'d',title:'D',status:'finished',finished_on:null,page_count:null},
 {id:'e',title:'E',status:'reading',finished_on:'2026-01-01',page_count:500}
]
const sessions=[
 {id:'s1',book_id:'a',started_on:'2025-12-01',finished_on:'2025-12-31'},
 {id:'s2',book_id:'a',started_on:'2026-01-02',finished_on:'2026-01-07'},
 {id:'s3',book_id:'c',started_on:'2026-02-01',finished_on:'2026-02-04'},
 {id:'s4',book_id:'d',started_on:'2026-02-30',finished_on:'2026-03-02'}
]
test('rejects impossible calendar dates',()=>{assert.equal(validReadingDate('2026-02-30'),false);assert.equal(validReadingDate('2024-02-29'),true);assert.equal(validReadingDate('2026-01-01'),true)})
test('excludes DNF and currently reading even with dated sessions',()=>{const s=readingStatistics(books,sessions);assert.equal(s.completedReadings,3);assert.equal(s.uniqueFinished,3);assert.equal(s.dated.some(b=>b.id==='c'||b.id==='e'),false)})
test('counts rereads once each, without duplicate fallback book finish dates',()=>{const s=readingStatistics(books,sessions);assert.equal(s.rereads,1);assert.equal(s.forYear(2025).length,1);assert.equal(s.forYear(2026).length,2)})
test('keeps month and year boundaries separate',()=>{const s=readingStatistics(books,sessions);assert.equal(s.forMonth(2026,1).length,1);assert.equal(s.forMonth(2026,2).length,1);assert.equal(s.forMonth(2025,12).length,1)})
test('sums known page counts per dated reading and ignores missing values',()=>{const s=readingStatistics(books,sessions);assert.equal(s.knownPages,800);assert.equal(s.missingPages,0)})
test('keeps ratings distinct from missing ratings',()=>{const s=readingStatistics(books,sessions);assert.equal(s.average(s.forYear(2026)),'4.5');assert.equal(s.average([]),'—')})
test('flags invalid session dates and undated finished books for review',()=>{const s=readingStatistics(books,sessions);assert.deepEqual(s.needsReview.map(b=>b.id),['d'])})
test('does not infer missing reread dates',()=>{const s=readingStatistics(books,sessions);assert.equal(s.allSessions.length,3);assert.equal(s.validSessions.length,2)})
