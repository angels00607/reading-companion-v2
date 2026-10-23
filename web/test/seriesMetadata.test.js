import test from 'node:test'
import assert from 'node:assert/strict'
import {extractSeriesMetadata} from '../src/seriesMetadata.js'
test('parses explicit series and volume',()=>{
 assert.deepEqual(extractSeriesMetadata('The Dragon (Dragon Saga, Book 2)'),{series:'Dragon Saga',series_position:2,confidence:'explicit_title'})
 assert.equal(extractSeriesMetadata('A Novel 1984').series_position,null)
 assert.equal(extractSeriesMetadata('The Second Book (Dragon Saga)').series_position,null)
})

test('recognizes French tome notation with explicit series',()=>{
 assert.deepEqual(extractSeriesMetadata('Le Dragon (Saga du Dragon - Tome 2)'),{series:'Saga du Dragon',series_position:2,confidence:'explicit_title'})
 assert.equal(extractSeriesMetadata('Le Dragon, tome 2').series_position,null)
 assert.equal(extractSeriesMetadata('Le Dragon (Tome 2)').series_position,null)
})
