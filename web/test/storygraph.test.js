import test from 'node:test'
import assert from 'node:assert/strict'
import {parseStoryGraphCSV} from '../src/storygraph.js'

const header='Title,Authors,ISBN/UID,Format,Read Status,Last Date Read,Dates Read,Read Count,Star Rating'
const parse=(...rows)=>parseStoryGraphCSV([header,...rows].join('\n'))

test('parses quoted commas, escaped quotes and CRLF without importing format',()=>{
 const result=parseStoryGraphCSV('\uFEFF'+header+'\r\n'+'"City, of ""Bones""",Cassandra Clare,9781234567890,digital,read,2026/02/09,2026/02/08-2026/02/09,1,5\r\n')
 assert.equal(result.length,1)
 assert.equal(result[0].title,'City, of "Bones"')
 assert.equal(result[0].isbn_13,'9781234567890')
 assert.equal(result[0].sessions.length,1)
 assert.equal(result[0].finished_on,'2026-02-09')
 assert.equal(Object.hasOwn(result[0],'book_format'),false)
})
test('preserves separate rereads, even when CSV periods are not chronological',()=>{
 const [book]=parse('City of Bones,Cassandra Clare,,paperback,read,2026/02/09,"2026/02/08-2026/02/09, 2020/03/01-2020/03/05",2,4')
 assert.equal(book.sessions.length,2)
 assert.deepEqual(book.sessions.map(s=>s.finished_on),['2026-02-09','2020-03-05'])
 assert.deepEqual(book.warnings,[])
})
test('flags incomplete rereads without inventing dates',()=>{
 const [book]=parse('November 9,Colleen Hoover,,,read,2021/12/15,2021/12/13-2021/12/15,2,4')
 assert.equal(book.sessions.length,1)
 assert.ok(book.warnings.some(w=>w.includes('Some reading sessions')))
})
test('deduplicates identical reading periods and requires review',()=>{
 const [book]=parse('Duplicate,Author,,,read,2024/02/03,"2024/02/01-2024/02/03, 2024/02/01-2024/02/03",2,5')
 assert.equal(book.sessions.length,1)
 assert.equal(book.sessionDuplicates,true)
 assert.ok(book.warnings.some(w=>w.includes('Duplicate reading sessions')))
})
test('rejects invalid calendar dates and malformed reading periods',()=>{
 const [book]=parse('Invalid,Author,,,read,2024/02/30,2024/02/31-2024/03/01,1,3')
 assert.equal(book.finished_on,null)
 assert.equal(book.sessions.length,0)
 assert.equal(book.sessionParseIssues,true)
 assert.ok(book.warnings.includes('Invalid finish date'))
})
test('does not round fractional ratings',()=>{
 const [book]=parse('Half,Author,,,read,2025/01/02,2025/01/01-2025/01/02,1,3.5')
 assert.equal(book.rating,null)
 assert.ok(book.warnings.some(w=>w.includes('whole star')))
})
test('DNF is not a finished book and has no dated sessions',()=>{
 const [book]=parse('DNF,Author,,,did-not-finish,2024/02/03,2024/02/01-2024/02/03,0,')
 assert.equal(book.status,'dnf')
 assert.equal(book.sessions.length,0)
 assert.equal(book.finished_on,null)
})
test('unknown statuses require manual review',()=>{
 const [book]=parse('Unknown,Author,,,,,,,')
 assert.equal(book.status,null)
 assert.ok(book.warnings.includes('Unrecognized reading status'))
})
test('rejects malformed CSV',()=>{
 assert.throws(()=>parseStoryGraphCSV('Title,Authors\n"Unclosed,Author'),/unclosed/)
})
