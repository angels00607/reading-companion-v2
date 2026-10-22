import test from 'node:test'
import assert from 'node:assert/strict'
import {publicationCandidates,findPublicationCandidates} from '../src/publicationLookup.js'
const book={title:'Sample Book',author:'Author',isbn_13:'9781234567890'}
const item=(date,ids=[],title='Sample Book')=>({id:date,volumeInfo:{title,publishedDate:date,industryIdentifiers:ids.map(identifier=>({identifier})),publisher:'Publisher'}})
test('accepts only exact complete calendar dates',()=>{assert.deepEqual(publicationCandidates([item('2027'),item('2027-03'),item('2027-02-29'),item('2028-02-29')],book).map(x=>x.date),['2028-02-29'])})
test('rejects unrelated editions and titles',()=>{assert.equal(publicationCandidates([item('2027-05-12',[],'Different')],book).length,0)})
test('prioritizes ISBN matches over title matches',()=>{const results=publicationCandidates([item('2027-05-12'),item('2027-04-10',['9781234567890'],'Alternate edition')],book);assert.equal(results[0].isbnMatch,true)})
test('encodes query and does not invent a missing date',async()=>{const results=await findPublicationCandidates(book,async url=>{assert.ok(url.includes('isbn%3A9781234567890'));return {ok:true,json:async()=>({items:[item('2027-05')]})}});assert.deepEqual(results,[])})
